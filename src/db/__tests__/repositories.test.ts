import {
  captureAppBackup,
  appFingerprint,
  validateAppRestore,
  restoreAppRows,
} from "../repositories/app-backup";
import { performance as nodePerformance } from "node:perf_hooks";
import { importTimetable } from "../repositories/timetable-import";
import {
  prepareSetup,
  saveSetupDraft,
  finishSetup,
} from "../repositories/onboarding";
import { parseImport } from "@/features/timetable/import/parser";
import { buildImportPreview } from "@/features/timetable/import/preview";
import type { OnboardingDraft } from "@/features/onboarding/model";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import type { SQLiteDatabase } from "expo-sqlite";
import type { Database } from "../client";
import * as s from "../schema";
import migrations from "../migrations/migrations";
import {
  subjectsRepository,
  extraClassesRepository,
  semestersRepository,
  timetableSlotsRepository,
  timetableVersionsRepository,
  classTypesRepository,
  attendanceRecordsRepository,
  settingsRepository,
  markOccurrence,
  resetOccurrence,
  write,
  StaleRevisionError,
  foldersRepository,
  filesRepository,
  notesRepository,
  unitsRepository,
  topicsRepository,
  holidaysRepository,
} from "../repositories";
import { demoCounts, loadDemoData } from "../demo";
import { validateDatabase } from "../validation";
import {
  deleteContent,
  orderFingerprint,
  reorderContent,
  saveContent,
  subjectContent,
} from "../repositories/subject-content";
import {
  startStudy,
  studyData,
  updateStudy,
} from "../repositories/study-timer";
import {
  completion,
  timerSnapshot,
  weeklyStudyMinutes,
} from "@/features/subjects/content-model";
import {
  saveTimetable,
  scheduleFingerprint,
  timetableData,
  ensureClassTypes,
} from "../repositories/timetable-commands";
import { selectVersion } from "@/lib/timetable";
import { expandDay } from "@/lib/attendance";
import {
  addExtraClass,
  dayFingerprint,
  logRange,
  markAllPresent,
  markClass,
  saveClassNote,
  subjectTotals,
  toggleDayHoliday,
} from "../repositories/daily-log";
import { resolveDay } from "@/lib/daily-log";
import {
  semesterRows,
  semesterFingerprint,
} from "../repositories/semester-data";
import {
  startNewSemester,
  resetSemester,
  clearSemesterAttendance,
  saveSemester,
  addSemesterHoliday,
  removeSemesterHoliday,
} from "../repositories/semester-commands";
import { restoreSemesterBackup } from "../repositories/semester-restore";
import { parseSemesterBackup } from "@/features/semesters/backup-model";
import {
  adjustSubject,
  changeSubject,
  subjectsData,
} from "../repositories/subject-attendance";
let mockDb: Database;
let sqlite: DatabaseSync;
jest.mock("../client", () => ({ getDatabase: () => mockDb }));
jest.mock("expo-crypto", () => ({
  randomUUID: () =>
    jest
      .requireActual<typeof import("node:crypto")>("node:crypto")
      .randomUUID(),
}));

beforeAll(() => jest.useFakeTimers({ now: new Date("2026-10-11T12:00:00Z") }));
afterAll(() => jest.useRealTimers());

beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  // Exercise the actual Expo Drizzle adapter against SQLite's native engine. Only
  // the native statement transport is replaced; SQL, transactions and mapping run unchanged.
  const client = {
    prepareSync: (query: string) => {
      const statement = sqlite.prepare(query);
      return {
        executeSync: (params: SQLInputValue[]) => {
          const hasRows = statement.columns().length > 0;
          const rows = hasRows ? statement.all(...params) : [];
          const result = hasRows
            ? { changes: 0, lastInsertRowid: 0 }
            : statement.run(...params);
          return {
            changes: Number(result.changes),
            lastInsertRowId: Number(result.lastInsertRowid),
            getAllSync: () => rows,
            getFirstSync: () => rows[0],
          };
        },
        executeForRawResultSync: (params: SQLInputValue[]) => {
          statement.setReturnArrays(true);
          const rows = statement.all(...params);
          return { getAllSync: () => rows };
        },
      };
    },
  };
  mockDb = drizzle(client as unknown as SQLiteDatabase, { schema: s });
  await migrate(mockDb, migrations);
});
afterEach(() => sqlite.close());
const semester = () =>
  semestersRepository.create({
    name: "Semester",
    startsOn: "2026-01-05",
    endsOn: "2026-12-31",
    weekAnchor: "2026-01-05",
  });
function fixture() {
  const sem = semester();
  const subject = subjectsRepository.create({
    semesterId: sem.id,
    name: "Math",
    normalizedName: "math",
  });
  const type = classTypesRepository.create({
    semesterId: sem.id,
    name: "Lecture",
    normalizedName: "lecture",
  });
  const version = timetableVersionsRepository.create({
    semesterId: sem.id,
    label: "Week",
    effectiveFrom: sem.startsOn,
  });
  const slot = timetableSlotsRepository.create({
    semesterId: sem.id,
    versionId: version.id,
    subjectId: subject.id,
    classTypeId: type.id,
    weekday: 1,
    startMinute: 540,
    endMinute: 600,
  });
  return { sem, subject, type, version, slot };
}
test("schema is exactly the documented TypeScript block", () => {
  const doc = readFileSync("docs/ARCHITECTURE.md", "utf8")
    .split("```ts\n")[1]
    .split("\n```")[0];
  expect(readFileSync("src/db/schema.ts", "utf8").trim()).toBe(doc.trim());
});
test("fresh migration has all 19 tables, indexes, foreign keys and can rerun", async () => {
  expect(
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'",
      )
      .all(),
  ).toHaveLength(19);
  expect(
    sqlite.prepare("PRAGMA foreign_key_list('attendance_records')").all()
      .length,
  ).toBeGreaterThan(5);
  expect(
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='study_one_active_uq'",
      )
      .all(),
  ).toHaveLength(1);
  await migrate(mockDb, migrations);
  expect(semestersRepository.list()).toEqual([]);
});
test("typed create/get/list/update and stale revisions", () => {
  const sem = semester();
  expect(semestersRepository.get(sem.id)).toEqual(sem);
  const updated = semestersRepository.update(sem.id, 1, { name: "Renamed" });
  expect(updated.revision).toBe(2);
  expect(() =>
    semestersRepository.update(sem.id, 1, { name: "Stale" }),
  ).toThrow(StaleRevisionError);
  expect(() => semestersRepository.remove(sem.id, 1)).toThrow(
    StaleRevisionError,
  );
  expect(semestersRepository.list()[0].name).toBe("Renamed");
  semestersRepository.remove(sem.id, 2);
  expect(semestersRepository.list()).toHaveLength(0);
});
test("cross-semester foreign keys and parent deletion reject", () => {
  const { sem, subject, type, version } = fixture(),
    other = semester();
  expect(() =>
    timetableSlotsRepository.create({
      semesterId: other.id,
      versionId: version.id,
      subjectId: subject.id,
      classTypeId: type.id,
      weekday: 2,
      startMinute: 600,
      endMinute: 660,
    }),
  ).toThrow();
  expect(() => semestersRepository.remove(sem.id, 1)).toThrow();
  expect(semestersRepository.get(sem.id)).toBeDefined();
});
test("invalid normalized name, calendar, target, timezone and week anchor reject", () => {
  const sem = semester();
  expect(() =>
    subjectsRepository.create({
      semesterId: sem.id,
      name: "Math",
      normalizedName: "MATH",
    }),
  ).toThrow();
  expect(() =>
    semestersRepository.update(sem.id, 1, { endsOn: "2026-02-30" }),
  ).toThrow();
  expect(() =>
    semestersRepository.update(sem.id, 1, { timezone: "Invalid/Zone" }),
  ).toThrow();
  expect(() =>
    semestersRepository.update(sem.id, 1, { targetBps: 10001 }),
  ).toThrow();
  expect(() =>
    semestersRepository.update(sem.id, 1, { weekAnchor: "2026-01-06" }),
  ).toThrow();
});
test("failed multirow commands roll back the entire transaction", () => {
  expect(() =>
    write((db) => {
      db.insert(s.semesters)
        .values({
          id: "invalid-id",
          name: "Bad",
          startsOn: "2026-01-01",
          endsOn: "2026-12-31",
          weekAnchor: "2025-12-29",
          createdAt: 1,
          updatedAt: 1,
        })
        .run();
    }),
  ).toThrow();
  expect(semestersRepository.list()).toHaveLength(0);
});
test("contiguous versions cannot overlap or have gaps", () => {
  const { sem } = fixture();
  expect(() =>
    timetableVersionsRepository.create({
      semesterId: sem.id,
      label: "Bad",
      effectiveFrom: "2026-02-01",
    }),
  ).toThrow("contiguous");
  expect(timetableVersionsRepository.list()).toHaveLength(1);
});
test("canonical occurrence marking upserts with frozen snapshots and rejects duplicate revisions", () => {
  const { slot, type } = fixture();
  const row = markOccurrence({
    slotId: slot.id,
    onDate: "2026-01-05",
    status: "present",
    expectedRevision: null,
  });
  expect(row?.countsAs).toBe(1);
  const changed = markOccurrence({
    slotId: slot.id,
    onDate: "2026-01-05",
    status: "absent",
    expectedRevision: 1,
  });
  expect(changed?.id).toBe(row?.id);
  expect(changed?.heldDelta).toBe(1);
  expect(attendanceRecordsRepository.list()).toHaveLength(1);
  expect(() =>
    markOccurrence({
      slotId: slot.id,
      onDate: "2026-01-05",
      status: "present",
      expectedRevision: null,
    }),
  ).toThrow(StaleRevisionError);
  classTypesRepository.update(type.id, 1, { defaultCountsAs: 2 });
  expect(attendanceRecordsRepository.get(row!.id)?.countsAs).toBe(1);
  expect(() =>
    timetableSlotsRepository.update(slot.id, 1, { countsAs: 2 }),
  ).toThrow("immutable");
  resetOccurrence(row!.id, 2);
  expect(attendanceRecordsRepository.list()).toHaveLength(0);
});
test("invalid occurrence dates, canonical key and future attendance reject", () => {
  const { slot, subject, sem } = fixture();
  expect(() =>
    markOccurrence({
      slotId: slot.id,
      onDate: "2026-01-06",
      status: "present",
      expectedRevision: null,
    }),
  ).toThrow("timetable");
  expect(() =>
    markOccurrence({
      slotId: slot.id,
      onDate: "2026-12-28",
      status: "present",
      expectedRevision: null,
    }),
  ).toThrow("future");
  expect(() =>
    attendanceRecordsRepository.create({
      semesterId: sem.id,
      subjectId: subject.id,
      kind: "adjustment",
      onDate: "2026-01-05",
      attendedDelta: 1,
      heldDelta: 0,
      reason: "Bad",
    }),
  ).toThrow("prefix");
});
test("reset that breaks a historical prefix rolls back", () => {
  const { slot, sem, subject } = fixture();
  const row = markOccurrence({
    slotId: slot.id,
    onDate: "2026-01-05",
    status: "present",
    expectedRevision: null,
  })!;
  attendanceRecordsRepository.create({
    semesterId: sem.id,
    subjectId: subject.id,
    kind: "adjustment",
    onDate: "2026-01-06",
    attendedDelta: -1,
    heldDelta: -1,
    reason: "Correction",
  });
  expect(() => resetOccurrence(row.id, row.revision)).toThrow("prefix");
  expect(attendanceRecordsRepository.list()).toHaveLength(2);
});
test("folder null-scope uniqueness, same-scope parent and cycles enforced", () => {
  const sem = semester();
  const parent = foldersRepository.create({
    semesterId: sem.id,
    name: "Root",
    normalizedName: "root",
  });
  expect(() =>
    foldersRepository.create({
      semesterId: sem.id,
      name: "Root",
      normalizedName: "root",
    }),
  ).toThrow();
  const child = foldersRepository.create({
    semesterId: sem.id,
    name: "Child",
    normalizedName: "child",
    parentId: parent.id,
  });
  expect(() =>
    foldersRepository.update(parent.id, 1, { parentId: child.id }),
  ).toThrow("cycle");
});
test("notes cannot link a topic from another unit", () => {
  const { subject } = fixture();
  const u1 = unitsRepository.create({ subjectId: subject.id, title: "Unit 1" }),
    u2 = unitsRepository.create({ subjectId: subject.id, title: "Unit 2" });
  const topic = topicsRepository.create({
    subjectId: subject.id,
    unitId: u1.id,
    title: "Topic",
  });
  expect(() =>
    notesRepository.create({
      subjectId: subject.id,
      title: "Note",
      unitId: u2.id,
      topicId: topic.id,
    }),
  ).toThrow("mismatch");
});
test("typed settings reject unknown keys, bad values, stale writes and dangling active semester", () => {
  const row = settingsRepository.set("theme", "dark", null);
  expect(row.value).toBe("dark");
  expect(() => settingsRepository.set("theme", "bad", row.revision)).toThrow();
  expect(() => settingsRepository.set("unknown", true, null)).toThrow();
  settingsRepository.set("theme", "light", 1);
  expect(() => settingsRepository.set("theme", "dark", 1)).toThrow(
    StaleRevisionError,
  );
  expect(() =>
    settingsRepository.set(
      "activeSemesterId",
      "de000000-0000-4000-8000-000000000001",
      null,
    ),
  ).toThrow();
});
test("demo is six subjects, all seven weekdays, three weeks, idempotent and undoable", () => {
  const demo = loadDemoData();
  expect(demo.alreadyLoaded).toBe(false);
  expect(demoCounts()).toEqual({ subjects: 6, slots: 21, records: 63 });
  expect(
    new Set(timetableSlotsRepository.list().map((r) => r.weekday)).size,
  ).toBe(7);
  expect(
    new Set(attendanceRecordsRepository.list().map((r) => r.onDate)).size,
  ).toBe(21);
  expect(loadDemoData().alreadyLoaded).toBe(true);
  validateDatabase(mockDb);
  demo.undo!();
  expect(demoCounts()).toEqual({ subjects: 0, slots: 0, records: 0 });
  expect(settingsRepository.get("activeSemesterId")).toBeUndefined();
});
test("demo keeps existing data and active selection", () => {
  const sem = semester();
  settingsRepository.set("activeSemesterId", sem.id, null);
  const demo = loadDemoData();
  expect(settingsRepository.get("activeSemesterId")?.value).toBe(sem.id);
  demo.undo!();
  expect(semestersRepository.list()).toHaveLength(1);
  expect(settingsRepository.get("activeSemesterId")?.value).toBe(sem.id);
});
test("demo undo rejects changes without deleting anything", () => {
  const demo = loadDemoData(),
    subject = subjectsRepository.list()[0];
  subjectsRepository.update(subject.id, 1, {
    name: "Edited",
    normalizedName: "edited",
  });
  expect(() => demo.undo!()).toThrow("preserved");
  expect(demoCounts().records).toBe(63);
});
test("SQLite CHECK constraints reject invalid row shape independently of repositories", () => {
  const { sem, subject } = fixture();
  expect(() =>
    mockDb
      .insert(s.attendanceRecords)
      .values({
        id: "de000000-0000-4000-8000-000000000999",
        createdAt: 1,
        updatedAt: 1,
        semesterId: sem.id,
        subjectId: subject.id,
        onDate: "2026-01-05",
        kind: "adjustment",
        reason: "",
        attendedDelta: 0,
        heldDelta: 0,
      })
      .run(),
  ).toThrow();
  expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
});

