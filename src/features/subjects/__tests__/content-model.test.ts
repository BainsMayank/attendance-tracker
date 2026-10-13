import {
  completion,
  deadlineLabel,
  formatSelection,
  linkKind,
  localParts,
  noteLines,
  plainNote,
  timerSnapshot,
  toggleChecklist,
  validatedURL,
  weeklyStudyMinutes,
  zonedInstant,
  type TimerRow,
} from "../content-model";

test("completion is topic-weighted and empty syllabus is undefined", () => {
  expect(completion([])).toEqual({ done: 0, total: 0, percent: null });
  expect(
    completion([
      { completedAt: 1 },
      { completedAt: null },
      { completedAt: null },
    ]).percent,
  ).toBeCloseTo(100 / 3);
});
test("deadline chips distinguish due now, near deadlines, overdue and complete", () => {
  expect(deadlineLabel(100000, null, 100000)).toBe("Due now");
  expect(deadlineLabel(100001, null, 100000)).toBe("Due in <1m");
  expect(deadlineLabel(1, null, 60001)).toBe("Overdue · 1m");
  expect(deadlineLabel(86400000, null, 0)).toBe("Due in 1d");
  expect(deadlineLabel(1, 0, 999999)).toBe("Done");
});
test.each([
  ["https://youtu.be/abc", "youtube"],
  ["https://m.youtube.com/watch?v=a", "youtube"],
  ["https://youtube.com.evil.test", "web"],
  ["https://drive.google.com/file/d/id", "drive"],
  ["https://docs.google.com/document/d/id", "drive"],
  ["https://example.com/a.PDF?download=1#page=2", "pdf"],
  ["https://example.com/a%2Epdf", "pdf"],
  ["https://example.com/bad%ZZ", "web"],
  ["bad URL", "web"],
])("link icon detection handles %s", (url, expected) =>
  expect(linkKind(url)).toBe(expected),
);
test.each([
  "javascript:alert(1)",
  "file:///etc/passwd",
  "https://user:password@example.com",
  "example.com",
  "",
])("unsafe or incomplete link rejects: %s", (url) =>
  expect(() => validatedURL(url)).toThrow(),
);
test("formatting uses the selection and preserves surrounding content", () => {
  expect(
    formatSelection("hello world", { start: 6, end: 11 }, "bold").body,
  ).toBe("hello **world**");
  expect(
    formatSelection("one\ntwo\nthree", { start: 1, end: 6 }, "bullet").body,
  ).toBe("- one\n- two\nthree");
  expect(
    formatSelection("- one\n- two", { start: 0, end: 11 }, "check").body,
  ).toBe("- [ ] one\n- [ ] two");
  expect(formatSelection("", { start: 0, end: 0 }, "bold").selection).toEqual({
    start: 2,
    end: 11,
  });
});
test("plain notes, bold, bullet and checklist text round trip with targeted toggles", () => {
  const body = "plain\n- **bold**\n- [ ] read\n- [X] write";
  expect(noteLines(body).map((l) => l.type)).toEqual([
    "text",
    "bullet",
    "check",
    "check",
  ]);
  expect(plainNote(body)).toBe("plain bold read write");
  expect(toggleChecklist(body, 2)).toBe(
    "plain\n- **bold**\n- [x] read\n- [X] write",
  );
  expect(toggleChecklist(body, 3)).toBe(
    "plain\n- **bold**\n- [ ] read\n- [ ] write",
  );
  expect(toggleChecklist(body, 0)).toBe(body);
});
test("academic date/time conversion uses the semester timezone", () => {
  const instant = zonedInstant("2026-10-12", 9 * 60 + 30, "Asia/Kolkata");
  expect(new Date(instant).toISOString()).toBe("2026-10-12T04:00:00.000Z");
  expect(localParts(instant, "Asia/Kolkata")).toEqual({
    date: "2026-10-12",
    minute: 570,
  });
});
test("DST gaps reject and repeated times choose the earlier occurrence", () => {
  expect(() => zonedInstant("2026-03-08", 150, "America/New_York")).toThrow(
    "does not exist",
  );
  expect(
    new Date(zonedInstant("2026-11-01", 90, "America/New_York")).toISOString(),
  ).toBe("2026-11-01T05:30:00.000Z");
  expect(() => zonedInstant("2026-02-30", 120, "Asia/Kolkata")).toThrow();
  expect(() => zonedInstant("2026-10-12", 1440, "Asia/Kolkata")).toThrow();
});
const timer: TimerRow = {
  state: "running",
  phase: "focus",
  plannedFocusSeconds: 1500,
  plannedBreakSeconds: 300,
  activeSeconds: 60,
  phaseStartedAt: 0,
  checkpointAt: 60000,
};
test("timestamp recovery caps background focus at its phase boundary", () => {
  expect(timerSnapshot(timer, 120000)).toMatchObject({
    remaining: 1380,
    activeSeconds: 120,
  });
  expect(timerSnapshot(timer, 99999999)).toMatchObject({
    remaining: 0,
    activeSeconds: 1500,
  });
});
test("paused and break phases never add focus; reversed clocks never add time", () => {
  expect(timerSnapshot({ ...timer, state: "paused" }, 99999999)).toMatchObject({
    remaining: 1440,
    activeSeconds: 60,
  });
  expect(timerSnapshot({ ...timer, phase: "break" }, 99999999)).toMatchObject({
    remaining: 0,
    activeSeconds: 60,
  });
  expect(timerSnapshot(timer, 50000)).toMatchObject({
    clockAnomaly: true,
    activeSeconds: 60,
  });
});
test("weekly totals count completed focus by local start date, including cross-midnight sessions", () => {
  const row = (iso: string, activeSeconds: number, state = "completed") => ({
    startedAt: Date.parse(iso),
    activeSeconds,
    state,
  });
  expect(
    weeklyStudyMinutes(
      [
        row("2026-10-11T18:29:00Z", 600), // Sunday in Kolkata; excluded
        row("2026-10-11T18:30:00Z", 600), // Monday midnight
        row("2026-10-18T18:29:00Z", 1200), // Sunday, counted by start
        row("2026-10-18T18:30:00Z", 600), // next Monday, excluded
        row("2026-10-12T12:00:00Z", 600, "running"),
        row("2026-10-12T12:00:00Z", 600, "discarded"),
      ],
      Date.parse("2026-10-12T00:00:00Z"),
      "Asia/Kolkata",
    ),
  ).toBe(30);
});
