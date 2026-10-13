import {
  attendanceTrend,
  planClasses,
  upcomingClasses,
  type TimedSchedule,
} from "../insights";
const schedule = (): TimedSchedule => ({
  startsOn: "2026-01-05",
  endsOn: "2026-01-20",
  weekAnchor: "2026-01-05",
  versions: [
    { id: "v", effectiveFrom: "2026-01-05", effectiveUntil: "2026-01-12" },
    { id: "v2", effectiveFrom: "2026-01-12", effectiveUntil: null },
  ],
  slots: [
    {
      id: "s",
      versionId: "v",
      subjectId: "math",
      weekday: 1,
      parity: "odd",
      countsAs: 2,
      startMinute: 540,
    },
    {
      id: "t",
      versionId: "v2",
      subjectId: "math",
      weekday: 1,
      parity: "even",
      countsAs: 3,
      startMinute: 600,
    },
    {
      id: "u",
      versionId: "v2",
      subjectId: "other",
      weekday: 2,
      parity: "all",
      countsAs: 1,
      startMinute: 500,
    },
  ],
  extras: [
    {
      id: "e",
      subjectId: "math",
      onDate: "2026-01-06",
      countsAs: 1,
      startMinute: 700,
      cancelledAt: null,
      allowOnHoliday: false,
    },
  ],
  holidays: [],
});
test("planner uses sessions with real weights, version boundaries, parity and ordered dates", () => {
  const upcoming = upcomingClasses(schedule(), "2026-01-05", 500, "math");
  expect(upcoming.map((r) => r.date)).toEqual([
    "2026-01-05",
    "2026-01-06",
    "2026-01-12",
  ]);
  expect(planClasses(7, 8, upcoming, 2, "skip")).toMatchObject({
    attended: 7,
    held: 11,
    units: 3,
    nth: { date: "2026-01-06" },
    complete: true,
  });
  expect(planClasses(5, 8, upcoming, 3, "attend")).toMatchObject({
    attended: 11,
    held: 14,
    percentage: (100 * 11) / 14,
    nth: { date: "2026-01-12" },
  });
  expect(upcomingClasses(schedule(), "2026-01-05", 540, "math")[0].key).toBe(
    "extra:e",
  );
  expect(
    upcomingClasses(schedule(), "2026-01-01", 0).map((r) => r.subjectId),
  ).toContain("other");
  expect(upcomingClasses(schedule(), "2026-02-01", 0)).toEqual([]);
});
test("semester end is inclusive, holidays union, cancelled extras and holiday overrides", () => {
  const s = schedule();
  s.holidays = [
    { subjectId: null, startsOn: "2026-01-05", endsOn: "2026-01-12" },
    { subjectId: "math", startsOn: "2026-01-05", endsOn: "2026-01-06" },
  ];
  expect(upcomingClasses(s, "2026-01-05", 0, "math")).toEqual([]);
  s.extras[0].allowOnHoliday = true;
  expect(upcomingClasses(s, "2026-01-05", 0, "math")).toHaveLength(1);
  s.extras[0].cancelledAt = 1;
  expect(upcomingClasses(s, "2026-01-05", 0, "math")).toEqual([]);
  expect(upcomingClasses(s, "2026-01-20", 0).map((r) => r.date)).toEqual([
    "2026-01-20",
  ]);
  expect(upcomingClasses(s, "2026-01-20", 500)).toEqual([]);
});
test("stable simultaneous-class order, schedule gaps, invalid clock and input boundaries", () => {
  const s = schedule();
  s.extras.push({ ...s.extras[0], id: "a" });
  expect(
    upcomingClasses(s, "2026-01-06", 0)
      .slice(0, 2)
      .map((r) => r.key),
  ).toEqual(["extra:a", "extra:e"]);
  s.versions = [];
  expect(upcomingClasses(s, "2026-01-05", 0)).toHaveLength(2);
  expect(() => upcomingClasses(s, "bad", 0)).toThrow();
  expect(() => upcomingClasses(s, "2026-01-05", 1441)).toThrow();
  expect(() => upcomingClasses(s, "2026-01-05", -1)).toThrow();
  expect(() => planClasses(0, 0, [], 1.5, "attend")).toThrow();
  expect(() => planClasses(2, 1, [], 0, "attend")).toThrow();
  expect(() => planClasses(0, 0, [], 0, "bad" as "attend")).toThrow();
});
test("zero and insufficient capacity are explicit; empty percentages and overflow never clamp", () => {
  const u = upcomingClasses(schedule(), "2026-01-05", 0, "math");
  expect(planClasses(0, 0, u, 0, "attend")).toMatchObject({
    percentage: null,
    nth: null,
    complete: true,
  });
  expect(planClasses(0, 0, u, 1, "skip").percentage).toBe(0);
  expect(planClasses(0, 0, u, 1, "attend").percentage).toBe(100);
  expect(planClasses(1, 1, u, 10, "attend")).toMatchObject({
    complete: false,
    sessions: 3,
    nth: null,
  });
  expect(() =>
    planClasses(
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      u,
      1,
      "attend",
    ),
  ).toThrow();
  expect(() =>
    planClasses(0, 0, [{ ...u[0], countsAs: 0 }], 1, "skip"),
  ).toThrow();
});
test("trend coalesces days, includes ordered corrections, filters future, and breaks zero denominators", () => {
  const row = (
    id: string,
    onDate: string,
    attendedDelta: number,
    heldDelta: number,
    createdAt = 1,
  ) => ({ id, onDate, attendedDelta, heldDelta, createdAt });
  expect(attendanceTrend([], "2026-01-01")).toEqual([]);
  const rows = [
    row("a", "2026-01-05", 1, 1),
    row("c", "2026-01-05", 0, 1, 2),
    row("b", "2026-01-05", 1, 1, 2),
    row("d", "2026-01-06", 0, 0),
    row("e", "2026-01-07", -2, -3),
    row("f", "2026-01-08", 1, 1),
    row("z", "2026-02-01", 0, 1),
  ];
  expect(attendanceTrend(rows, "2026-01-08")).toEqual([
    { date: "2026-01-05", attended: 2, held: 3, percentage: (2 / 3) * 100 },
    { date: "2026-01-06", attended: 2, held: 3, percentage: (2 / 3) * 100 },
    { date: "2026-01-07", attended: 0, held: 0, percentage: null },
    { date: "2026-01-08", attended: 1, held: 1, percentage: 100 },
  ]);
  expect(() =>
    attendanceTrend([row("bad", "2026-01-05", -1, 0)], "2026-01-06"),
  ).toThrow("prefix");
});
