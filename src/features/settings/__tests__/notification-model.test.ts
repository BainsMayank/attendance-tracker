import { resolveDay } from "@/lib/daily-log";
import { zonedInstant } from "@/features/subjects/content-model";
import { defaultReminders, requiresUnlock, canAccessWorkspace } from "../model";
import {
  belowTarget,
  matchesReminderClass,
  notificationPayload,
  planReminders,
} from "../notification-model";
import { id, meta, logFixture } from "./fixtures";
const now = Date.parse("2026-01-05T00:00:00Z");
const rules = {
  ...defaultReminders,
  classes: true,
  daily: true,
  deadlines: true,
};
test("reminders use semester-local time and editable lead, with valid action payloads", () => {
  const data = logFixture();
  const result = planReminders(
    data,
    [],
    { ...rules, leadMinutes: 30, dailyMinute: 1260 },
    now,
  );
  expect(result.reminders.map((r) => r.at)).toEqual([
    Date.parse("2026-01-05T03:00:00Z"),
    Date.parse("2026-01-05T15:30:00Z"),
  ]);
  expect(result.reminders[0].payload.key).toBe(
    resolveDay(data, "2026-01-05").classes[0].key,
  );
  result.reminders.forEach((r) =>
    expect(notificationPayload.safeParse(r.payload).success).toBe(true),
  );
  expect(
    planReminders(data, [], { ...rules, leadMinutes: 0 }, now).reminders[0].at,
  ).toBe(Date.parse("2026-01-05T03:30:00Z"));
});
test("muting suppresses class reminders while holidays and fully marked days suppress nudges", () => {
  const data = logFixture();
  expect(
    planReminders(
      data,
      [],
      { ...rules, mutedSubjects: [id(2)] },
      now,
    ).reminders.map((r) => r.payload.kind),
  ).toEqual(["daily"]);
  data.holidays.push({
    ...meta,
    id: id(6),
    semesterId: id(1),
    subjectId: null,
    title: "Holiday",
    startsOn: "2026-01-05",
    endsOn: "2026-01-05",
  });
  expect(planReminders(data, [], rules, now).reminders).toEqual([]);
  data.holidays = [];
  data.records.push({
    ...meta,
    id: id(7),
    semesterId: id(1),
    subjectId: id(2),
    kind: "occurrence",
    onDate: "2026-01-05",
    occurrenceKey: resolveDay(data, "2026-01-05").classes[0].key,
    slotId: id(5),
    extraClassId: null,
    room: null,
    source: "manual",
    status: "present",
    classTypeId: id(3),
    classTypeName: "Lecture",
    startMinute: 540,
    endMinute: 600,
    countsAs: 1,
    attendedDelta: 1,
    heldDelta: 1,
    reason: null,
  });
  expect(planReminders(data, [], rules, now).reminders).toEqual([]);
});
test("a scoped holiday skips only that subject and cancelled extras never remind", () => {
  const data = logFixture();
  data.holidays.push({
    ...meta,
    id: id(6),
    semesterId: id(1),
    subjectId: id(2),
    title: "Holiday",
    startsOn: "2026-01-05",
    endsOn: "2026-01-05",
  });
  expect(planReminders(data, [], rules, now).reminders).toEqual([]);
  data.holidays = [];
  data.slots = [];
  data.extras.push({
    ...meta,
    id: id(8),
    semesterId: id(1),
    subjectId: id(2),
    classTypeId: id(3),
    onDate: "2026-01-05",
    startMinute: 540,
    endMinute: 600,
    room: null,
    countsAs: 1,
    cancelledAt: now,
    allowOnHoliday: false,
  });
  expect(planReminders(data, [], rules, now).reminders).toEqual([]);
});
test("deadline reminders are 24h and 1h before, omitting completed and past triggers", () => {
  const data = logFixture();
  data.slots = [];
  const deadline = {
    id: id(9),
    subjectId: id(2),
    dueAt: now + 48 * 3600000,
    completedAt: null,
    title: "Quiz",
  };
  expect(
    planReminders(data, [deadline], rules, now).reminders.map((r) => r.at),
  ).toEqual([now + 24 * 3600000, now + 47 * 3600000]);
  expect(
    planReminders(data, [{ ...deadline, completedAt: now }], rules, now)
      .reminders,
  ).toEqual([]);
  expect(
    planReminders(data, [{ ...deadline, dueAt: now + 2 * 3600000 }], rules, now)
      .reminders,
  ).toHaveLength(1);
});
test("window never exceeds 64, uses nearest first and accounts for unrelated scheduled items", () => {
  const data = logFixture();
  data.slots = [];
  const deadlines = Array.from({ length: 50 }, (_, i) => ({
    id: id(100 + i),
    subjectId: id(2),
    dueAt: now + (48 + i) * 3600000,
    completedAt: null,
    title: `Deadline ${i}`,
  }));
  const result = planReminders(data, deadlines, rules, now);
  expect(result.reminders).toHaveLength(64);
  expect(result.overflow).toBe(36);
  expect(result.reminders.map((r) => r.at)).toEqual(
    result.reminders.map((r) => r.at).sort((a, b) => a - b),
  );
  expect(planReminders(data, deadlines, rules, now, 60).overflow).toBe(40);
  expect(planReminders(data, deadlines, rules, now, 0).reminders).toEqual([]);
});
test("next-week midnight class can remind inside this window, archived terms and subjects cannot", () => {
  const data = logFixture();
  data.slots[0].startMinute = 0;
  data.slots[0].endMinute = 60;
  const result = planReminders(data, [], { ...rules, daily: false }, now);
  expect(result.reminders).toHaveLength(1);
  expect(result.reminders[0].at).toBe(
    zonedInstant("2026-01-12", 0, "Asia/Kolkata") - 10 * 60000,
  );
  data.subjects[0].archivedAt = now;
  expect(planReminders(data, [], rules, now).reminders).toEqual([]);
  data.semester.archivedAt = now;
  expect(planReminders(data, [], rules, now).reminders).toEqual([]);
});
test("DST nonexistent daily time is reported instead of shifted silently", () => {
  const data = logFixture();
  data.semester.timezone = "America/New_York";
  data.slots[0].weekday = 7;
  const result = planReminders(
    data,
    [],
    { ...rules, dailyMinute: 150 },
    Date.parse("2026-03-08T05:00:00Z"),
  );
  expect(result.reminders.map((r) => r.payload.kind)).toEqual(["class"]);
  expect(result.warnings).toHaveLength(1);
});
test("target comparison stays exact and lock boundary includes cold launch and backward clocks", () => {
  expect(belowTarget(3, 4, 7500)).toBe(false);
  expect(belowTarget(7499, 10000, 7500)).toBe(true);
  expect(belowTarget(0, 0, 7500)).toBe(false);
  expect(requiresUnlock(true, null, 100)).toBe(true);
  expect(requiresUnlock(true, 100, 60099)).toBe(false);
  expect(requiresUnlock(true, 100, 60100)).toBe(true);
  expect(requiresUnlock(true, 100, 99)).toBe(true);
  expect(requiresUnlock(false, null, 100)).toBe(false);
});

test("a pending action stays blocked on long background return before the lock listener runs", () => {
  expect(canAccessWorkspace(true, 100, 60100)).toBe(false);
  expect(canAccessWorkspace(true, 100, 60099)).toBe(true);
  expect(canAccessWorkspace(false, null, 60100)).toBe(false);
  expect(canAccessWorkspace(true, null, 60100)).toBe(true);
});

test("a delivered reminder cannot mark a class whose time, type or weight changed", () => {
  const data = logFixture();
  const row = resolveDay(data, "2026-01-05").classes[0];
  const payload = planReminders(data, [], rules, now).reminders[0].payload;
  expect(matchesReminderClass(row, payload)).toBe(true);
  expect(matchesReminderClass({ ...row, startMinute: 600 }, payload)).toBe(
    false,
  );
  expect(matchesReminderClass({ ...row, countsAs: 2 }, payload)).toBe(false);
  expect(matchesReminderClass({ ...row, typeId: id(99) }, payload)).toBe(false);
  expect(
    matchesReminderClass(row, {
      kind: "class",
      key: row.key,
      subjectId: row.subjectId,
    }),
  ).toBe(false);
});
