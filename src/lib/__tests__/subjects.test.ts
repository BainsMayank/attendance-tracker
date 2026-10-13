import type { LogData } from "../daily-log";
import {
  countdown,
  nextClasses,
  overallSummary,
  recommendation,
  sortSubjects,
  subjectModels,
} from "../subjects";
import type { deadlines } from "@/db/schema";

function data(): LogData {
  const meta = { createdAt: 1, updatedAt: 1, revision: 1 };
  return {
    semester: {
      ...meta,
      id: "sem",
      name: "Term",
      startsOn: "2026-10-05",
      endsOn: "2026-11-01",
      timezone: "Asia/Kolkata",
      weekAnchor: "2026-10-05",
      targetBps: 7500,
      archivedAt: null,
    },
    subjects: ["Zulu", "Alpha", "Empty", "Archived"].map((name, index) => ({
      ...meta,
      id: name,
      semesterId: "sem",
      name,
      normalizedName: name.toLowerCase(),
      code: null,
      teacher: null,
      icon: null,
      color: "#4144D8",
      credits: null,
      targetBps: index === 1 ? 5000 : null,
      sortOrder: 0,
      archivedAt: index === 3 ? 2 : null,
    })),
    types: [],
    versions: [
      {
        ...meta,
        id: "v1",
        semesterId: "sem",
        label: "First",
        effectiveFrom: "2026-10-05",
        effectiveUntil: "2026-10-14",
        supersededAt: null,
      },
      {
        ...meta,
        id: "v2",
        semesterId: "sem",
        label: "Second",
        effectiveFrom: "2026-10-14",
        effectiveUntil: null,
        supersededAt: null,
      },
    ],
    slots: [
      {
        ...meta,
        id: "slot",
        versionId: "v1",
        semesterId: "sem",
        subjectId: "Zulu",
        classTypeId: "type",
        weekday: 1,
        parity: "all",
        startMinute: 540,
        endMinute: 600,
        room: null,
        teacher: null,
        lineageId: null,
        countsAs: 1,
      },
      {
        ...meta,
        id: "later",
        versionId: "v2",
        semesterId: "sem",
        subjectId: "Alpha",
        classTypeId: "type",
        weekday: 3,
        parity: "even",
        startMinute: 600,
        endMinute: 660,
        room: null,
        teacher: null,
        lineageId: null,
        countsAs: 2,
      },
    ],
    extras: [],
    holidays: [],
    records: [],
    notes: [],
  };
}
test("overall is a weighted ratio including archived history; safe uses individual exact targets", () => {
  const d = data();
  const totals = [
    { subjectId: "Zulu", attended: 1, held: 1 },
    { subjectId: "Alpha", attended: 0, held: 9 },
    { subjectId: "Archived", attended: 2, held: 2 },
  ];
  const models = subjectModels(d, totals, new Map());
  expect(overallSummary(totals, models)).toEqual({
    attended: 3,
    held: 12,
    safe: 1,
    count: 3,
  });
  expect(models.find((m) => m.subject.id === "Empty")).toMatchObject({
    status: "noData",
    progress: null,
  });
  expect(subjectModels(d, totals, new Map(), true)).toHaveLength(4);
});
test("recommendations cover ordinary, weighted, no history, 0% and unreachable 100%", () => {
  expect(recommendation(7, 8, 7500, false)).toBe("You can skip 1 more");
  expect(recommendation(5, 8, 7500, false)).toBe("Attend next 4 to reach 75%");
  expect(recommendation(5, 8, 7500, true)).toContain("4 attendance units");
  expect(recommendation(0, 0, 7500, false)).toContain("first class");
  expect(recommendation(0, 0, 0, false)).toBe("No minimum target");
  expect(recommendation(8, 10, 10000, false)).toContain("cannot be reached");
});
test("sort has stable name ties, undefined percentage and no next class last, and never mutates input", () => {
  const models = subjectModels(
    data(),
    [
      { subjectId: "Zulu", attended: 1, held: 1 },
      { subjectId: "Alpha", attended: 1, held: 2 },
    ],
    new Map([
      ["Zulu", { date: "2026-10-12", startMinute: 600, countsAs: 1 }],
      ["Alpha", { date: "2026-10-12", startMinute: 540, countsAs: 2 }],
    ]),
  );
  expect(sortSubjects(models, "name").map((m) => m.subject.id)).toEqual([
    "Alpha",
    "Empty",
    "Zulu",
  ]);
  expect(sortSubjects(models, "percentage").map((m) => m.subject.id)).toEqual([
    "Alpha",
    "Zulu",
    "Empty",
  ]);
  expect(sortSubjects(models, "nextClass").map((m) => m.subject.id)).toEqual([
    "Alpha",
    "Zulu",
    "Empty",
  ]);
  expect(models[0].subject.id).toBe("Zulu");
});
test("next classes respect start time, exclusive versions, parity, gaps, holidays, extras and semester bounds", () => {
  const d = data();
  expect(nextClasses(d, "2026-10-12", 539).get("Zulu")?.date).toBe(
    "2026-10-12",
  );
  expect(nextClasses(d, "2026-10-12", 540).has("Zulu")).toBe(false);
  expect(nextClasses(d, "2026-10-11", 0).get("Alpha")).toEqual({
    date: "2026-10-14",
    startMinute: 600,
    countsAs: 2,
  });
  d.holidays.push({
    createdAt: 1,
    updatedAt: 1,
    revision: 1,
    id: "holiday",
    semesterId: "sem",
    subjectId: "Zulu",
    startsOn: "2026-10-12",
    endsOn: "2026-10-12",
    title: "Off",
  });
  expect(nextClasses(d, "2026-10-11", 0).has("Zulu")).toBe(false);
  d.extras.push({
    createdAt: 1,
    updatedAt: 1,
    revision: 1,
    id: "extra",
    semesterId: "sem",
    subjectId: "Zulu",
    classTypeId: "type",
    onDate: "2026-10-12",
    startMinute: 800,
    endMinute: 860,
    countsAs: 1,
    room: null,
    allowOnHoliday: false,
    cancelledAt: null,
  });
  expect(nextClasses(d, "2026-10-11", 0).has("Zulu")).toBe(false);
  d.extras[0].allowOnHoliday = true;
  expect(nextClasses(d, "2026-10-11", 0).get("Zulu")?.startMinute).toBe(800);
  d.versions = [];
  expect(nextClasses(d, "2026-10-11", 0).get("Zulu")?.startMinute).toBe(800);
  d.extras[0].cancelledAt = 2;
  expect(nextClasses(d, "2026-10-11", 0).size).toBe(0);
  expect(nextClasses(d, "2026-11-02", 0).size).toBe(0);
});
test("countdown picks nearest incomplete future deadline, seven-day boundary and semester-local midnight", () => {
  const now = new Date("2026-10-11T18:00:00Z");
  const deadline = (
    id: string,
    dueAt: number,
    completedAt: number | null = null,
  ): typeof deadlines.$inferSelect => ({
    id,
    subjectId: "Zulu",
    createdAt: 1,
    updatedAt: 1,
    revision: 1,
    title: id,
    description: null,
    category: "exam",
    dueAt,
    completedAt,
    reminderMinutes: null,
    notificationId: null,
  });
  const rows = [
    deadline("past", now.getTime() - 1),
    deadline("done", now.getTime(), 1),
    deadline("tomorrow", now.getTime() + 3600000),
    deadline("week", now.getTime() + 7 * 86400000),
    deadline("too far", now.getTime() + 7 * 86400000 + 1),
  ];
  expect(countdown(rows, "Zulu", now, "Asia/Kolkata")).toMatchObject({
    label: "Exam tomorrow",
    deadline: { id: "tomorrow" },
  });
  expect(countdown(rows.slice(3), "Zulu", now, "Asia/Kolkata")?.label).toBe(
    "Exam in 7 days",
  );
  expect(countdown(rows.slice(4), "Zulu", now, "Asia/Kolkata")).toBeNull();
  expect(countdown(rows, "Alpha", now, "Asia/Kolkata")).toBeNull();
  expect(
    countdown([deadline("today", now.getTime())], "Zulu", now, "Asia/Kolkata")
      ?.label,
  ).toBe("Exam today");
});