test("schedule conflicts roll back unless the command explicitly records review", () => {
  const { sem, subject, type, version } = fixture();
  const input = {
    semesterId: sem.id,
    versionId: version.id,
    subjectId: subject.id,
    classTypeId: type.id,
    weekday: 1,
    startMinute: 570,
    endMinute: 630,
  };
  expect(() => timetableSlotsRepository.create(input)).toThrow(
    "explicit review",
  );
  expect(timetableSlotsRepository.list()).toHaveLength(1);
  write(
    (db) =>
      db
        .insert(s.timetableSlots)
        .values({
          ...input,
          id: "de000000-0000-4000-8000-000000000888",
          createdAt: 1,
          updatedAt: 1,
        })
        .run(),
    { reviewedScheduleConflicts: true },
  );
  expect(timetableSlotsRepository.list()).toHaveLength(2);
});

test("new occurrence rows must copy the source weight and historical metadata", () => {
  const { slot, subject, type, sem } = fixture();
  expect(() =>
    attendanceRecordsRepository.create({
      semesterId: sem.id,
      subjectId: subject.id,
      kind: "occurrence",
      onDate: "2026-01-05",
      occurrenceKey: `slot:${slot.id}:2026-01-05`,
      slotId: slot.id,
      classTypeId: type.id,
      classTypeName: type.name,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
      countsAs: 2,
      status: "present",
      attendedDelta: 2,
      heldDelta: 2,
    }),
  ).toThrow("source snapshot");
  expect(attendanceRecordsRepository.list()).toHaveLength(0);
});

test("partial unique index allows only one running or paused study session globally", () => {
  const { sem, subject } = fixture();
  const input = {
    semesterId: sem.id,
    subjectId: subject.id,
    createdAt: 1,
    updatedAt: 1,
    startedAt: 1,
    checkpointAt: 1,
    plannedFocusSeconds: 1500,
    state: "running" as const,
  };
  mockDb
    .insert(s.studySessions)
    .values({ ...input, id: "de000000-0000-4000-8000-000000000881" })
    .run();
  expect(() =>
    mockDb
      .insert(s.studySessions)
      .values({
        ...input,
        id: "de000000-0000-4000-8000-000000000882",
        state: "paused",
      })
      .run(),
  ).toThrow();
  mockDb
    .insert(s.studySessions)
    .values({
      ...input,
      id: "de000000-0000-4000-8000-000000000883",
      state: "completed",
      endedAt: 2,
    })
    .run();
  expect(mockDb.select().from(s.studySessions).all()).toHaveLength(2);
});

test("slot and extra creation copy class-type defaults without later propagation", () => {
  const { sem, subject, type, version, slot } = fixture();
  classTypesRepository.update(type.id, 1, { defaultCountsAs: 2 });
  const weighted = timetableSlotsRepository.create({
    semesterId: sem.id,
    subjectId: subject.id,
    classTypeId: type.id,
    versionId: version.id,
    weekday: 2,
    startMinute: 540,
    endMinute: 600,
  });
  const extra = extraClassesRepository.create({
    semesterId: sem.id,
    subjectId: subject.id,
    classTypeId: type.id,
    onDate: "2026-01-07",
    startMinute: 660,
    endMinute: 720,
  });
  expect(weighted.countsAs).toBe(2);
  expect(extra.countsAs).toBe(2);
  classTypesRepository.update(type.id, 2, { defaultCountsAs: 3 });
  expect(timetableSlotsRepository.get(slot.id)?.countsAs).toBe(1);
  expect(timetableSlotsRepository.get(weighted.id)?.countsAs).toBe(2);
  expect(extraClassesRepository.get(extra.id)?.countsAs).toBe(2);
});

