import * as Notifications from "expo-notifications";
import * as mockSchema from "@/db/schema";
import { defaultReminders, defaultNotificationState } from "../model";
import { reconcileNotifications } from "../notifications";
import { logFixture, id } from "./fixtures";
let mockData = logFixture();
let mockPreferences: Record<string, unknown>;
let mockPending: {
  identifier: string;
  content: { data: Record<string, unknown> };
}[] = [];
let mockTotals = [{ subjectId: id(2), attended: 4, held: 4 }];
let mockDeadlines: unknown[] = [];
jest.mock("expo-notifications", () => ({
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: "date" },
  getPermissionsAsync: jest.fn(async () => ({
    granted: true,
    canAskAgain: true,
  })),
  getAllScheduledNotificationsAsync: jest.fn(async () => mockPending),
  scheduleNotificationAsync: jest.fn(async (request) => {
    if (request.trigger) mockPending.push(request);
    return request.identifier;
  }),
  cancelScheduledNotificationAsync: jest.fn(async (identifier) => {
    mockPending = mockPending.filter((r) => r.identifier !== identifier);
  }),
}));
jest.mock("../preferences", () => ({
  readPreference: (
    key: string,
    schema: { parse: (v: unknown) => unknown },
    fallback: unknown,
  ) => (key in mockPreferences ? schema.parse(mockPreferences[key]) : fallback),
  savePreference: (key: string, value: unknown) => {
    mockPreferences[key] = value;
  },
}));
jest.mock("@/db/client", () => ({
  getDatabase: () => ({
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          get: () =>
            table === mockSchema.settings
              ? { value: mockData.semester.id }
              : mockData.semester,
          all: () => mockDeadlines,
        }),
        all: () => [mockData.semester],
      }),
    }),
  }),
}));
jest.mock("@/db/repositories/daily-log", () => ({
  logRange: () => mockData,
  subjectTotals: () => mockTotals,
}));
beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-05T00:00:00Z"));
  mockData = logFixture();
  mockPending = [];
  mockDeadlines = [];
  mockTotals = [{ subjectId: id(2), attended: 4, held: 4 }];
  mockPreferences = {
    reminderRules: { ...defaultReminders, classes: true, daily: true },
  };
  jest.clearAllMocks();
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as Notifications.NotificationPermissionsStatus);
});
afterEach(() => jest.restoreAllMocks());
test("reconciliation is idempotent, cancels changed schedules and removes disabled reminders", async () => {
  await reconcileNotifications();
  expect(mockPending).toHaveLength(2);
  await reconcileNotifications();
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  mockPreferences.reminderRules = {
    ...defaultReminders,
    classes: true,
    leadMinutes: 30,
  };
  await reconcileNotifications();
  expect(mockPending).toHaveLength(1);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(
    2,
  );
  mockPreferences.reminderRules = defaultReminders;
  await reconcileNotifications();
  expect(mockPending).toHaveLength(0);
});
test("denial cancels owned schedules but preserves unrelated notifications", async () => {
  mockPending = [{ identifier: "other-owner", content: { data: {} } }];
  await reconcileNotifications();
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as Notifications.NotificationPermissionsStatus);
  await reconcileNotifications();
  expect(mockPending.map((r) => r.identifier)).toEqual(["other-owner"]);
  expect(mockPreferences.notificationState).toMatchObject({
    scheduled: 0,
    permission: "Denied — open system settings",
  });
});
test("low-attendance latch alerts on crossing, rearms on recovery, and ignores zero-held subjects", async () => {
  mockPreferences.reminderRules = { ...defaultReminders, lowAttendance: true };
  await reconcileNotifications();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  mockTotals = [{ subjectId: id(2), attended: 2, held: 4 }];
  await reconcileNotifications();
  await reconcileNotifications();
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  mockTotals = [{ subjectId: id(2), attended: 3, held: 4 }];
  await reconcileNotifications();
  mockTotals = [{ subjectId: id(2), attended: 2, held: 4 }];
  await reconcileNotifications();
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  mockTotals = [{ subjectId: id(2), attended: 0, held: 0 }];
  await reconcileNotifications();
  expect(
    (mockPreferences.notificationState as typeof defaultNotificationState)
      .below,
  ).toEqual({ [id(2)]: false });
});
test("OS capacity includes unrelated pending notifications and deleting deadlines removes their schedules", async () => {
  mockPending = Array.from({ length: 62 }, (_, i) => ({
    identifier: `other-${i}`,
    content: { data: {} },
  }));
  mockDeadlines = Array.from({ length: 10 }, (_, i) => ({
    id: id(20 + i),
    subjectId: id(2),
    dueAt: Date.now() + 48 * 3600000,
    completedAt: null,
    title: "Exam",
  }));
  mockPreferences.reminderRules = { ...defaultReminders, deadlines: true };
  await reconcileNotifications();
  expect(mockPending).toHaveLength(64);
  expect(mockPreferences.notificationState).toMatchObject({
    scheduled: 2,
    overflow: 18,
  });
  mockDeadlines = [];
  await reconcileNotifications();
  expect(mockPending).toHaveLength(62);
});
test("native scheduling failures are visible and retry through the serialized queue", async () => {
  jest
    .mocked(Notifications.scheduleNotificationAsync)
    .mockRejectedValueOnce(new Error("Native schedule failed"));
  await reconcileNotifications();
  expect(mockPreferences.notificationState).toMatchObject({
    error: "Native schedule failed",
  });
  await Promise.all([reconcileNotifications(), reconcileNotifications()]);
  expect(mockPending).toHaveLength(2);
  expect(mockPreferences.notificationState).toMatchObject({ error: "" });
});
