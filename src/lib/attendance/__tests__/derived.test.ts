import * as a from "..";
const day = (statuses: a.Occurrence["status"][], weights?: number[]) => ({
  configured: true,
  outside: false,
  holiday: false,
  occurrences: statuses.map((status, i) => ({
    key: String(i),
    subjectId: "s",
    countsAs: weights?.[i] ?? 1,
    status,
  })),
});
test.each([
  [[undefined], "pending"],
  [["present", "absent"], "mixed"],
  [["present"], "present"],
  [["absent"], "absent"],
  [["neutral"], "neutral"],
  [[], "noClasses"],
] as [a.Occurrence["status"][], string][])(
  "day outcomes %j give %s",
  (statuses, expected) =>
    expect(a.daySummary(day(statuses)).status).toBe(expected),
);
test("day precedence: outside, gap, pending, then counted outcomes", () => {
  expect(a.daySummary({ ...day([undefined]), outside: true }).status).toBe(
    "outsideSemester",
  );
  expect(a.daySummary({ ...day(["present"]), configured: false }).status).toBe(
    "unconfigured",
  );
  expect(a.daySummary(day(["present", undefined])).status).toBe("pending");
  expect(a.daySummary({ ...day([]), holiday: true }).status).toBe("holiday");
  expect(a.daySummary({ ...day(["present"]), holiday: true }).status).toBe(
    "present",
  );
});
test("day completeness counts sessions; percentage counts weighted units", () => {
  const summary = a.daySummary(
    day(["present", "absent", "neutral"], [2, 1, 5]),
  );
  expect(summary).toMatchObject({ logged: 3, expected: 3 });
  expect(summary.percentage).toBeCloseTo(200 / 3);
  expect(a.daySummary(day(["neutral"])).percentage).toBeNull();
});
test("topic completion is weighted by topic count, zero topics undefined", () => {
  expect(a.syllabusCompletion(2, 3)).toBeCloseTo(200 / 3);
  expect(a.syllabusCompletion(0, 0)).toBeNull();
});
test("unweighted marks exclude ungraded maxima", () => {
  expect(
    a.marksPercentage(
      [
        { earned: 5, maximum: 10, weightBps: null },
        { earned: null, maximum: 100, weightBps: null },
      ],
      "unweighted",
    ),
  ).toMatchObject({ percentage: 50, graded: 1, total: 2 });
});
test("weighted marks report partial coverage", () => {
  expect(
    a.marksPercentage(
      [
        { earned: 8, maximum: 10, weightBps: 2000 },
        { earned: 5, maximum: 10, weightBps: 3000 },
        { earned: null, maximum: 20, weightBps: 5000 },
      ],
      "weighted",
    ),
  ).toMatchObject({ percentage: 62, gradedWeightBps: 5000 });
  expect(a.marksPercentage([], "weighted").percentage).toBeNull();
  expect(
    a.marksPercentage([{ earned: 1, maximum: 2, weightBps: 0 }], "weighted")
      .percentage,
  ).toBeNull();
});
test.each([
  { earned: 11, maximum: 10, weightBps: null },
  { earned: -1, maximum: 10, weightBps: null },
  { earned: NaN, maximum: 10, weightBps: null },
  { earned: 0, maximum: 0, weightBps: null },
  { earned: 0, maximum: Infinity, weightBps: null },
  { earned: 0, maximum: 10, weightBps: 10001 },
])("invalid marks reject %j", (mark) =>
  expect(() => a.marksPercentage([mark], "unweighted")).toThrow(),
);
test("weighted and missing weights cannot silently mix; total weights bounded", () => {
  expect(() =>
    a.marksPercentage([{ earned: 1, maximum: 2, weightBps: null }], "weighted"),
  ).toThrow();
  expect(() =>
    a.marksPercentage(
      [
        { earned: 1, maximum: 2, weightBps: 6000 },
        { earned: null, maximum: 2, weightBps: 6000 },
      ],
      "weighted",
    ),
  ).toThrow();
});
test("deadline due-now is not overdue, completion suppresses overdue", () => {
  expect(a.overdue(100, null, 101)).toBe(true);
  expect(a.overdue(100, null, 100)).toBe(false);
  expect(a.overdue(100, 101, 200)).toBe(false);
  expect(() => a.overdue(NaN, null, 100)).toThrow();
});
test("study totals include completed active focus only", () =>
  expect(
    a.studyMinutes([
      { state: "completed", activeSeconds: 90 },
      { state: "discarded", activeSeconds: 60 },
      { state: "paused", activeSeconds: 60 },
      { state: "running", activeSeconds: 60 },
    ]),
  ).toBe(1.5));
test("storage includes ready files only", () =>
  expect(
    a.storageBytes([
      { state: "ready", sizeBytes: 1024 },
      { state: "missing", sizeBytes: 100 },
      { state: "staged", sizeBytes: 200 },
    ]),
  ).toBe(1024));
test("status band is exact and always red below target", () => {
  expect(a.attendanceStatus(0, 0, 7500)).toBe("noData");
  expect(a.attendanceStatus(74, 100, 7500)).toBe("below");
  expect(a.attendanceStatus(75, 100, 7500)).toBe("warning");
  expect(a.attendanceStatus(78, 100, 7500)).toBe("warning");
  expect(a.attendanceStatus(79, 100, 7500)).toBe("safe");
  expect(() => a.attendanceStatus(1, 1, 10001)).toThrow();
});