test("today version split preserves recorded slots, including attendance already marked today", () => {
  const f = fixture();
  const sunday = timetableSlotsRepository.create({
    semesterId: f.sem.id,
    versionId: f.version.id,
    subjectId: f.subject.id,
    classTypeId: f.type.id,
    weekday: 7,
    startMinute: 540,
    endMinute: 600,
  });
  const past = markOccurrence({
    slotId: f.slot.id,
    onDate: "2026-01-05",
    status: "present",
    expectedRevision: null,
  });
  const today = markOccurrence({
    slotId: sunday.id,
    onDate: "2026-10-11",
    status: "absent",
    expectedRevision: null,
  });
  const before = timetableData(f.sem.id);
  const result = saveTimetable({
    semesterId: f.sem.id,
    expectedFingerprint: scheduleFingerprint(before),
    sourceVersionId: f.version.id,
    slots: before.slots.map((s) => ({
      ...s,
      startMinute: 600,
      endMinute: 660,
    })),
    scope: "today",
  });
  const after = timetableData(f.sem.id);
  expect(result.version.effectiveFrom).toBe("2026-10-11");
  expect(selectVersion(after.versions, "2026-10-10")?.effectiveUntil).toBe(
    "2026-10-11",
  );
  expect(selectVersion(after.versions, "2026-10-11")?.id).toBe(
    result.version.id,
  );
  expect(after.records).toEqual(before.records);
  expect(timetableSlotsRepository.get(f.slot.id)).toEqual(f.slot);
  expect(attendanceRecordsRepository.get(past.id)).toEqual(past);
  const expanded = expandDay(
    { ...f.sem, ...after, extras: [], holidays: [] },
    today.onDate,
    [
      {
        key: today.occurrenceKey!,
        subjectId: today.subjectId,
        countsAs: today.countsAs!,
        status: today.status!,
      },
    ],
  );
  expect(expanded.occurrences).toHaveLength(1);
  expect(expanded.occurrences[0].key).toBe(today.occurrenceKey);
  result.undo();
  expect(
    selectVersion(timetableData(f.sem.id).versions, "2026-10-11")?.id,
  ).toBe(f.version.id);
  expect(attendanceRecordsRepository.get(today.id)).toEqual(today);
});
test("whole-semester version, repeated same-date save, and lineage mark retain immutable snapshots", () => {
  const f = fixture();
  const record = markOccurrence({
    slotId: f.slot.id,
    onDate: "2026-01-05",
    status: "present",
    expectedRevision: null,
  });
  const before = timetableData(f.sem.id);
  const first = saveTimetable({
    semesterId: f.sem.id,
    expectedFingerprint: scheduleFingerprint(before),
    sourceVersionId: f.version.id,
    slots: [{ ...f.slot, startMinute: 660, endMinute: 720 }],
    scope: "semester",
  });
  const middle = timetableData(f.sem.id);
  const draft = middle.slots.filter((s) => s.versionId === first.version.id);
  const second = saveTimetable({
    semesterId: f.sem.id,
    expectedFingerprint: scheduleFingerprint(middle),
    sourceVersionId: first.version.id,
    slots: draft.map((s) => ({ ...s, room: "Lab 2" })),
    scope: "semester",
  });
  expect(second.version.effectiveFrom).toBe(f.sem.startsOn);
  const after = timetableData(f.sem.id);
  expect(after.versions.filter((v) => v.supersededAt === null)).toHaveLength(1);
  expect(attendanceRecordsRepository.get(record.id)).toEqual(record);
  const live = after.slots.find((s) => s.versionId === second.version.id)!;
  expect(() =>
    markOccurrence({
      slotId: live.id,
      onDate: record.onDate,
      status: "absent",
      expectedRevision: null,
    }),
  ).toThrow(StaleRevisionError);
  const changed = markOccurrence({
    slotId: live.id,
    onDate: record.onDate,
    status: "absent",
    expectedRevision: record.revision,
  });
  expect(changed.id).toBe(record.id);
  expect(changed.slotId).toBe(f.slot.id);
  expect(changed.startMinute).toBe(540);
  expect(attendanceRecordsRepository.list()).toHaveLength(1);
  expect(() => second.undo()).toThrow("changed");
  expect(() =>
    markOccurrence({
      slotId: f.slot.id,
      onDate: "2026-01-12",
      status: "present",
      expectedRevision: null,
    }),
  ).toThrow("changed");
});
test("timetable rejects overlap, stale drafts, and missing scope with atomic rollback", () => {
  const f = fixture(),
    before = timetableData(f.sem.id);
  const input = {
    semesterId: f.sem.id,
    expectedFingerprint: scheduleFingerprint(before),
    sourceVersionId: f.version.id,
    slots: [
      { ...f.slot },
      { ...f.slot, id: undefined, startMinute: 590, endMinute: 650 },
    ],
  };
  expect(() => saveTimetable(input)).toThrow("overlaps");
  expect(scheduleFingerprint(timetableData(f.sem.id))).toBe(
    input.expectedFingerprint,
  );
  const record = markOccurrence({
    slotId: f.slot.id,
    onDate: "2026-01-05",
    status: "present",
    expectedRevision: null,
  });
  expect(() => saveTimetable({ ...input, slots: [f.slot] })).toThrow(
    StaleRevisionError,
  );
  expect(() =>
    saveTimetable({
      ...input,
      expectedFingerprint: scheduleFingerprint(timetableData(f.sem.id)),
      slots: [f.slot],
    }),
  ).toThrow("Choose when");
  expect(attendanceRecordsRepository.get(record.id)).toEqual(record);
});
test("default class types are idempotent and subject archive preserves timetable and history", () => {
  const f = fixture();
  const record = markOccurrence({
    slotId: f.slot.id,
    onDate: "2026-01-05",
    status: "present",
    expectedRevision: null,
  });
  const result = ensureClassTypes(f.sem.id);
  expect(result.created).toBe(2);
  expect(ensureClassTypes(f.sem.id).created).toBe(0);
  expect(classTypesRepository.list().map((t) => t.name)).toEqual([
    "Lecture",
    "Lab",
    "Tutorial",
  ]);
  subjectsRepository.update(f.subject.id, f.subject.revision, {
    archivedAt: Date.now(),
    color: "#176640",
  });
  expect(timetableSlotsRepository.get(f.slot.id)).toEqual(f.slot);
  expect(attendanceRecordsRepository.get(record.id)).toEqual(record);
  result.undo();
  expect(classTypesRepository.list()).toHaveLength(1);
});
test("upgrade from foundation migration preserves subject, slot and attendance rows", async () => {
  sqlite.close();
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  await migrate(mockDb, {
    journal: {
      ...migrations.journal,
      entries: migrations.journal.entries.slice(0, 1),
    },
    migrations: { m0000: migrations.migrations.m0000 },
  });
  const id = (n: number) =>
    `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  sqlite
    .prepare(
      "INSERT INTO semesters (id,created_at,updated_at,name,starts_on,ends_on,week_anchor) VALUES (?,1,1,'Semester','2026-01-05','2026-12-31','2026-01-05')",
    )
    .run(id(1));
  sqlite
    .prepare(
      "INSERT INTO subjects (id,created_at,updated_at,semester_id,name,normalized_name) VALUES (?,1,1,?,'Math','math')",
    )
    .run(id(2), id(1));
  sqlite
    .prepare(
      "INSERT INTO class_types (id,created_at,updated_at,semester_id,name,normalized_name) VALUES (?,1,1,?,'Lecture','lecture')",
    )
    .run(id(3), id(1));
  sqlite
    .prepare(
      "INSERT INTO timetable_versions (id,created_at,updated_at,semester_id,label,effective_from) VALUES (?,1,1,?,'Week','2026-01-05')",
    )
    .run(id(4), id(1));
  sqlite
    .prepare(
      "INSERT INTO timetable_slots (id,created_at,updated_at,semester_id,version_id,subject_id,class_type_id,weekday,start_minute,end_minute) VALUES (?,1,1,?,?,?,?,1,540,600)",
    )
    .run(id(5), id(1), id(4), id(2), id(3));
  sqlite
    .prepare(
      "INSERT INTO attendance_records (id,created_at,updated_at,semester_id,subject_id,on_date,kind,occurrence_key,slot_id,class_type_id,class_type_name,start_minute,end_minute,counts_as,status,attended_delta,held_delta) VALUES (?,1,1,?,?,'2026-01-05','occurrence',?,?,?,'Lecture',540,600,1,'present',1,1)",
    )
    .run(id(6), id(1), id(2), `slot:${id(5)}:2026-01-05`, id(5), id(3));
  const frozen = sqlite.prepare("SELECT * FROM attendance_records").all();
  await migrate(mockDb, migrations);
  expect(subjectsRepository.get(id(2))?.color).toBe("#4144D8");
  expect(timetableSlotsRepository.get(id(5))?.teacher).toBeNull();
  expect(sqlite.prepare("SELECT * FROM attendance_records").all()).toEqual(
    frozen,
  );
  validateDatabase(mockDb);
  await migrate(mockDb, migrations);
});

function dayInput(semesterId: string, date = "2026-01-05") {
  return {
    semesterId,
    date,
    expected: dayFingerprint(logRange(semesterId, date, date), date),
  };
}
function firstClass(semesterId: string, date = "2026-01-05") {
  return resolveDay(logRange(semesterId, date, date), date).classes[0];
}
test("Daily Log mark, clear and Undo preserve notes and weighted totals", () => {
  const f = fixture();
  saveClassNote({
    ...dayInput(f.sem.id),
    key: firstClass(f.sem.id).key,
    body: "Bring calculator",
  });
  const mark = markClass({
    ...dayInput(f.sem.id),
    key: firstClass(f.sem.id).key,
    status: "present",
  });
  expect(subjectTotals(f.sem.id, "2026-10-11")[0]).toMatchObject({
    attended: 1,
    held: 1,
  });
  const clear = markClass({
    ...dayInput(f.sem.id),
    key: firstClass(f.sem.id).key,
    status: null,
  });
  expect(firstClass(f.sem.id)).toMatchObject({
    status: null,
    note: { body: "Bring calculator" },
  });
  clear.undo();
  expect(firstClass(f.sem.id).status).toBe("present");
  expect(() => clear.undo()).toThrow("already");
  expect(() => mark.undo()).toThrow("changed");
  validateDatabase(mockDb);
});
test("Daily Log bulk marking is atomic and Undo restores prior outcomes", () => {
  const f = fixture();
  const extra = addExtraClass({
    ...dayInput(f.sem.id),
    subjectId: f.subject.id,
    typeId: f.type.id,
    startMinute: 700,
    endMinute: 760,
    room: "Hall",
    note: "Extra notes",
  });
  markClass({
    ...dayInput(f.sem.id),
    key: firstClass(f.sem.id).key,
    status: "absent",
  });
  const all = markAllPresent(dayInput(f.sem.id));
  expect(subjectTotals(f.sem.id, "2026-10-11")[0]).toMatchObject({
    attended: 2,
    held: 2,
  });
  all.undo();
  expect(firstClass(f.sem.id).status).toBe("absent");
  expect(
    resolveDay(logRange(f.sem.id, "2026-01-05", "2026-01-05"), "2026-01-05")
      .classes[1],
  ).toMatchObject({ status: null, note: { body: "Extra notes" } });
  expect(() => extra.undo()).toThrow("changed");
  validateDatabase(mockDb);
});
test("Daily Log holiday neutralizes marks and Undo restores exact outcomes without denominator inflation", () => {
  const f = fixture();
  markClass({
    ...dayInput(f.sem.id),
    key: firstClass(f.sem.id).key,
    status: "present",
  });
  const holiday = toggleDayHoliday(dayInput(f.sem.id));
  expect(firstClass(f.sem.id)).toMatchObject({
    holiday: true,
    status: "neutral",
  });
  expect(subjectTotals(f.sem.id, "2026-10-11")[0]).toMatchObject({
    attended: 0,
    held: 0,
  });
  expect(() =>
    markClass({
      ...dayInput(f.sem.id),
      key: firstClass(f.sem.id).key,
      status: "present",
    }),
  ).toThrow("neutral");
  holiday.undo();
  expect(firstClass(f.sem.id).status).toBe("present");
  expect(holidaysRepository.list()).toHaveLength(0);
  toggleDayHoliday(dayInput(f.sem.id));
  toggleDayHoliday(dayInput(f.sem.id));
  expect(firstClass(f.sem.id)).toMatchObject({
    holiday: false,
    status: "neutral",
  });
  validateDatabase(mockDb);
});
test("removing a holiday splits only the selected day out of overlapping ranges", () => {
  const f = fixture();
  holidaysRepository.create({
    semesterId: f.sem.id,
    startsOn: "2026-01-05",
    endsOn: "2026-01-10",
    title: "Break",
  });
  holidaysRepository.create({
    semesterId: f.sem.id,
    startsOn: "2026-01-06",
    endsOn: "2026-01-09",
    title: "Closure",
  });
  const remove = toggleDayHoliday(dayInput(f.sem.id, "2026-01-07"));
  const data = logRange(f.sem.id, "2026-01-05", "2026-01-10");
  expect(resolveDay(data, "2026-01-06").holiday).toBe(true);
  expect(resolveDay(data, "2026-01-07").holiday).toBe(false);
  expect(resolveDay(data, "2026-01-08").holiday).toBe(true);
  remove.undo();
  expect(holidaysRepository.list()).toHaveLength(2);
  validateDatabase(mockDb);
});
test("Daily Log rejects stale, future, outside and archived writes", () => {
  const f = fixture(),
    old = dayInput(f.sem.id);
  const key = firstClass(f.sem.id).key;
  markClass({ ...old, key, status: "present" });
  expect(() => markClass({ ...old, key, status: "absent" })).toThrow(
    StaleRevisionError,
  );
  expect(() => toggleDayHoliday(dayInput(f.sem.id, "2026-12-01"))).toThrow(
    "Future",
  );
  expect(() => toggleDayHoliday(dayInput(f.sem.id, "2026-01-01"))).toThrow(
    "outside",
  );
  semestersRepository.update(f.sem.id, 1, { archivedAt: Date.now() });
  expect(() => markAllPresent(dayInput(f.sem.id))).toThrow("Archived");
  expect(attendanceRecordsRepository.list()).toHaveLength(1);
});
test("Daily Log clearing or holiday conversion that breaks a later adjustment rolls back", () => {
  const f = fixture();
  markClass({
    ...dayInput(f.sem.id),
    key: firstClass(f.sem.id).key,
    status: "present",
  });
  attendanceRecordsRepository.create({
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    kind: "adjustment",
    onDate: "2026-01-06",
    attendedDelta: -1,
    heldDelta: -1,
    reason: "Correction",
  });
  const before = JSON.stringify(attendanceRecordsRepository.list());
  expect(() =>
    markClass({
      ...dayInput(f.sem.id),
      key: firstClass(f.sem.id).key,
      status: null,
    }),
  ).toThrow("prefix");
  expect(() => toggleDayHoliday(dayInput(f.sem.id))).toThrow("prefix");
  expect(JSON.stringify(attendanceRecordsRepository.list())).toBe(before);
  expect(holidaysRepository.list()).toHaveLength(0);
});
test("Daily Log extra validation, type weight, holiday status and Undo", () => {
  const f = fixture();
  classTypesRepository.update(f.type.id, 1, { defaultCountsAs: 2 });
  const input = {
    ...dayInput(f.sem.id),
    subjectId: f.subject.id,
    typeId: f.type.id,
    startMinute: 570,
    endMinute: 630,
    room: "Hall",
    note: "",
  };
  expect(() => addExtraClass(input)).toThrow("overlaps");
  expect(() => addExtraClass({ ...input, endMinute: 560 })).toThrow("End time");
  const added = addExtraClass({
    ...input,
    startMinute: 700,
    endMinute: 760,
    note: "Lab",
  });
  expect(extraClassesRepository.list()[0].countsAs).toBe(2);
  expect(mockDb.select().from(s.classNotes).all()[0].body).toBe("Lab");
  added.undo();
  expect(extraClassesRepository.list()).toEqual([]);
  expect(mockDb.select().from(s.classNotes).all()).toEqual([]);
  toggleDayHoliday(dayInput(f.sem.id));
  addExtraClass({
    ...dayInput(f.sem.id),
    subjectId: f.subject.id,
    typeId: f.type.id,
    startMinute: 700,
    endMinute: 760,
    room: "",
    note: "",
  });
  expect(
    resolveDay(logRange(f.sem.id, "2026-01-05", "2026-01-05"), "2026-01-05")
      .classes[1].status,
  ).toBe("neutral");
  validateDatabase(mockDb);
});
test("Daily Log snapshots remain frozen and notes follow a cloned slot", () => {
  const f = fixture();
  saveClassNote({
    ...dayInput(f.sem.id),
    key: firstClass(f.sem.id).key,
    body: "Original note",
  });
  markClass({
    ...dayInput(f.sem.id),
    key: firstClass(f.sem.id).key,
    status: "present",
  });
  const before = timetableData(f.sem.id);
  saveTimetable({
    semesterId: f.sem.id,
    expectedFingerprint: scheduleFingerprint(before),
    sourceVersionId: f.version.id,
    scope: "semester",
    slots: [{ ...f.slot, startMinute: 800, endMinute: 860 }],
  });
  const day = resolveDay(
    logRange(f.sem.id, "2026-01-05", "2026-01-05"),
    "2026-01-05",
  );
  expect(day.classes).toHaveLength(1);
  expect(day.classes[0]).toMatchObject({
    startMinute: 540,
    status: "present",
    note: { body: "Original note" },
  });
  markClass({
    ...dayInput(f.sem.id),
    key: day.classes[0].key,
    status: "absent",
  });
  expect(attendanceRecordsRepository.list()[0].startMinute).toBe(540);
  validateDatabase(mockDb);
});
test("Daily Log queries use range/lineage indexes and keep semester data isolated", () => {
  const f = fixture();
  expect(logRange(f.sem.id, "2026-01-05", "2026-01-05").subjects).toHaveLength(
    1,
  );
  const other = semester();
  expect(logRange(other.id, "2026-01-05", "2026-01-05").subjects).toEqual([]);
  const plans = [
    [
      `SELECT * FROM attendance_records WHERE semester_id = ? AND on_date >= ? AND on_date <= ?`,
      [f.sem.id, "2026-01-01", "2026-01-31"],
      "attendance_sem_day_idx",
    ],
    [
      `SELECT * FROM class_notes WHERE semester_id = ? AND on_date >= ? AND on_date <= ?`,
      [f.sem.id, "2026-01-01", "2026-01-31"],
      "class_notes_sem_day_idx",
    ],
    [
      `SELECT * FROM timetable_slots WHERE semester_id = ?`,
      [f.sem.id],
      "slots_sem_idx",
    ],
  ] as const;
  for (const [query, params, index] of plans)
    expect(
      JSON.stringify(
        sqlite.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...params),
      ),
    ).toContain(index);
});

test("Undo leaves unrelated rows and holiday revisions untouched", () => {
  const f = fixture();
  const holiday = holidaysRepository.create({
    semesterId: f.sem.id,
    startsOn: "2026-02-01",
    endsOn: "2026-02-03",
    title: "Break",
  });
  const row = markOccurrence({
    slotId: f.slot.id,
    onDate: "2026-01-05",
    status: "present",
    expectedRevision: null,
  });
  const note = saveClassNote({
    ...dayInput(f.sem.id),
    key: firstClass(f.sem.id).key,
    body: "Note",
  });
  note.undo();
  expect(attendanceRecordsRepository.get(row.id)).toEqual(row);
  expect(holidaysRepository.get(holiday.id)).toEqual(holiday);
});

test("large ledger uses bounded day reads and indexed subject validation", () => {
  const f = fixture();
  const insert = sqlite.prepare(
    "INSERT INTO attendance_records (id,created_at,updated_at,semester_id,subject_id,on_date,kind,attended_delta,held_delta,reason) VALUES (?,?,?,?,?,'2026-01-06','adjustment',1,1,'Imported balance')",
  );
  sqlite.exec("BEGIN");
  for (let i = 0; i < 10000; i++)
    insert.run(
      `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      i + 1,
      i + 1,
      f.sem.id,
      f.subject.id,
    );
  sqlite.exec("COMMIT");
  const started = nodePerformance.now();
  const data = logRange(f.sem.id, "2026-01-05", "2026-01-05");
  expect(data.records).toHaveLength(0);
  markClass({
    ...dayInput(f.sem.id),
    key: firstClass(f.sem.id).key,
    status: "present",
  });
  expect(subjectTotals(f.sem.id, "2026-10-11")[0]).toMatchObject({
    attended: 10001,
    held: 10001,
  });
  console.info(
    `Daily Log 10,000-row ledger: scoped read, mark, prefix validation and totals in ${(nodePerformance.now() - started).toFixed(1)} ms (Node SQLite; not device frame timing).`,
  );
});

