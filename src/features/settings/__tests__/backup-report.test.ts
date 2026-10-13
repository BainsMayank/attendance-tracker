import { strToU8, zipSync } from "fflate";
import { decodeBackup } from "../backup-archive";
import { parseAppBackup, MAX_FILES, MAX_JSON } from "../backup-model";
import { attendanceCSV, attendanceReport } from "../report-model";
import { backupFixture, id, meta } from "./fixtures";
test("JSON and ZIP are versioned, strict and reject runtime settings and invented columns", () => {
  const backup = backupFixture();
  expect(decodeBackup(strToU8(JSON.stringify(backup)), false).backup).toEqual(
    backup,
  );
  expect(
    decodeBackup(
      zipSync({
        "backup.json": strToU8(
          JSON.stringify({ ...backup, attachments: "zip" }),
        ),
      }),
      true,
    ).backup.attachments,
  ).toBe("zip");
  expect(() => parseAppBackup({ ...backup, version: 2 })).toThrow();
  expect(() =>
    parseAppBackup({ ...backup, preferences: { appLock: true } }),
  ).toThrow("Unsupported");
  expect(() =>
    parseAppBackup({ ...backup, preferences: { reminderRules: {} } }),
  ).toThrow();
  expect(() =>
    parseAppBackup({
      ...backup,
      rows: {
        ...backup.rows,
        subjects: [{ ...backup.rows.subjects[0], unknown: true }],
      },
    }),
  ).toThrow();
  expect(() =>
    parseAppBackup({
      ...backup,
      rows: {
        ...backup.rows,
        subjects: [backup.rows.subjects[0], backup.rows.subjects[0]],
      },
    }),
  ).toThrow("Duplicate");
});
test("unsafe paths, extra ZIP entries, wrong containers and missing inventory are rejected", () => {
  const backup = backupFixture();
  const json = strToU8(JSON.stringify({ ...backup, attachments: "zip" }));
  expect(() =>
    decodeBackup(
      zipSync({ "backup.json": json, "../secret": strToU8("bad") }),
      true,
    ),
  ).toThrow("Unsafe");
  expect(() =>
    decodeBackup(
      zipSync({ "backup.json": json, [`files/${id(8)}`]: strToU8("bad") }),
      true,
    ),
  ).toThrow("inventory");
  expect(() =>
    decodeBackup(
      zipSync({ "backup.json": strToU8(JSON.stringify(backup)) }),
      true,
    ),
  ).toThrow("format");
  expect(() => decodeBackup(zipSync({}), true)).toThrow("no backup");
  expect(() => decodeBackup(new Uint8Array(MAX_JSON + 1), false)).toThrow(
    "20 MiB",
  );
  expect(() =>
    decodeBackup(
      zipSync({ "backup.json": new Uint8Array(MAX_JSON + 1) }),
      true,
    ),
  ).toThrow("Expanded");
});
test("duplicate ZIP manifests are rejected instead of accepting a silently overwritten entry", () => {
  const json = strToU8(
    JSON.stringify({ ...backupFixture(), attachments: "zip" }),
  );
  const bytes = zipSync(
    { "backup.json": json, "backuq.json": json },
    { level: 0 },
  );
  const from = strToU8("backuq.json"),
    to = strToU8("backup.json");
  for (let i = 0; i <= bytes.length - from.length; i++)
    if (from.every((value, offset) => bytes[i + offset] === value))
      bytes.set(to, i);
  expect(() => decodeBackup(bytes, true)).toThrow("Duplicate ZIP");
});
test("attachment manifests are bounded, unavailable bytes stay explicit, complete ZIP inventory is required", () => {
  const backup = backupFixture();
  const file = {
    ...meta,
    id: id(8),
    semesterId: id(1),
    subjectId: id(2),
    folderId: null,
    name: "Notes",
    mimeType: "text/plain",
    relativePath: `files/${id(8)}`,
    sizeBytes: 3,
    sha256: "a".repeat(64),
    state: "ready" as const,
    sourceName: "notes.txt",
  };
  backup.rows.files = [file];
  expect(parseAppBackup(backup).rows.files).toEqual([file]);
  expect(() =>
    decodeBackup(
      zipSync({
        "backup.json": strToU8(
          JSON.stringify({ ...backup, attachments: "zip" }),
        ),
      }),
      true,
    ),
  ).toThrow("inventory");
  expect(() =>
    parseAppBackup({
      ...backup,
      rows: { ...backup.rows, files: [{ ...file, relativePath: "../secret" }] },
    }),
  ).toThrow();
  expect(() =>
    parseAppBackup({
      ...backup,
      attachments: "zip",
      rows: { ...backup.rows, files: [{ ...file, sizeBytes: MAX_FILES + 1 }] },
    }),
  ).toThrow();
});
test("CSV handles quotes, newlines, formula injection, signed numeric adjustments and timezone", () => {
  const backup = backupFixture();
  const rows = backup.rows;
  rows.subjects[0].name = '=HYPERLINK("bad")\nMath';
  rows.attendanceRecords = [
    {
      ...meta,
      id: id(9),
      semesterId: id(1),
      subjectId: id(2),
      kind: "adjustment",
      onDate: "2026-01-05",
      occurrenceKey: null,
      slotId: null,
      extraClassId: null,
      room: null,
      source: "manual",
      status: null,
      classTypeId: null,
      classTypeName: null,
      startMinute: null,
      endMinute: null,
      countsAs: null,
      attendedDelta: -1,
      heldDelta: -1,
      reason: "Correct, balance",
    },
  ];
  const csv = attendanceCSV(rows);
  expect(csv).toContain('"\'=HYPERLINK(""bad"")\nMath"');
  expect(csv).toContain('"-1","-1","Correct, balance"');
  expect(csv).toContain('"Asia/Kolkata"');
  expect(csv.endsWith("\r\n")).toBe(true);
});
test("PDF HTML escapes user text and reports weighted balances and physical session counts separately", () => {
  const rows = backupFixture().rows;
  rows.semesters[0].name = "<script>alert(1)</script>";
  rows.attendanceRecords = [
    {
      ...meta,
      id: id(9),
      semesterId: id(1),
      subjectId: id(2),
      kind: "occurrence",
      onDate: "2026-01-05",
      occurrenceKey: "slot:a:2026-01-05",
      slotId: id(5),
      extraClassId: null,
      room: null,
      source: "manual",
      status: "present",
      classTypeId: id(3),
      classTypeName: "Lab",
      startMinute: 540,
      endMinute: 600,
      countsAs: 2,
      attendedDelta: 2,
      heldDelta: 2,
      reason: null,
    },
  ];
  const html = attendanceReport(rows, Date.parse("2026-01-06T12:00:00Z"));
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("2 attended / 2 held");
  expect(html).toContain("100.0%");
  expect(html).toContain("<td>2026-01</td><td>1</td><td>0</td>");
  expect(html).toContain("unmarked classes remain pending");
});
