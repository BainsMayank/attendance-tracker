import { readFileSync } from "node:fs";
import { IMPORT_PROMPT } from "../prompt";
import {
  normalizeDay,
  normalizeTime,
  parseImport,
  withoutSlot,
} from "../parser";

const timetable = () => ({
  formatVersion: 1,
  subjects: [{ name: "Data Structures" }],
  slots: [{ subject: "Data Structures", day: "Monday", start: "9", end: "10" }],
});
test("the copied prompt is exactly the documented prompt", () => {
  const doc = readFileSync("docs/IMPORT_FORMAT.md", "utf8");
  expect(doc.match(/```text\n([\s\S]*?)\n```/)?.[1]).toBe(IMPORT_PROMPT);
});
test.each(["9", "9:00", "09:00 AM", "9 AM"])("normalizes %s", (time) => {
  expect(normalizeTime(time)).toEqual({ text: "09:00", minute: 540 });
});
test("handles noon, midnight, and end of day", () => {
  expect(normalizeTime("12 AM").text).toBe("00:00");
  expect(normalizeTime("12 PM").text).toBe("12:00");
  expect(normalizeTime("1:15 pm").minute).toBe(795);
  expect(normalizeTime("24:00", true).minute).toBe(1440);
  expect(() => normalizeTime("24:00")).toThrow("invalid time");
});
test.each(["9:5", "13 PM", "0 AM", "09:60", "25", "-1", "9.00", "09:00:00"])(
  "rejects invalid time %s",
  (time) => expect(() => normalizeTime(time)).toThrow("invalid time"),
);
test.each(["Monday", "mon", "MON.", " monday "])("normalizes day %s", (day) =>
  expect(normalizeDay(day)).toBe(1),
);
test("extracts fenced JSON and surrounding prose without corrupting string braces", () => {
  const input = {
    ...timetable(),
    subjects: [{ name: 'Math {advanced} "A"' }],
    slots: [{ ...timetable().slots[0], subject: 'Math {advanced} "A"' }],
  };
  expect(
    parseImport(
      `Here is your timetable:\n\`\`\`json\n${JSON.stringify(input)}\n\`\`\`\nReview it carefully.`,
    ).subjects[0].name,
  ).toBe(input.subjects[0].name);
});
test("merges case, Unicode and whitespace variants and fills metadata", () => {
  const input = {
    ...timetable(),
    subjects: [
      { name: " Data  Structures " },
      { name: "Ｄata structures", code: "CS101" },
    ],
    slots: [{ ...timetable().slots[0], subject: "data\n structures" }],
  };
  const result = parseImport(JSON.stringify(input));
  expect(result.subjects).toEqual([{ name: "Data Structures", code: "CS101" }]);
  expect(result.slots[0]).toMatchObject({
    subject: "Data Structures",
    start: "09:00",
    end: "10:00",
    weekday: 1,
    countsAs: 1,
    weekPattern: "every",
    classType: "Lecture",
  });
});
test("ignores braces belonging to surrounding prose", () => {
  expect(
    parseImport(
      `Here is {the result}: ${JSON.stringify(timetable())} Review {notes}`,
    ).slots,
  ).toHaveLength(1);
  expect(
    parseImport(`${JSON.stringify(timetable())} A note {continues`).slots,
  ).toHaveLength(1);
});
test("rejects conflicting duplicate subject metadata", () => {
  const input = {
    ...timetable(),
    subjects: [
      { name: "Data Structures", code: "CS1" },
      { name: "data structures", code: "CS2" },
    ],
  };
  expect(() => parseImport(JSON.stringify(input))).toThrow(
    "Subject 2: conflicting code",
  );
});
test("names the exact reversed slot", () => {
  const slot = timetable().slots[0];
  expect(() =>
    parseImport(
      JSON.stringify({
        ...timetable(),
        slots: [slot, slot, slot, { ...slot, end: "8" }],
      }),
    ),
  ).toThrow("Slot 4: end time before start");
});
test.each([
  [
    "equal times",
    { slots: [{ ...timetable().slots[0], end: "9" }] },
    "Slot 1: end time equals start",
  ],
  [
    "unknown day",
    { slots: [{ ...timetable().slots[0], day: "Funday" }] },
    "Slot 1: unknown day",
  ],
  [
    "unknown subject",
    { slots: [{ ...timetable().slots[0], subject: "Physics" }] },
    'subject "Physics" is missing',
  ],
  ["unknown top key", { attendance: [] }, "Unrecognized key"],
  ["format version", { formatVersion: 2 }, "formatVersion"],
  ["empty subjects", { subjects: [] }, "subjects"],
  ["empty slots", { slots: [] }, "slots"],
  [
    "invalid weight",
    { slots: [{ ...timetable().slots[0], countsAs: 0 }] },
    "Slot 1 (countsAs)",
  ],
  [
    "fraction weight",
    { slots: [{ ...timetable().slots[0], countsAs: 1.5 }] },
    "Slot 1 (countsAs)",
  ],
  [
    "unknown slot key",
    { slots: [{ ...timetable().slots[0], id: "secret" }] },
    "Slot 1",
  ],
  [
    "null default",
    { slots: [{ ...timetable().slots[0], classType: null }] },
    "Slot 1 (classType)",
  ],
])("rejects %s", (_, patch, message) =>
  expect(() =>
    parseImport(JSON.stringify({ ...timetable(), ...(patch as object) })),
  ).toThrow(String(message)),
);
test.each([
  ["", "Paste the JSON"],
  ["No timetable", "No complete JSON"],
  ['{"slots":', "No complete JSON"],
  ['{"formatVersion":1,}', "malformed"],
  [
    JSON.stringify(timetable()) + "\n" + JSON.stringify(timetable()),
    "More than one",
  ],
  [JSON.stringify([timetable()]), "Timetable"],
  ["x".repeat(512001), "too large"],
])("rejects unsafe/incomplete input", (input, message) =>
  expect(() => parseImport(input)).toThrow(message),
);
test("withoutSlot drops one misread class and keeps the rest of the reply", () => {
  const two = {
    ...timetable(),
    slots: [
      { subject: "Data Structures", day: "Monday", start: "9", end: "10" },
      { subject: "Data Structures", day: "Monday", start: "9:30", end: "11" },
    ],
  };
  const raw = `Here you go:\n${JSON.stringify(two)}`;
  const kept = parseImport(withoutSlot(raw, 2));
  expect(kept.slots).toHaveLength(1);
  expect(kept.slots[0].startMinute).toBe(540);
  expect(kept.subjects).toEqual(two.subjects);
  expect(() => withoutSlot(raw, 3)).toThrow("no longer");
});
test("curly quotes from smart punctuation are read as JSON quotes", () => {
  const curly = JSON.stringify(timetable()).replace(/"/g, (_, i: number) =>
    i % 2 ? "”" : "“",
  );
  expect(parseImport(curly).slots).toHaveLength(1);
  // Straight-quoted JSON keeps curly quotes inside values untouched.
  const quoted = timetable();
  quoted.subjects[0].name = "Data “Structures”";
  quoted.slots[0].subject = "Data “Structures”";
  expect(parseImport(JSON.stringify(quoted)).subjects[0].name).toBe(
    "Data “Structures”",
  );
});
