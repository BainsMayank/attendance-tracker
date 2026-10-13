import * as Notifications from "expo-notifications";
import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import * as s from "@/db/schema";
import { logRange, subjectTotals } from "@/db/repositories/daily-log";
import { addDays } from "@/lib/attendance";
import { localParts } from "@/features/subjects/content-model";
import { readPreference, savePreference } from "./preferences";
import {
  defaultReminders,
  reminderSchema,
  notificationStateSchema,
  defaultNotificationState,
} from "./model";
import { belowTarget, planReminders } from "./notification-model";

export const CLASS_CATEGORY = "ATTENDANCECLASS";
let queue = Promise.resolve();
export async function configureNotifications() {
  if (process.env.EXPO_OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (process.env.EXPO_OS === "android")
    await Notifications.setNotificationChannelAsync("attendance", {
      name: "Attendance and deadlines",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  await Notifications.setNotificationCategoryAsync(CLASS_CATEGORY, [
    {
      identifier: "PRESENT",
      buttonTitle: "Present",
      options: { opensAppToForeground: true, isAuthenticationRequired: true },
    },
    {
      identifier: "ABSENT",
      buttonTitle: "Absent",
      options: { opensAppToForeground: true, isAuthenticationRequired: true },
    },
  ]);
}
export async function requestNotificationPermission() {
  await configureNotifications();
  const permission = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  await reconcileNotifications();
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}
export function reconcileNotifications() {
  const job = queue.then(reconcile, reconcile);
  queue = job.catch(() => {});
  return job;
}
async function reconcile() {
  if (process.env.EXPO_OS === "web") return;
  const previous = readPreference(
    "notificationState",
    notificationStateSchema,
    defaultNotificationState,
  );
  const state: ReturnType<typeof notificationStateSchema.parse> = {
    ...previous,
    below: { ...previous.below },
    refreshedAt: Date.now(),
    error: "",
  };
  try {
    const rules = readPreference(
      "reminderRules",
      reminderSchema,
      defaultReminders,
    );
    const permission = await Notifications.getPermissionsAsync();
    const allowed =
      permission.granted ||
      permission.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL;
    state.permission = allowed
      ? "Allowed"
      : permission.canAskAgain
        ? "Not requested"
        : "Denied — open system settings";
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const owned = scheduled.filter((n) =>
      n.identifier.startsWith("attendance_"),
    );
    const capacity = Math.max(0, 64 - (scheduled.length - owned.length));
    const db = getDatabase();
    const selected = db
      .select()
      .from(s.settings)
      .where(eq(s.settings.key, "activeSemesterId"))
      .get()?.value;
    const semester =
      typeof selected === "string"
        ? db
            .select()
            .from(s.semesters)
            .where(eq(s.semesters.id, selected))
            .get()
        : db
            .select()
            .from(s.semesters)
            .all()
            .find((r) => r.archivedAt === null);
    let desired: ReturnType<typeof planReminders>["reminders"] = [];
    if (allowed && semester && semester.archivedAt === null) {
      const start = localParts(Date.now(), semester.timezone).date;
      const data = logRange(semester.id, start, addDays(start, 7));
      const ids = data.subjects
        .filter((r) => r.archivedAt === null)
        .map((r) => r.id);
      const deadlines = ids.length
        ? db
            .select()
            .from(s.deadlines)
            .where(and(inArray(s.deadlines.subjectId, ids)))
            .all()
        : [];
      const plan = planReminders(data, deadlines, rules, Date.now(), capacity);
      desired = plan.reminders;
      state.overflow = plan.overflow;
      state.error = plan.warnings.join(" ").slice(0, 2000);
      if (rules.lowAttendance) {
        const totals = subjectTotals(semester.id, start);
        for (const subject of data.subjects.filter(
          (r) => r.archivedAt === null,
        )) {
          const total = totals.find((r) => r.subjectId === subject.id);
          const below = belowTarget(
            total?.attended ?? 0,
            total?.held ?? 0,
            subject.targetBps ?? semester.targetBps,
          );
          if (below && !state.below[subject.id]) {
            // Immediate notifications do not consume a future schedule slot.
            await Notifications.scheduleNotificationAsync({
              identifier: `attendance_low_${subject.id}_${Date.now()}`,
              content: {
                title: `${subject.name} is below target`,
                body: `Attendance is below ${((subject.targetBps ?? semester.targetBps) / 100).toFixed(2)}%. Open the subject to plan your next classes.`,
                sound: "default",
                data: {
                  kind: "low",
                  semesterId: semester.id,
                  subjectId: subject.id,
                },
              },
              trigger:
                process.env.EXPO_OS === "android"
                  ? { channelId: "attendance" }
                  : null,
            });
          }
          state.below[subject.id] = below;
        }
      } else state.below = {};
    } else {
      state.overflow = 0;
      if (!rules.lowAttendance) state.below = {};
    }
    const signatures = new Map(desired.map((r) => [r.id, JSON.stringify(r)]));
    for (const request of owned)
      if (
        request.content.data?.signature !== signatures.get(request.identifier)
      )
        await Notifications.cancelScheduledNotificationAsync(
          request.identifier,
        );
    for (const reminder of desired) {
      if (
        owned.some(
          (r) =>
            r.identifier === reminder.id &&
            r.content.data?.signature === signatures.get(reminder.id),
        )
      )
        continue;
      if (reminder.at <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: reminder.title,
          body: reminder.body,
          sound: "default",
          categoryIdentifier:
            reminder.payload.kind === "class" ? CLASS_CATEGORY : undefined,
          data: { ...reminder.payload, signature: signatures.get(reminder.id) },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminder.at),
          channelId: "attendance",
        },
      });
    }
    state.scheduled = (
      await Notifications.getAllScheduledNotificationsAsync()
    ).filter((r) => r.identifier.startsWith("attendance_")).length;
  } catch (e) {
    state.error = (e instanceof Error ? e.message : String(e)).slice(0, 2000);
  }
  savePreference("notificationState", state, false);
}
export async function testNotification() {
  const p = await Notifications.getPermissionsAsync();
  if (
    !p.granted &&
    p.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
  )
    throw new Error("Allow notifications first.");
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Attendance Tracker",
      body: "Local reminders are ready.",
      sound: "default",
      data: { kind: "test" },
    },
    trigger:
      process.env.EXPO_OS === "android" ? { channelId: "attendance" } : null,
  });
}
