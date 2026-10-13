import * as a from "..";
const schedule = (): a.Schedule => ({
  startsOn: "2026-03-02",
  endsOn: "2026-03-22",
  weekAnchor: "2026-03-02",
  versions: [
    { id: "v1", effectiveFrom: "2026-03-02", effectiveUntil: "2026-03-09" },
    { id: "v2", effectiveFrom: "2026-03-09", effectiveUntil: null },
  ],
  slots: [
    {
      id: "s1",
      versionId: "v1",
      subjectId: "sub1",
      weekday: 1,
      parity: "all",
      countsAs: 1,
    },
    {
      id: "s2",
      versionId: "v2",
      subjectId: "sub1",
      weekday: 1,
      parity: "even",
      countsAs: 2,
    },
    {
      id: "s3",
      versionId: "v2",
      subjectId: "sub2",
      weekday: 1,
      parity: "odd",
      countsAs: 1,
    },
  ],
  extras: [],
  holidays: [],
});
test.each([
  "2026-02-30",
  "2025-02-29",
  "2026-13-01",
  "2026-00-01",
  "not-a-date",
  "2026-1-1",
])("invalid calendar day %s", (date) =>
  expect(() => a.dayNumber(date)).toThrow(),
);
test("leap days, DST boundaries, and Sunday to Monday are calendar arithmetic", () => {
  expect(a.addDays("2024-02-28", 1)).toBe("2024-02-29");
  expect(a.calendarDaysBetween("2026-03-07", "2026-03-09")).toBe(2);
  expect(a.addDays("2026-11-01", 1)).toBe("2026-11-02");
  expect(a.weekday("2026-03-08")).toBe(7);
  expect(a.weekday("2026-03-09")).toBe(1);
  expect(a.mondayAnchor("2026-03-08")).toBe("2026-03-02");
  expect(a.weekday("1900-01-01")).toBe(1);
});
test("week anchor must be Monday and not after the date", () => {
  expect(() => a.weekIndex("2026-03-03", "2026-03-09")).toThrow();
  expect(() => a.weekIndex("2026-03-09", "2026-03-02")).toThrow();
});
test("parity stays semester-relative after a version boundary", () => {
  expect(a.weekIndex("2026-03-02", "2026-03-09")).toBe(2);
  expect(a.expandDay(schedule(), "2026-03-02").occurrences[0].key).toBe(
    "slot:s1:2026-03-02",
  );
  expect(
    a.expandDay(schedule(), "2026-03-09").occurrences.map((r) => r.key),
  ).toEqual(["slot:s2:2026-03-09"]);
  expect(
    a.expandDay(schedule(), "2026-03-16").occurrences.map((r) => r.key),
  ).toEqual(["slot:s3:2026-03-16"]);
});
test("semester boundaries are inclusive and outside is read-only", () => {
  expect(a.expandDay(schedule(), "2026-03-01").outside).toBe(true);
  expect(a.expandDay(schedule(), "2026-03-23").occurrences).toEqual([]);
  expect(a.expandDay(schedule(), "2026-03-22").outside).toBe(false);
});
test("a timetable gap differs from no classes", () => {
  const s = schedule();
  s.versions = [];
  expect(a.expandDay(s, "2026-03-09").configured).toBe(false);
  expect(a.expandDay(schedule(), "2026-03-10").configured).toBe(true);
});
test("overlapping versions reject", () => {
  const s = schedule();
  s.versions[0].effectiveUntil = null;
  expect(() => a.expandDay(s, "2026-03-09")).toThrow("Overlapping");
});
test("holidays union without double subtraction and respect subject scope", () => {
  const s = schedule();
  s.holidays = [
    { subjectId: "sub1", startsOn: "2026-03-09", endsOn: "2026-03-09" },
    { subjectId: "sub1", startsOn: "2026-03-08", endsOn: "2026-03-10" },
  ];
  expect(a.expandDay(s, "2026-03-09").occurrences).toEqual([]);
  expect(a.expandDay(s, "2026-03-09").holiday).toBe(false);
  expect(a.expandDay(s, "2026-03-16").occurrences).toHaveLength(1);
  s.holidays.push({
    subjectId: null,
    startsOn: "2026-03-02",
    endsOn: "2026-03-22",
  });
  expect(a.expandDay(s, "2026-03-16").holiday).toBe(true);
  expect(a.remainingUnits(s, s.startsOn, s.endsOn)).toBe(0);
});
test("extras add to slots, ignore parity and configuration, and respect cancellation", () => {
  const s = schedule();
  s.extras = [
    {
      id: "e1",
      subjectId: "sub1",
      onDate: "2026-03-09",
      countsAs: 2,
      cancelledAt: null,
      allowOnHoliday: false,
    },
    {
      id: "e2",
      subjectId: "sub1",
      onDate: "2026-03-09",
      countsAs: 1,
      cancelledAt: 1,
      allowOnHoliday: true,
    },
  ];
  expect(a.expandDay(s, "2026-03-09").occurrences).toHaveLength(2);
  s.versions = [];
  expect(a.expandDay(s, "2026-03-09").occurrences).toHaveLength(1);
  s.holidays = [
    { subjectId: null, startsOn: "2026-03-09", endsOn: "2026-03-09" },
  ];
  expect(a.expandDay(s, "2026-03-09").occurrences).toHaveLength(0);
  s.extras[0].allowOnHoliday = true;
  expect(a.expandDay(s, "2026-03-09").occurrences[0].key).toBe("extra:e1");
});
test("recorded snapshots overlay once and retain excluded history", () => {
  const s = schedule(),
    snapshot: a.Occurrence = {
      key: "slot:s2:2026-03-09",
      subjectId: "sub1",
      countsAs: 5,
      status: "present",
    };
  expect(a.expandDay(s, "2026-03-09", [snapshot]).occurrences).toEqual([
    snapshot,
  ]);
  s.holidays = [
    { subjectId: null, startsOn: "2026-03-09", endsOn: "2026-03-09" },
  ];
  expect(
    a.expandDay(s, "2026-03-09", [{ ...snapshot, status: "neutral" }])
      .occurrences,
  ).toHaveLength(1);
});
test("remaining capacity respects weights and reverse ranges", () => {
  expect(a.remainingUnits(schedule(), "2026-03-02", "2026-03-22")).toBe(4);
  expect(a.remainingUnits(schedule(), "2026-03-22", "2026-03-02")).toBe(0);
});
test("superseded versions and cloned slots preserve one frozen occurrence", () => {
  const s = schedule();
  s.versions.push({ id: "archived", effectiveFrom: "2026-03-02", effectiveUntil: null, supersededAt: 1 });
  s.slots.push({ ...s.slots[1], id: "original", versionId: "archived" });
  s.slots[1].lineageId = "original";
  const snapshot: a.Occurrence = { key: "slot:original:2026-03-09", subjectId: "sub1", countsAs: 4, status: "present" };
  expect(a.expandDay(s, "2026-03-09", [snapshot]).occurrences).toEqual([snapshot]);
  s.slots[2].lineageId = "unrelated";
  expect(a.expandDay(s, "2026-03-16", [{ key: "extra:historical", subjectId: "sub1", countsAs: 1 }]).occurrences).toHaveLength(2);
});