test("Subject controls append all four signed adjustments and never edit class marks", () => {
  const f = fixture();
  const original = markOccurrence({
    slotId: f.slot.id,
    onDate: "2026-10-05",
    status: "present",
    expectedRevision: null,
  });
  const adjust = (field: "attended" | "missed", direction: 1 | -1) =>
    adjustSubject({
      semesterId: f.sem.id,
      subjectId: f.subject.id,
      subjectRevision: f.subject.revision,
      expected: subjectTotals(f.sem.id, "2026-10-11")[0],
      field,
      direction,
    });
  const a = adjust("attended", 1);
  expect(a.record).toMatchObject({
    kind: "adjustment",
    attendedDelta: 1,
    heldDelta: 1,
    onDate: "2026-10-11",
  });
  adjust("missed", 1);
  adjust("attended", -1);
  const last = adjust("missed", -1);
  expect(subjectTotals(f.sem.id, "2026-10-11")[0]).toMatchObject({
    attended: 1,
    held: 1,
  });
  expect(attendanceRecordsRepository.get(original.id)).toEqual(original);
  const corrections = attendanceRecordsRepository
    .list()
    .filter((r) => r.kind === "adjustment");
  expect(corrections).toHaveLength(4);
  expect(new Set(corrections.map((r) => r.createdAt)).size).toBe(4);
  expect(
    corrections.every(
      (r) => !!r.reason?.trim() && r.slotId === null && r.status === null,
    ),
  ).toBe(true);
  last.undo();
  expect(subjectTotals(f.sem.id, "2026-10-11")[0]).toMatchObject({
    attended: 1,
    held: 2,
  });
  expect(() => last.undo()).toThrow("already undone");
});
test("Subject negative, stale, archived and cross-semester adjustments roll back", () => {
  const f = fixture();
  const input = {
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    subjectRevision: f.subject.revision,
    expected: { attended: 0, held: 0 },
    field: "attended" as const,
    direction: -1 as const,
  };
  expect(() => adjustSubject(input)).toThrow("negative");
  expect(() => adjustSubject({ ...input, field: "missed" })).toThrow(
    "negative",
  );
  expect(attendanceRecordsRepository.list()).toEqual([]);
  adjustSubject({ ...input, direction: 1 });
  expect(() => adjustSubject({ ...input, direction: 1 })).toThrow(
    StaleRevisionError,
  );
  expect(() => adjustSubject({ ...input, semesterId: semester().id })).toThrow(
    "unavailable",
  );
  subjectsRepository.update(f.subject.id, f.subject.revision, {
    archivedAt: Date.now(),
  });
  expect(() => adjustSubject({ ...input, direction: 1 })).toThrow("read-only");
});
test("Adjustment Undo preserves unrelated subjects and rejects changed subject history", () => {
  const f = fixture();
  const input = {
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    subjectRevision: 1,
    expected: { attended: 0, held: 0 },
    field: "attended" as const,
    direction: 1 as const,
  };
  const first = adjustSubject(input);
  const other = subjectsRepository.create({
    semesterId: f.sem.id,
    name: "Other",
    normalizedName: "other",
  });
  const unrelated = adjustSubject({ ...input, subjectId: other.id });
  first.undo();
  expect(attendanceRecordsRepository.get(unrelated.record.id)).toBeDefined();
  const fresh = adjustSubject(input);
  adjustSubject({
    ...input,
    expected: { attended: 1, held: 1 },
    field: "missed",
  });
  expect(() => fresh.undo()).toThrow("Newer data was preserved");
  expect(attendanceRecordsRepository.get(fresh.record.id)).toBeDefined();
});
test("Daily Log updates immediately feed subject queries; unsafe historical clear rejects after adjustment", () => {
  const f = fixture();
  const mark = markOccurrence({
    slotId: f.slot.id,
    onDate: "2026-10-05",
    status: "present",
    expectedRevision: null,
  });
  expect(subjectsData(f.sem.id, new Date()).totals[0]).toMatchObject({
    attended: 1,
    held: 1,
  });
  adjustSubject({
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    subjectRevision: 1,
    expected: { attended: 1, held: 1 },
    field: "attended",
    direction: -1,
  });
  expect(() => resetOccurrence(mark.id, mark.revision)).toThrow("prefix");
  expect(subjectsData(f.sem.id, new Date()).totals[0]).toMatchObject({
    attended: 0,
    held: 0,
  });
  expect(subjectsData(f.sem.id, new Date()).data.records).toEqual([]);
});
test("Subject adjustments use semester end for completed terms and reject future/archived terms", () => {
  const sem = semestersRepository.create({
    name: "Past",
    startsOn: "2026-01-05",
    endsOn: "2026-06-30",
    weekAnchor: "2026-01-05",
  });
  const subject = subjectsRepository.create({
    semesterId: sem.id,
    name: "Past",
    normalizedName: "past",
  });
  const input = {
    semesterId: sem.id,
    subjectId: subject.id,
    subjectRevision: 1,
    expected: { attended: 0, held: 0 },
    field: "missed" as const,
    direction: 1 as const,
  };
  expect(adjustSubject(input).record.onDate).toBe("2026-06-30");
  semestersRepository.update(sem.id, sem.revision, { archivedAt: Date.now() });
  expect(() => adjustSubject(input)).toThrow("read-only");
  const future = semestersRepository.create({
    name: "Future",
    startsOn: "2027-01-04",
    endsOn: "2027-06-30",
    weekAnchor: "2027-01-04",
  });
  const futureSubject = subjectsRepository.create({
    semesterId: future.id,
    name: "Future",
    normalizedName: "future",
  });
  expect(() =>
    adjustSubject({
      ...input,
      semesterId: future.id,
      subjectId: futureSubject.id,
    }),
  ).toThrow("once the semester starts");
});
test("Subject sort settings persist, reject invalid options, and protect revisions", () => {
  const saved = settingsRepository.set("subjectSort", "percentage", null);
  expect(settingsRepository.get("subjectSort")?.value).toBe("percentage");
  const updated = settingsRepository.set(
    "subjectSort",
    "nextClass",
    saved.revision,
  );
  expect(() =>
    settingsRepository.set("subjectSort", "name", saved.revision),
  ).toThrow(StaleRevisionError);
  expect(() =>
    settingsRepository.set("subjectSort", "random", updated.revision),
  ).toThrow();
  expect(settingsRepository.get("subjectSort")?.value).toBe("nextClass");
});
test("Subject color/archive are reversible and keep all attendance in overall totals", () => {
  const f = fixture();
  markOccurrence({
    slotId: f.slot.id,
    onDate: "2026-10-05",
    status: "present",
    expectedRevision: null,
  });
  const color = changeSubject(f.subject, { color: "#176640" });
  expect(subjectsRepository.get(f.subject.id)?.color).toBe("#176640");
  color.undo();
  const current = subjectsRepository.get(f.subject.id)!;
  const archive = changeSubject(current, { archivedAt: Date.now() });
  expect(subjectsData(f.sem.id, new Date()).totals[0]).toMatchObject({
    attended: 1,
    held: 1,
  });
  archive.undo();
  expect(subjectsRepository.get(f.subject.id)?.archivedAt).toBeNull();
  const stale = changeSubject(subjectsRepository.get(f.subject.id)!, {
    color: "#176640",
  });
  const latest = subjectsRepository.get(f.subject.id)!;
  subjectsRepository.update(latest.id, latest.revision, {
    teacher: "New teacher",
  });
  expect(() => stale.undo()).toThrow(StaleRevisionError);
});
test("Subject countdown query is scoped and includes only incomplete deadlines within seven days", () => {
  const f = fixture(),
    other = fixture();
  const now = Date.now();
  const insert = (
    subjectId: string,
    title: string,
    dueAt: number,
    completedAt: number | null = null,
  ) =>
    mockDb
      .insert(s.deadlines)
      .values({
        id: jest
          .requireActual<typeof import("node:crypto")>("node:crypto")
          .randomUUID(),
        subjectId,
        title,
        dueAt,
        completedAt,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  insert(f.subject.id, "Now", now);
  insert(f.subject.id, "Week", now + 7 * 86400000);
  insert(f.subject.id, "Too far", now + 7 * 86400000 + 1);
  insert(f.subject.id, "Done", now, now);
  insert(f.subject.id, "Past", now - 1);
  insert(other.subject.id, "Other semester", now);
  expect(
    subjectsData(f.sem.id, new Date(now))
      .deadlines.map((d) => d.title)
      .sort(),
  ).toEqual(["Now", "Week"]);
});

const importJSON = (
  slots: object[] = [
    { subject: "Physics", day: "Monday", start: "11", end: "12" },
  ],
  name = "Physics",
) => JSON.stringify({ formatVersion: 1, subjects: [{ name }], slots });
function importInput(semesterId: string, raw = importJSON()) {
  return {
    raw,
    semesterId,
    mode: "merge" as const,
    scope: "today" as const,
    expectedFingerprint: scheduleFingerprint(timetableData(semesterId)),
  };
}
test("import creates new subjects/types and a version atomically, and Undo restores all", () => {
  const f = fixture(),
    before = timetableData(f.sem.id);
  const saved = importTimetable(
    importInput(
      f.sem.id,
      importJSON([
        {
          subject: "Physics",
          day: "Monday",
          start: "11",
          end: "12",
          classType: "Seminar",
          countsAs: 2,
        },
      ]),
    ),
  );
  const after = timetableData(f.sem.id),
    version = after.versions.find((v) => v.id === saved.version.id)!;
  expect(version.effectiveFrom).toBe("2026-10-11");
  expect(after.subjects).toHaveLength(2);
  expect(after.types.some((t) => t.name === "Seminar")).toBe(true);
  expect(after.slots.filter((s) => s.versionId === version.id)).toHaveLength(2);
  saved.undo();
  const restored = timetableData(f.sem.id);
  expect(restored.subjects).toEqual(before.subjects);
  expect(restored.types).toEqual(before.types);
  expect(
    restored.versions.filter((v) => v.supersededAt === null).map((v) => v.id),
  ).toEqual([f.version.id]);
});
test("replacement preserves attendance and reused occurrence lineage", () => {
  const f = fixture();
  markOccurrence({
    slotId: f.slot.id,
    onDate: "2026-01-05",
    status: "present",
    expectedRevision: null,
  });
  const records = timetableData(f.sem.id).records;
  const saved = importTimetable({
    ...importInput(
      f.sem.id,
      importJSON(
        [{ subject: "math", day: "Mon", start: "9 AM", end: "10 AM" }],
        " MATH ",
      ),
    ),
    mode: "replace",
    scope: "semester",
  });
  const after = timetableData(f.sem.id);
  expect(after.subjects).toHaveLength(1);
  expect(after.records).toEqual(records);
  expect(
    after.slots.find((s) => s.versionId === saved.version.id)?.lineageId,
  ).toBe(f.slot.id);
  saved.undo();
  expect(timetableData(f.sem.id).records).toEqual(records);
});
test("merge deduplicates exact classes and accepts adjacent/odd-even alternatives", () => {
  const f = fixture();
  const raw = importJSON(
    [
      { subject: "Math", day: "Monday", start: "9", end: "10" },
      {
        subject: "Math",
        day: "Monday",
        start: "10",
        end: "11",
        weekPattern: "odd",
      },
      {
        subject: "Math",
        day: "Monday",
        start: "10",
        end: "11",
        weekPattern: "even",
      },
    ],
    "Math",
  );
  const preview = buildImportPreview(
    parseImport(raw),
    timetableData(f.sem.id),
    "merge",
    "2026-10-11",
  );
  expect(preview.duplicates).toBe(1);
  expect(preview.conflicts.size).toBe(0);
  const saved = importTimetable(importInput(f.sem.id, raw));
  expect(
    timetableData(f.sem.id).slots.filter(
      (s) => s.versionId === saved.version.id,
    ),
  ).toHaveLength(3);
});
test("overlaps are flagged in preview and saving leaves no partial subjects", () => {
  const f = fixture(),
    raw = importJSON([
      { subject: "Physics", day: "Monday", start: "9:30", end: "10:30" },
    ]);
  const before = timetableData(f.sem.id);
  const preview = buildImportPreview(
    parseImport(raw),
    before,
    "merge",
    "2026-10-11",
  );
  expect(preview.conflicts.size).toBe(2);
  expect(() => importTimetable(importInput(f.sem.id, raw))).toThrow("overlaps");
  expect(timetableData(f.sem.id)).toEqual(before);
  expect(
    buildImportPreview(parseImport(raw), before, "replace", "2026-10-11")
      .conflicts.size,
  ).toBe(0);
});
test("replacement detects extra-class conflicts and stale preview fails safely", () => {
  const f = fixture();
  extraClassesRepository.create({
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    classTypeId: f.type.id,
    onDate: "2026-10-12",
    startMinute: 660,
    endMinute: 720,
  });
  const input = importInput(f.sem.id);
  expect(
    buildImportPreview(
      parseImport(input.raw),
      timetableData(f.sem.id),
      "replace",
      "2026-10-11",
    ).conflicts.size,
  ).toBe(1);
  expect(() => importTimetable({ ...input, mode: "replace" })).toThrow(
    "overlaps",
  );
  subjectsRepository.create({
    semesterId: f.sem.id,
    name: "Chemistry",
    normalizedName: "chemistry",
  });
  expect(() => importTimetable(input)).toThrow("changed");
  expect(
    timetableData(f.sem.id).subjects.some((s) => s.name === "Physics"),
  ).toBe(false);
});
test("archived/ambiguous normalized subjects reject and metadata remains unchanged", () => {
  const f = fixture();
  subjectsRepository.update(f.subject.id, f.subject.revision, {
    archivedAt: Date.now(),
  });
  expect(() =>
    importTimetable(
      importInput(
        f.sem.id,
        importJSON(
          [{ subject: "Math", day: "Tuesday", start: "9", end: "10" }],
          "Math",
        ),
      ),
    ),
  ).toThrow("archived");
  subjectsRepository.create({
    semesterId: f.sem.id,
    name: "Data  Science",
    normalizedName: "data  science",
  });
  subjectsRepository.create({
    semesterId: f.sem.id,
    name: "Data Science",
    normalizedName: "data science",
  });
  expect(() =>
    importTimetable(
      importInput(
        f.sem.id,
        importJSON(
          [{ subject: "Data Science", day: "Tuesday", start: "9", end: "10" }],
          "Data Science",
        ),
      ),
    ),
  ).toThrow("More than one existing subject");
});
test("unsafe Undo rolls back the whole operation when a new subject has linked content", () => {
  const f = fixture(),
    saved = importTimetable(importInput(f.sem.id));
  const subject = timetableData(f.sem.id).subjects.find(
    (s) => s.name === "Physics",
  )!;
  unitsRepository.create({ subjectId: subject.id, title: "New content" });
  const before = timetableData(f.sem.id);
  expect(() => saved.undo()).toThrow();
  expect(timetableData(f.sem.id)).toEqual(before);
});
test("onboarding persists draft, creates one configured semester, and completion/skip is permanent", () => {
  const draft: OnboardingDraft = {
    step: "choice",
    name: "Semester 3",
    startsOn: "2026-07-01",
    endsOn: "2026-12-31",
    timezone: "Asia/Kolkata",
    target: "75.25",
    semesterId: null,
  };
  saveSetupDraft(draft);
  const setup = prepareSetup(draft, false);
  expect(semestersRepository.list()).toHaveLength(1);
  expect(semestersRepository.get(setup.semesterId!)?.targetBps).toBe(7525);
  expect(settingsRepository.get("activeSemesterId")?.value).toBe(
    setup.semesterId,
  );
  expect(prepareSetup(setup, true).step).toBe("done");
  expect(semestersRepository.list()).toHaveLength(1);
  finishSetup();
  expect(settingsRepository.get("onboardingVersion")?.value).toBe(1);
  expect(settingsRepository.get("onboardingDraft")).toBeUndefined();
  finishSetup();
  expect(semestersRepository.list()).toHaveLength(1);
});
test("invalid onboarding cannot leave a partial semester", () => {
  const draft: OnboardingDraft = {
    step: "choice",
    name: "Semester",
    startsOn: "2026-01-05",
    endsOn: "2026-12-31",
    timezone: "Asia/Kolkata",
    target: "101",
    semesterId: null,
  };
  expect(() => prepareSetup(draft, false)).toThrow("Target");
  expect(semestersRepository.list()).toHaveLength(0);
  finishSetup();
  expect(settingsRepository.get("onboardingVersion")?.value).toBe(1);
});

test("repeated merge reuses subjects and keeps one active copy of each class", () => {
  const f = fixture();
  const first = importTimetable(importInput(f.sem.id));
  const second = importTimetable(importInput(f.sem.id));
  const after = timetableData(f.sem.id);
  expect(second.version.id).not.toBe(first.version.id);
  expect(after.subjects).toHaveLength(2);
  expect(
    after.slots.filter((s) => s.versionId === second.version.id),
  ).toHaveLength(2);
  expect(
    after.versions.filter(
      (v) => v.supersededAt === null && v.effectiveFrom === "2026-10-11",
    ),
  ).toHaveLength(1);
});
test("onboarding import marks the correct draft done in the same save", () => {
  const draft: OnboardingDraft = {
    step: "choice",
    name: "Semester",
    startsOn: "2026-01-05",
    endsOn: "2026-12-31",
    timezone: "Asia/Kolkata",
    target: "75",
    semesterId: null,
  };
  saveSetupDraft(draft);
  const setup = prepareSetup(draft, false);
  importTimetable({ ...importInput(setup.semesterId!), onboarding: true });
  expect(
    (settingsRepository.get("onboardingDraft")?.value as OnboardingDraft).step,
  ).toBe("done");
  const other = semester(),
    before = timetableData(other.id);
  expect(() =>
    importTimetable({ ...importInput(other.id), onboarding: true }),
  ).toThrow("Setup changed");
  expect(timetableData(other.id)).toEqual(before);
});

function contentFixture() {
  const f = fixture(),
    scope = { semesterId: f.sem.id, subjectId: f.subject.id };
  const unit = saveContent(scope, "unit", { title: "Unit 1" }).row;
  const topic = saveContent(scope, "topic", {
    title: "Limits",
    unitId: unit.id,
    important: false,
    completedAt: null,
  }).row;
  return { ...f, scope, unit, topic };
}
test("subject topics append in order, complete/star, update card totals and undo without touching attendance", () => {
  const f = contentFixture();
  const second = saveContent(f.scope, "topic", {
    title: "Continuity",
    unitId: f.unit.id,
    important: true,
    completedAt: null,
  });
  expect(subjectContent(f.scope).topics.map((t) => t.title)).toEqual([
    "Limits",
    "Continuity",
  ]);
  const first = topicsRepository.get(f.topic.id)!;
  const change = saveContent(
    f.scope,
    "topic",
    { ...first, important: true, completedAt: Date.now() },
    first.id,
    first.revision,
  );
  expect(completion(subjectContent(f.scope).topics).percent).toBe(50);
  expect(subjectsData(f.sem.id, new Date()).syllabus).toEqual([
    { subjectId: f.subject.id, done: 1, total: 2 },
  ]);
  expect(subjectTotals(f.sem.id, "2026-10-11")).toEqual([]);
  change.undo();
  expect(topicsRepository.get(first.id)).toMatchObject({
    completedAt: null,
    important: false,
    revision: 3,
  });
  expect(() => change.undo()).toThrow();
  second.undo();
  expect(subjectContent(f.scope).topics).toHaveLength(1);
});
test("reorder is atomic, checks every sibling and revisions, and offers guarded undo", () => {
  const f = contentFixture();
  const second = saveContent(f.scope, "unit", { title: "Unit 2" }).row;
  const third = saveContent(f.scope, "unit", { title: "Unit 3" }).row;
  const before = subjectContent(f.scope).units;
  const saved = reorderContent(
    f.scope,
    "unit",
    [third.id, f.unit.id, second.id],
    orderFingerprint(before),
  );
  expect(subjectContent(f.scope).units.map((u) => u.id)).toEqual([
    third.id,
    f.unit.id,
    second.id,
  ]);
  expect(() =>
    reorderContent(
      f.scope,
      "unit",
      before.map((u) => u.id),
      orderFingerprint(before),
    ),
  ).toThrow("changed");
  saved.undo();
  expect(subjectContent(f.scope).units.map((u) => u.id)).toEqual(
    before.map((u) => u.id),
  );
  expect(() => saved.undo()).toThrow();
  const current = subjectContent(f.scope).units;
  expect(() =>
    reorderContent(
      f.scope,
      "unit",
      [f.unit.id, f.unit.id, second.id],
      orderFingerprint(current),
    ),
  ).toThrow("every sibling");
  expect(subjectContent(f.scope).units).toEqual(current);
});
test("topic reorder stays within its unit, and stale Undo preserves a later rename", () => {
  const f = contentFixture();
  const second = saveContent(f.scope, "topic", {
    title: "Continuity",
    unitId: f.unit.id,
    important: false,
    completedAt: null,
  }).row;
  const before = subjectContent(f.scope).topics;
  const saved = reorderContent(
    f.scope,
    "topic",
    [second.id, f.topic.id],
    orderFingerprint(before),
    f.unit.id,
  );
  const current = topicsRepository.get(f.topic.id)!;
  saveContent(
    f.scope,
    "topic",
    { ...current, title: "Renamed limits" },
    current.id,
    current.revision,
  );
  const after = subjectContent(f.scope);
  expect(() => saved.undo()).toThrow("changed");
  expect(subjectContent(f.scope)).toEqual(after);
});
test("subject content rejects stale/cross-semester/archive writes, invalid title, invalid unit and marks", () => {
  const f = contentFixture(),
    other = semester();
  expect(() =>
    saveContent({ ...f.scope, semesterId: other.id }, "note", {
      title: "Note",
      body: "",
      pinned: false,
    }),
  ).toThrow("unavailable");
  expect(() =>
    saveContent(f.scope, "unit", { title: "Stale" }, f.unit.id, 999),
  ).toThrow("changed");
  expect(() => saveContent(f.scope, "unit", { title: " " })).toThrow("title");
  expect(() =>
    saveContent(f.scope, "mark", {
      title: "Quiz",
      earned: 11,
      maximum: 10,
      onDate: "2026-10-11",
    }),
  ).toThrow("exceed");
  expect(() =>
    saveContent(f.scope, "mark", {
      title: "Quiz",
      earned: 1,
      maximum: 0,
      onDate: "2026-10-11",
    }),
  ).toThrow();
  expect(() =>
    saveContent(f.scope, "mark", {
      title: "Quiz",
      earned: 1,
      maximum: 10,
      onDate: "2026-02-30",
    }),
  ).toThrow();
  const foreignSubject = subjectsRepository.create({
    semesterId: other.id,
    name: "Other",
    normalizedName: "other",
  });
  const foreignUnit = unitsRepository.create({
    subjectId: foreignSubject.id,
    title: "Other unit",
  });
  expect(() =>
    saveContent(f.scope, "topic", {
      title: "Bad",
      unitId: foreignUnit.id,
      important: false,
      completedAt: null,
    }),
  ).toThrow();
  subjectsRepository.update(f.subject.id, f.subject.revision, {
    archivedAt: Date.now(),
  });
  expect(() => saveContent(f.scope, "unit", { title: "Archived" })).toThrow(
    "read-only",
  );
  expect(subjectContent(f.scope).topics).toHaveLength(1);
});
test("note pin/edit/delete Undo preserves formatting and later edits block stale Undo", () => {
  const f = contentFixture();
  const a = saveContent(f.scope, "note", {
    title: "Regular",
    body: "plain text",
    pinned: false,
  });
  const b = saveContent(f.scope, "note", {
    title: "Pinned",
    body: "**bold**\n- bullet\n- [ ] checklist",
    pinned: true,
  });
  expect(subjectContent(f.scope).notes[0].id).toBe(b.row.id);
  const removed = deleteContent(f.scope, "note", b.row.id, b.row.revision);
  removed.undo();
  const restored = notesRepository.get(b.row.id)!;
  expect(restored).toMatchObject({
    body: "**bold**\n- bullet\n- [ ] checklist",
    pinned: true,
    revision: 2,
  });
  const updated = saveContent(
    f.scope,
    "note",
    { ...restored, body: "later edit" },
    restored.id,
    restored.revision,
  );
  const newer = notesRepository.get(restored.id)!;
  saveContent(
    f.scope,
    "note",
    { ...newer, title: "Newer title" },
    newer.id,
    newer.revision,
  );
  expect(() => updated.undo()).toThrow("changed");
  expect(notesRepository.get(restored.id)?.title).toBe("Newer title");
  a.undo();
});
test("linked topics and nonempty units cannot be deleted; topic moves preserve note associations", () => {
  const f = contentFixture();
  notesRepository.create({
    subjectId: f.subject.id,
    unitId: f.unit.id,
    topicId: f.topic.id,
    title: "Linked",
    body: "keep",
  });
  expect(() =>
    deleteContent(f.scope, "topic", f.topic.id, f.topic.revision),
  ).toThrow("linked");
  expect(() =>
    deleteContent(f.scope, "unit", f.unit.id, f.unit.revision),
  ).toThrow("topics");
  const secondUnit = saveContent(f.scope, "unit", { title: "Unit 2" }).row;
  const topic = topicsRepository.get(f.topic.id)!;
  expect(() =>
    saveContent(
      f.scope,
      "topic",
      { ...topic, unitId: secondUnit.id },
      topic.id,
      topic.revision,
    ),
  ).toThrow("association");
  expect(topicsRepository.get(topic.id)?.unitId).toBe(f.unit.id);
});
test("deadline types feed the existing card chip, completion removes it, and Undo restores it", () => {
  const f = contentFixture();
  for (const category of [
    "assignment",
    "quiz",
    "mid-sem",
    "end-sem",
    "other",
    "exam",
  ] as const) {
    const result = saveContent(f.scope, "deadline", {
      title: category,
      category,
      dueAt: Date.now() + 3600000,
      completedAt: null,
    });
    expect(
      subjectsData(f.sem.id, new Date()).deadlines.some(
        (d) => d.id === result.row.id,
      ),
    ).toBe(true);
    const row = subjectContent(f.scope).deadlines.find(
      (d) => d.id === result.row.id,
    )!;
    const done = saveContent(
      f.scope,
      "deadline",
      { ...row, completedAt: Date.now() },
      row.id,
      row.revision,
    );
    expect(
      subjectsData(f.sem.id, new Date()).deadlines.some((d) => d.id === row.id),
    ).toBe(false);
    done.undo();
    expect(
      subjectsData(f.sem.id, new Date()).deadlines.some((d) => d.id === row.id),
    ).toBe(true);
  }
});
test("marks and links persist validated values and scoped deletion restores exact metadata", () => {
  const f = contentFixture();
  saveContent(f.scope, "mark", {
    title: "Quiz",
    earned: 7.5,
    maximum: 10,
    onDate: "2026-10-11",
  });
  saveContent(f.scope, "mark", {
    title: "Exam",
    earned: 20,
    maximum: 40,
    onDate: "2026-10-12",
  });
  const marks = subjectContent(f.scope).marks;
  expect(marks.reduce((total, m) => total + m.earned!, 0)).toBe(27.5);
  expect(() =>
    saveContent(f.scope, "link", {
      title: "Unsafe",
      url: "javascript:alert(1)",
    }),
  ).toThrow("HTTP");
  const link = saveContent(f.scope, "link", {
    title: "Reading",
    url: " https://example.com/lesson.pdf ",
  });
  expect(subjectContent(f.scope).links[0].url).toBe(
    "https://example.com/lesson.pdf",
  );
  const removed = deleteContent(
    f.scope,
    "link",
    link.row.id,
    link.row.revision,
  );
  removed.undo();
  expect(subjectContent(f.scope).links[0]).toMatchObject({
    title: "Reading",
    revision: 2,
  });
});
test("study timer survives background gaps, pauses, breaks and logs completed focus exactly once", () => {
  const f = contentFixture(),
    at = Date.now();
  const start = startStudy(f.scope, 25, 5, f.topic.id, at).row;
  expect(() => startStudy(f.scope, 25, 5)).toThrow("already active");
  expect(
    timerSnapshot(studyData(f.scope).active!, at + 600000).activeSeconds,
  ).toBe(600);
  const pause = updateStudy(
    f.scope,
    start.id,
    start.revision,
    "pause",
    at + 600000,
  ).row;
  expect(timerSnapshot(pause, at + 3600000).activeSeconds).toBe(600);
  const resume = updateStudy(
    f.scope,
    pause.id,
    pause.revision,
    "resume",
    at + 3600000,
  ).row;
  expect(timerSnapshot(resume, at + 4500000)).toMatchObject({
    remaining: 0,
    activeSeconds: 1500,
  });
  const rest = updateStudy(
    f.scope,
    resume.id,
    resume.revision,
    "next",
    at + 4600000,
  ).row;
  expect(rest.phase).toBe("break");
  expect(timerSnapshot(rest, at + 5000000).activeSeconds).toBe(1500);
  const next = updateStudy(
    f.scope,
    rest.id,
    rest.revision,
    "next",
    at + 5000000,
  ).row;
  expect(next.phase).toBe("focus");
  const finished = updateStudy(
    f.scope,
    next.id,
    next.revision,
    "finish",
    at + 5120000,
  ).row;
  expect(finished).toMatchObject({ state: "completed", activeSeconds: 1620 });
  expect(studyData(f.scope).active).toBeUndefined();
  expect(
    weeklyStudyMinutes(studyData(f.scope).sessions, at, f.sem.timezone),
  ).toBe(27);
  expect(() =>
    updateStudy(
      f.scope,
      finished.id,
      finished.revision,
      "finish",
      at + 5200000,
    ),
  ).toThrow("already finished");
});
test("timer actions reject invalid transitions, stale revisions, invalid durations and subject mismatches", () => {
  const f = contentFixture(),
    at = Date.now();
  expect(() => startStudy(f.scope, 0, 5)).toThrow("Focus");
  expect(() => startStudy(f.scope, 25, -1)).toThrow("Break");
  expect(() => startStudy(f.scope, 25, 1.5)).toThrow("Break");
  const row = startStudy(f.scope, 1, 0).row;
  expect(() => updateStudy(f.scope, row.id, row.revision, "resume")).toThrow(
    "state changed",
  );
  expect(() =>
    updateStudy(f.scope, row.id, row.revision, "next", at + 1000),
  ).toThrow("Finish this phase");
  const second = subjectsRepository.create({
    semesterId: f.sem.id,
    name: "Second",
    normalizedName: "second",
  });
  expect(() =>
    updateStudy(
      { ...f.scope, subjectId: second.id },
      row.id,
      row.revision,
      "finish",
    ),
  ).toThrow("changed");
  const next = updateStudy(
    f.scope,
    row.id,
    row.revision,
    "next",
    at + 120000,
  ).row;
  expect(next.phase).toBe("focus");
  expect(() => updateStudy(f.scope, row.id, row.revision, "finish")).toThrow(
    "changed",
  );
});
test("discard excludes focus and Undo refuses to resurrect a second active timer", () => {
  const f = contentFixture(),
    at = Date.now();
  const start = startStudy(f.scope, 25, 5);
  const discarded = updateStudy(
    f.scope,
    start.row.id,
    start.row.revision,
    "discard",
    at + 60000,
  );
  expect(
    weeklyStudyMinutes(studyData(f.scope).sessions, at, f.sem.timezone),
  ).toBe(0);
  const second = startStudy(f.scope, 25, 5);
  expect(() => discarded.undo()).toThrow("Another timer");
  expect(studyData(f.scope).active?.id).toBe(second.row.id);
});
test("timer Undo freezes the prior elapsed value and protects newer actions", () => {
  const f = contentFixture(),
    at = Date.now();
  const start = startStudy(f.scope, 25, 5);
  const pause = updateStudy(
    f.scope,
    start.row.id,
    start.row.revision,
    "pause",
    at + 60000,
  );
  jest.setSystemTime(at + 180000);
  pause.undo();
  const restored = studyData(f.scope).active!;
  expect(timerSnapshot(restored, Date.now()).activeSeconds).toBe(60);
  expect(restored.state).toBe("running");
  expect(() => start.undo()).toThrow("changed");
  expect(() => pause.undo()).toThrow("changed");
  jest.setSystemTime(at);
});
test("backward clock recovery requires an explicit pause and resume without inventing focus", () => {
  const f = contentFixture(),
    at = Date.now();
  const row = startStudy(f.scope, 25, 5).row;
  expect(() =>
    updateStudy(f.scope, row.id, row.revision, "finish", at - 1000),
  ).toThrow("clock moved backwards");
  const paused = updateStudy(
    f.scope,
    row.id,
    row.revision,
    "pause",
    at - 1000,
  ).row;
  const resumed = updateStudy(
    f.scope,
    row.id,
    paused.revision,
    "resume",
    at,
  ).row;
  expect(timerSnapshot(resumed, at + 60000).activeSeconds).toBe(60);
});
test("subject-tools migration preserves populated topic references, notes, legacy exams, notifications and study history", async () => {
  sqlite.close();
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  await migrate(mockDb, {
    journal: {
      ...migrations.journal,
      entries: migrations.journal.entries.slice(0, 3),
    },
    migrations: {
      m0000: migrations.migrations.m0000,
      m0001: migrations.migrations.m0001,
      m0002: migrations.migrations.m0002,
    },
  });
  const id = (n: number) =>
    `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  sqlite
    .prepare(
      "INSERT INTO semesters (id,created_at,updated_at,name,starts_on,ends_on,week_anchor) VALUES (?,1,1,'Semester','2026-01-05','2026-12-31','2026-01-05')",
    )
    .run(id(1));
  sqlite
    .prepare(
      "INSERT INTO subjects (id,created_at,updated_at,semester_id,name,normalized_name) VALUES (?,1,1,?,'Math','math')",
    )
    .run(id(2), id(1));
  sqlite
    .prepare(
      "INSERT INTO units (id,created_at,updated_at,subject_id,title) VALUES (?,1,1,?,'Unit')",
    )
    .run(id(3), id(2));
  sqlite
    .prepare(
      "INSERT INTO topics (id,created_at,updated_at,subject_id,unit_id,title,completed_at) VALUES (?,1,1,?,?,'Topic',10)",
    )
    .run(id(4), id(2), id(3));
  sqlite
    .prepare(
      "INSERT INTO notes (id,created_at,updated_at,subject_id,unit_id,topic_id,title,body,pinned) VALUES (?,1,1,?,?,?,'Note','**keep**',1)",
    )
    .run(id(5), id(2), id(3), id(4));
  sqlite
    .prepare(
      "INSERT INTO deadlines (id,created_at,updated_at,subject_id,title,category,due_at,notification_id) VALUES (?,1,1,?,'Exam','exam',1000,'keep-notification')",
    )
    .run(id(6), id(2));
  sqlite
    .prepare(
      "INSERT INTO study_sessions (id,created_at,updated_at,semester_id,subject_id,topic_id,started_at,ended_at,state,planned_focus_seconds,active_seconds,checkpoint_at) VALUES (?,1,1,?,?,?,1,60001,'completed',1500,60,60001)",
    )
    .run(id(7), id(1), id(2), id(4));
  const notes = sqlite.prepare("SELECT * FROM notes").all(),
    exams = sqlite.prepare("SELECT * FROM deadlines").all(),
    sessions = sqlite.prepare("SELECT * FROM study_sessions").all();
  await migrate(mockDb, migrations);
  expect(sqlite.prepare("SELECT * FROM notes").all()).toEqual(notes);
  expect(sqlite.prepare("SELECT * FROM deadlines").all()).toEqual(exams);
  expect(sqlite.prepare("SELECT * FROM study_sessions").all()).toEqual(
    sessions,
  );
  expect(topicsRepository.get(id(4))).toMatchObject({
    important: false,
    completedAt: 10,
  });
  expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  expect(() => sqlite.prepare("UPDATE topics SET important=2").run()).toThrow();
  sqlite.prepare("UPDATE deadlines SET category='mid-sem'").run();
  expect(() =>
    sqlite.prepare("UPDATE deadlines SET category='invalid'").run(),
  ).toThrow();
  validateDatabase(mockDb);
  await migrate(mockDb, migrations);
});

test("semester lifecycle copies current setup with fresh IDs, preserves final history and guards archive writes", () => {
  const f = fixture();
  markOccurrence({
    onDate: "2026-01-05",
    slotId: f.slot.id,
    status: "present",
    expectedRevision: null,
  });
  const before = semesterRows(f.sem.id);
  const result = startNewSemester(
    f.sem.id,
    JSON.stringify(before),
    {
      name: "Next",
      startsOn: "2027-01-04",
      endsOn: "2027-05-31",
      targetBps: 8000,
    },
    f.sem.timezone,
    true,
    true,
  );
  const next = semesterRows(result.semester.id);
  expect(next.subjects).toHaveLength(1);
  expect(next.subjects[0].id).not.toBe(f.subject.id);
  expect(next.timetableSlots[0]).toMatchObject({
    subjectId: next.subjects[0].id,
    weekday: 1,
    countsAs: 1,
    lineageId: null,
  });
  expect(next.attendanceRecords).toEqual([]);
  expect(next.notes).toEqual([]);
  expect(settingsRepository.get("activeSemesterId")?.value).toBe(
    result.semester.id,
  );
  expect(semesterRows(f.sem.id).attendanceRecords).toEqual(
    before.attendanceRecords,
  );
  expect(semesterRows(f.sem.id).semesters[0].archivedAt).not.toBeNull();
  const clock = Date.now();
  jest.setSystemTime(new Date("2025-12-01T00:00:00Z"));
  expect(subjectsData(f.sem.id, new Date()).totals[0]).toMatchObject({
    attended: 1,
    held: 1,
  });
  jest.setSystemTime(clock);
  expect(() =>
    subjectsRepository.update(f.subject.id, 1, {
      name: "Bad",
      normalizedName: "bad",
    }),
  ).toThrow("read-only");
  expect(() =>
    semestersRepository.update(f.sem.id, 2, { archivedAt: null }),
  ).toThrow("read-only");
  expect(() =>
    notesRepository.create({ subjectId: f.subject.id, title: "Bad" }),
  ).toThrow("read-only");
  result.undo();
  expect(semestersRepository.get(f.sem.id)?.archivedAt).toBeNull();
  expect(semestersRepository.get(result.semester.id)).toBeUndefined();
  expect(settingsRepository.get("activeSemesterId")?.value).toBe(f.sem.id);
});
test("new semester failure and stale Undo preserve both semesters atomically", () => {
  const f = fixture(),
    expected = semesterFingerprint(f.sem.id);
  expect(() =>
    startNewSemester(
      f.sem.id,
      expected,
      {
        name: "Invalid",
        startsOn: "2027-05-01",
        endsOn: "2027-01-01",
        targetBps: 7500,
      },
      f.sem.timezone,
      true,
      true,
    ),
  ).toThrow();
  expect(semesterFingerprint(f.sem.id)).toBe(expected);
  expect(semestersRepository.list()).toHaveLength(1);
  const result = startNewSemester(
    f.sem.id,
    expected,
    {
      name: "Blank",
      startsOn: "2027-01-04",
      endsOn: "2027-05-31",
      targetBps: 0,
    },
    f.sem.timezone,
    false,
    false,
  );
  expect(semesterRows(result.semester.id).subjects).toEqual([]);
  const current = semestersRepository.get(result.semester.id)!;
  semestersRepository.update(current.id, current.revision, { name: "Edited" });
  expect(() => result.undo()).toThrow("changed");
  expect(semestersRepository.get(f.sem.id)?.archivedAt).not.toBeNull();
});
test("semester edits retain overrides, reject invalid history bounds and parity changes, and support guarded Undo", () => {
  const f = fixture();
  subjectsRepository.update(f.subject.id, 1, { targetBps: 9000 });
  const expected = semesterFingerprint(f.sem.id);
  const result = saveSemester(f.sem.id, expected, {
    name: "Renamed",
    startsOn: f.sem.startsOn,
    endsOn: f.sem.endsOn,
    targetBps: 0,
  });
  expect(subjectsRepository.get(f.subject.id)?.targetBps).toBe(9000);
  expect(semestersRepository.get(f.sem.id)?.targetBps).toBe(0);
  result.undo();
  expect(semestersRepository.get(f.sem.id)?.targetBps).toBe(7500);
  const current = semesterFingerprint(f.sem.id);
  expect(() =>
    saveSemester(f.sem.id, current, {
      name: "Bad",
      startsOn: "2026-01-12",
      endsOn: f.sem.endsOn,
      targetBps: 7500,
    }),
  ).toThrow("parity");
  expect(() =>
    saveSemester(f.sem.id, current, {
      name: "Bad",
      startsOn: f.sem.startsOn,
      endsOn: "2026-01-01",
      targetBps: 7500,
    }),
  ).toThrow();
  expect(() =>
    saveSemester(f.sem.id, expected, {
      name: "Stale",
      startsOn: f.sem.startsOn,
      endsOn: f.sem.endsOn,
      targetBps: 7500,
    }),
  ).toThrow("changed");
});
test("named holiday ranges convert recorded classes to neutral, preserve overrides and Undo exact outcomes", () => {
  const f = fixture();
  markOccurrence({
    onDate: "2026-01-05",
    slotId: f.slot.id,
    status: "present",
    expectedRevision: null,
  });
  const before = semesterRows(f.sem.id);
  const holiday = addSemesterHoliday(
    f.sem.id,
    JSON.stringify(before),
    "Winter break",
    "2026-01-05",
    "2026-01-11",
  );
  expect(semesterRows(f.sem.id).attendanceRecords[0].status).toBe("neutral");
  expect(subjectTotals(f.sem.id, "2026-10-11")[0].held).toBe(0);
  holiday.undo();
  expect(semesterRows(f.sem.id).attendanceRecords[0].status).toBe("present");
  const second = addSemesterHoliday(
    f.sem.id,
    semesterFingerprint(f.sem.id),
    "Day off",
    "2026-01-05",
    "2026-01-05",
  );
  const row = semesterRows(f.sem.id).holidays[0];
  const removed = removeSemesterHoliday(
    f.sem.id,
    semesterFingerprint(f.sem.id),
    row.id,
  );
  expect(semesterRows(f.sem.id).attendanceRecords[0].status).toBe("neutral");
  removed.undo();
  expect(semesterRows(f.sem.id).holidays[0].title).toBe("Day off");
  expect(() => second.undo()).toThrow("changed");
});
test("clearing attendance keeps subjects, timetable and content; Undo restores the exact marks", () => {
  const f = contentFixture(),
    other = fixture();
  markOccurrence({
    onDate: "2026-01-05",
    slotId: f.slot.id,
    status: "present",
    expectedRevision: null,
  });
  saveContent(f.scope, "note", { title: "Stays", body: "", pinned: false });
  const before = semesterRows(f.sem.id);
  const otherBefore = semesterFingerprint(other.sem.id);
  expect(() =>
    clearSemesterAttendance(f.sem.id, JSON.stringify(before), "reset"),
  ).toThrow("RESET");
  expect(() => clearSemesterAttendance(f.sem.id, "stale", "RESET")).toThrow(
    "changed",
  );
  const result = clearSemesterAttendance(
    f.sem.id,
    JSON.stringify(before),
    "RESET",
  );
  expect(result.removed).toBe(1);
  const after = semesterRows(f.sem.id);
  expect(after.attendanceRecords).toEqual([]);
  expect(after.subjects).toEqual(before.subjects);
  expect(after.timetableSlots).toEqual(before.timetableSlots);
  expect(after.notes).toEqual(before.notes);
  expect(semesterFingerprint(other.sem.id)).toBe(otherBefore);
  result.undo();
  expect(semesterRows(f.sem.id).attendanceRecords).toEqual(
    before.attendanceRecords,
  );
  // A mark logged after the reset is never overwritten by Undo.
  const again = clearSemesterAttendance(
    f.sem.id,
    JSON.stringify(semesterRows(f.sem.id)),
    "RESET",
  );
  markOccurrence({
    onDate: "2026-01-05",
    slotId: f.slot.id,
    status: "absent",
    expectedRevision: null,
  });
  expect(() => again.undo()).toThrow("Nothing was restored");
});
test("full reset requires exact RESET, deletes only its semester and a validated backup restores read-only history", () => {
  const f = contentFixture(),
    other = fixture();
  markOccurrence({
    onDate: "2026-01-05",
    slotId: f.slot.id,
    status: "present",
    expectedRevision: null,
  });
  saveContent(f.scope, "note", {
    title: "Keep in backup",
    body: "**body**",
    pinned: true,
  });
  const snapshot = semesterRows(f.sem.id),
    expected = JSON.stringify(snapshot);
  const backup = parseSemesterBackup({
    format: "attendance-tracker/semester",
    version: 1,
    createdAt: Date.now(),
    rows: snapshot,
    attachments: [],
  });
  const otherBefore = semesterFingerprint(other.sem.id);
  expect(() => resetSemester(f.sem.id, expected, "reset")).toThrow("RESET");
  expect(() => resetSemester(f.sem.id, "stale", "RESET")).toThrow("changed");
  expect(semesterFingerprint(f.sem.id)).toBe(expected);
  resetSemester(f.sem.id, expected, "RESET");
  expect(semesterRows(f.sem.id).semesters).toEqual([]);
  expect(semesterFingerprint(other.sem.id)).toBe(otherBefore);
  expect(settingsRepository.get("activeSemesterId")?.value).toBeNull();
  restoreSemesterBackup(backup, new Map());
  const restored = semesterRows(f.sem.id);
  expect(restored.semesters[0].archivedAt).not.toBeNull();
  expect(restored.attendanceRecords).toEqual(snapshot.attendanceRecords);
  expect(restored.notes).toEqual(snapshot.notes);
  expect(restored.topics).toEqual(snapshot.topics);
  expect(() => restoreSemesterBackup(backup, new Map())).toThrow(
    "already exists",
  );
  expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
});
test("corrupt backups reject wrong versions, missing tables, unsafe paths and cross-semester data", () => {
  const f = fixture(),
    rows = semesterRows(f.sem.id);
  const envelope = {
    format: "attendance-tracker/semester",
    version: 1,
    createdAt: Date.now(),
    rows,
    attachments: [],
  };
  expect(() => parseSemesterBackup({ ...envelope, version: 2 })).toThrow();
  expect(() =>
    parseSemesterBackup({ ...envelope, rows: { ...rows, topics: undefined } }),
  ).toThrow();
  expect(() =>
    parseSemesterBackup({
      ...envelope,
      rows: {
        ...rows,
        subjects: [
          {
            ...rows.subjects[0],
            semesterId: "00000000-0000-4000-8000-000000000000",
          },
        ],
      },
    }),
  ).toThrow("another semester");
  const invalid = { ...envelope, rows: { ...rows, topics: [{ id: "bad" }] } };
  expect(() => parseSemesterBackup(invalid)).toThrow();
  resetSemester(f.sem.id, JSON.stringify(rows), "RESET");
  const bad = {
    ...envelope,
    rows: { ...rows, subjects: [{ ...rows.subjects[0], color: "bad" }] },
  };
  expect(() =>
    restoreSemesterBackup(
      bad as Parameters<typeof restoreSemesterBackup>[0],
      new Map(),
    ),
  ).toThrow("color");
  expect(semestersRepository.get(f.sem.id)).toBeUndefined();
});

test("reset and recovery preserve nested folders and attachment metadata; malformed attachment inventory is rejected", () => {
  const f = fixture();
  const root = foldersRepository.create({
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    name: "Root",
    normalizedName: "root",
  });
  const child = foldersRepository.create({
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    parentId: root.id,
    name: "Child",
    normalizedName: "child",
  });
  const file = filesRepository.create({
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    folderId: child.id,
    name: "Empty.txt",
    mimeType: "text/plain",
    sizeBytes: 0,
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    relativePath: `subjects/${f.subject.id}/files/empty.txt`,
    state: "ready",
  });
  const other = fixture();
  settingsRepository.set("activeSemesterId", other.sem.id, null);
  const rows = semesterRows(f.sem.id),
    envelope = {
      format: "attendance-tracker/semester",
      version: 1,
      createdAt: Date.now(),
      rows,
      attachments: [{ id: file.id, base64: "" }],
    };
  const backup = parseSemesterBackup(envelope);
  expect(() => parseSemesterBackup({ ...envelope, attachments: [] })).toThrow(
    "inventory",
  );
  expect(() =>
    parseSemesterBackup({
      ...envelope,
      attachments: [...envelope.attachments, ...envelope.attachments],
    }),
  ).toThrow("inventory");
  expect(() =>
    parseSemesterBackup({
      ...envelope,
      rows: { ...rows, files: [{ ...file, relativePath: "../escape" }] },
    }),
  ).toThrow();
  expect(() =>
    parseSemesterBackup({
      ...envelope,
      rows: { ...rows, files: [{ ...file, sizeBytes: 3 }] },
    }),
  ).toThrow("incomplete");
  expect(() =>
    parseSemesterBackup({
      ...envelope,
      attachments: [{ id: file.id, base64: "A===" }],
    }),
  ).toThrow();
  expect(() =>
    parseSemesterBackup({
      ...envelope,
      rows: { ...rows, files: [{ ...file, sizeBytes: 1 }] },
      attachments: [{ id: file.id, base64: "AAAA" }],
    }),
  ).toThrow("incomplete");
  const bigBytes = Buffer.alloc(1024 * 1024).toString("base64");
  expect(
    parseSemesterBackup({
      ...envelope,
      rows: { ...rows, files: [{ ...file, sizeBytes: 1024 * 1024 }] },
      attachments: [{ id: file.id, base64: bigBytes }],
    }).attachments[0].base64,
  ).toBe(bigBytes);
  resetSemester(f.sem.id, JSON.stringify(rows), "RESET");
  expect(settingsRepository.get("activeSemesterId")?.value).toBe(other.sem.id);
  expect(filesRepository.list()).toEqual([]);
  expect(foldersRepository.list()).toEqual([]);
  const restoredPath = `subjects/${f.subject.id}/files/restored.txt`;
  restoreSemesterBackup(backup, new Map([[file.id, restoredPath]]));
  expect(filesRepository.get(file.id)).toMatchObject({
    ...file,
    relativePath: restoredPath,
  });
  expect(foldersRepository.get(child.id)?.parentId).toBe(root.id);
  expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
});
test("starting a new semester refuses an active timer, while full reset clears it", () => {
  const f = contentFixture();
  startStudy(f.scope, 25, 5);
  const before = semesterFingerprint(f.sem.id);
  expect(() =>
    startNewSemester(
      f.sem.id,
      before,
      {
        name: "Next",
        startsOn: "2027-01-04",
        endsOn: "2027-05-31",
        targetBps: 7500,
      },
      f.sem.timezone,
      true,
      true,
    ),
  ).toThrow("timer");
  expect(semesterFingerprint(f.sem.id)).toBe(before);
  expect(() =>
    parseSemesterBackup({
      format: "attendance-tracker/semester",
      version: 1,
      createdAt: Date.now(),
      rows: semesterRows(f.sem.id),
      attachments: [],
    }),
  ).toThrow("timer");
  resetSemester(f.sem.id, before, "RESET");
  expect(mockDb.select().from(s.studySessions).all()).toEqual([]);
  expect(semestersRepository.list()).toEqual([]);
});

test("full-app preview validates without writing, restores all semesters and preserves device lock", () => {
  const f = contentFixture();
  const other = fixture();
  settingsRepository.set("activeSemesterId", f.sem.id, null);
  settingsRepository.set("theme", "dark", null);
  settingsRepository.set("appLock", true, null);
  const backup = captureAppBackup(false);
  expect(backup.rows.semesters).toHaveLength(2);
  expect(backup.preferences.theme).toBe("dark");
  expect(backup.preferences.appLock).toBeUndefined();
  const before = appFingerprint();
  validateAppRestore(backup);
  expect(appFingerprint()).toBe(before);
  subjectsRepository.update(other.subject.id, other.subject.revision, {
    name: "Changed",
    normalizedName: "changed",
  });
  const expected = appFingerprint();
  restoreAppRows(backup, expected, new Map());
  expect(subjectsRepository.get(other.subject.id)?.name).toBe(
    other.subject.name,
  );
  expect(subjectContent(f.scope).topics).toHaveLength(1);
  expect(settingsRepository.get("appLock")?.value).toBe(true);
  expect(settingsRepository.get("activeSemesterId")?.value).toBe(f.sem.id);
  expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
});
test("full-app corrupt relationships and stale preview leave the entire database unchanged", () => {
  const f = fixture();
  const backup = captureAppBackup(false);
  const before = appFingerprint();
  const corrupt = {
    ...backup,
    rows: {
      ...backup.rows,
      timetableSlots: [
        {
          ...backup.rows.timetableSlots[0],
          subjectId: "10000000-0000-4000-8000-000000000999",
        },
      ],
    },
  };
  expect(() => validateAppRestore(corrupt)).toThrow();
  expect(appFingerprint()).toBe(before);
  const invalidColor = {
    ...backup,
    rows: {
      ...backup.rows,
      subjects: [{ ...backup.rows.subjects[0], color: "bad" }],
    },
  };
  expect(() => validateAppRestore(invalidColor)).toThrow();
  expect(appFingerprint()).toBe(before);
  subjectsRepository.update(f.subject.id, f.subject.revision, {
    teacher: "New teacher",
  });
  const changed = appFingerprint();
  expect(() => restoreAppRows(backup, before, new Map())).toThrow(
    "changed after preview",
  );
  expect(appFingerprint()).toBe(changed);
});
test("full-app JSON restore keeps attachment metadata missing and restores nested folders", () => {
  const f = fixture();
  const root = foldersRepository.create({
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    name: "Root",
    normalizedName: "root",
  });
  const child = foldersRepository.create({
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    parentId: root.id,
    name: "Child",
    normalizedName: "child",
  });
  const file = filesRepository.create({
    semesterId: f.sem.id,
    subjectId: f.subject.id,
    folderId: child.id,
    name: "notes.txt",
    mimeType: "text/plain",
    sizeBytes: 3,
    sha256: "a".repeat(64),
    relativePath: "files/old",
    state: "ready",
  });
  const backup = captureAppBackup(false);
  validateAppRestore(backup);
  restoreAppRows(
    backup,
    appFingerprint(),
    new Map([[file.id, "restore-files/fresh"]]),
  );
  expect(filesRepository.get(file.id)).toMatchObject({
    relativePath: "restore-files/fresh",
    state: "missing",
    sha256: file.sha256,
  });
  expect(foldersRepository.get(child.id)?.parentId).toBe(root.id);
  const zip = captureAppBackup(true);
  expect(zip.rows.files[0].state).toBe("missing");
  validateAppRestore(zip);
});
test("full-app snapshot pauses timers without crediting time on the receiving phone", () => {
  const f = contentFixture();
  const at = Date.now();
  startStudy(f.scope, 25, 5);
  const backup = captureAppBackup(false, at + 60000);
  expect(backup.rows.studySessions[0]).toMatchObject({
    state: "paused",
    activeSeconds: 60,
  });
  expect(studyData(f.scope).active?.state).toBe("running");
  restoreAppRows(backup, appFingerprint(), new Map());
  expect(
    timerSnapshot(studyData(f.scope).active!, at + 86400000).activeSeconds,
  ).toBe(60);
});
