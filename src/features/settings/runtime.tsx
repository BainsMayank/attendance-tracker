import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import * as s from "@/db/schema";
import {
  dayFingerprint,
  logRange,
  markClass,
} from "@/db/repositories/daily-log";
import { resolveDay } from "@/lib/daily-log";
import {
  subscribeTimetable,
  invalidateTimetable,
} from "@/features/timetable/hooks";
import { haptic, useToast } from "@/ui";
import {
  configureNotifications,
  reconcileNotifications,
} from "./notifications";
import {
  notificationPayload,
  matchesReminderClass,
} from "./notification-model";
import { configureWeeklyBackground } from "./background";
import { weeklyBackupIfDue } from "./backup";
import { useAppLock, canOpenWorkspace } from "./app-lock";

export function SettingsRuntime() {
  const toast = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  useEffect(() => {
    if (process.env.EXPO_OS === "web") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: Notifications.NotificationResponse | null = null;
    const handled = new Set<string>();
    const processResponse = (response: Notifications.NotificationResponse) => {
      if (!canOpenWorkspace() || AppState.currentState !== "active") {
        pending = response;
        return;
      }
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      const raw = { ...response.notification.request.content.data };
      delete raw.signature;
      const parsed = notificationPayload.safeParse(raw);
      if (!parsed.success) {
        Notifications.clearLastNotificationResponse();
        return;
      }
      const payload = parsed.data;
      try {
        if (payload.kind === "test") return;
        if (!payload.semesterId)
          throw new Error("This reminder is unavailable.");
        const sem = getDatabase()
          .select()
          .from(s.semesters)
          .where(eq(s.semesters.id, payload.semesterId))
          .get();
        if (!sem) throw new Error("This semester was removed.");
        if (payload.kind === "class" || payload.kind === "daily") {
          if (!payload.date) throw new Error("This reminder has no date.");
          const data = logRange(sem.id, payload.date, payload.date);
          if (
            payload.kind === "class" &&
            ["PRESENT", "ABSENT"].includes(response.actionIdentifier)
          ) {
            try {
              const row = resolveDay(data, payload.date).classes.find(
                (r) =>
                  r.key === payload.key && r.subjectId === payload.subjectId,
              );
              if (
                !row ||
                !matchesReminderClass(row, payload) ||
                row.holiday ||
                row.cancelled ||
                sem.archivedAt !== null
              )
                throw new Error(
                  "This class changed or is read-only. Review it in Daily Log.",
                );
              // A stale notification must never overwrite a mark made later in the app.
              if (row.status !== null)
                throw new Error(
                  "This class is already marked. Review it in Daily Log.",
                );
              const result = markClass({
                semesterId: sem.id,
                date: payload.date,
                key: row.key,
                status:
                  response.actionIdentifier === "PRESENT"
                    ? "present"
                    : "absent",
                expected: dayFingerprint(data, payload.date),
              });
              invalidateTimetable();
              void haptic("success");
              toastRef.current({
                message: "Attendance saved",
                undo: () => {
                  result.undo();
                  invalidateTimetable();
                },
              });
            } catch (e) {
              toastRef.current({
                message:
                  e instanceof Error
                    ? e.message
                    : "Review this class in Daily Log.",
              });
            }
          }
          router.push({
            pathname: "/attendance-day",
            params: {
              semesterId: sem.id,
              date: payload.date,
              ...(payload.subjectId ? { subjectId: payload.subjectId } : {}),
            },
          });
        } else if (payload.subjectId) {
          const subject = getDatabase()
            .select()
            .from(s.subjects)
            .where(
              and(
                eq(s.subjects.id, payload.subjectId),
                eq(s.subjects.semesterId, sem.id),
              ),
            )
            .get();
          if (!subject) throw new Error("This subject was removed.");
          router.push({
            pathname: "/subjects/[subjectId]",
            params: { subjectId: subject.id, semesterId: sem.id },
          });
        }
      } catch (e) {
        toastRef.current({
          message: e instanceof Error ? e.message : "Could not open reminder.",
        });
      } finally {
        handled.add(id);
        pending = null;
        Notifications.clearLastNotificationResponse();
      }
    };
    const work = () => {
      if (!alive) return;
      void reconcileNotifications().catch(() => {});
      void configureWeeklyBackground().catch(() => {});
      void weeklyBackupIfDue().catch(() => {});
    };
    const changed = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(work, 150);
    };
    void configureNotifications()
      .then(() => {
        if (alive) work();
      })
      .catch(() => {
        if (alive) work();
      });
    const last = Notifications.getLastNotificationResponse();
    if (last) processResponse(last);
    const responseSub =
      Notifications.addNotificationResponseReceivedListener(processResponse);
    const lockSub = useAppLock.subscribe((state) => {
      if (state.unlocked && pending) processResponse(pending);
    });
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        changed();
        if (pending) processResponse(pending);
      }
    });
    const unsubscribe = subscribeTimetable(changed);
    // Refresh long foreground sessions at midnight and after the scheduling window moves.
    const interval = setInterval(changed, 60_000);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      responseSub.remove();
      lockSub();
      appSub.remove();
      unsubscribe();
    };
  }, []);
  return null;
}
