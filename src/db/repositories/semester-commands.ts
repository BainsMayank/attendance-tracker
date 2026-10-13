import { eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { getDatabase, type Database } from "../client";
import * as s from "../schema";
import { localToday, validateDatabase } from "../validation";
import { ledgerTotals, mondayAnchor, dayNumber } from "@/lib/attendance";
import { selectVersion } from "@/lib/timetable";
import { write } from "./write";
import { createTimetableSemesterInTransaction } from "./timetable-commands";
import {
  deleteSemesterRows,
  semesterFingerprint,
  semesterRows,
} from "./semester-data";

const meta = () => ({
  id: randomUUID(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  revision: 1,
});
function editable(id: string, expected: string, db: Database) {
  const data = semesterRows(id, db);
  if (!data.semesters[0] || data.semesters[0].archivedAt !== null)
    throw new Error("Archived or unavailable semester is read-only.");
  if (JSON.stringify(data) !== expected)
    throw new Error("Semester changed. Reload before trying again.");
  return data;
}
export type SemesterDraft = {
  name: string;
  startsOn: string;
  endsOn: string;
  targetBps: number;
};
export function saveSemester(
  id: string,
  expected: string,
  draft: SemesterDraft,
) {
  return write((db) => {
    const before = editable(id, expected, db),
      sem = before.semesters[0];
    dayNumber(draft.startsOn);
    dayNumber(draft.endsOn);
    if (draft.endsOn < draft.startsOn)
      throw new Error("End date must be on or after start date.");
    // A week-anchor shift can silently change the meaning of existing alternating schedules.
    if (
      mondayAnchor(draft.startsOn) !== sem.weekAnchor &&
      before.timetableSlots.length
    )
      throw new Error(
        "Changing the start week would change timetable parity. Start a new semester instead.",
      );
    db.update(s.semesters)
      .set({
        ...draft,
        name: draft.name.trim(),
        weekAnchor: mondayAnchor(draft.startsOn),
        revision: sem.revision + 1,
        updatedAt: Date.now(),
      })
      .where(eq(s.semesters.id, id))
      .run();
    const saved = semesterFingerprint(id, db);
    return {
      undo: () =>
        write((tx) => {
          editable(id, saved, tx);
          tx.update(s.semesters)
            .set({ ...sem, revision: sem.revision + 2, updatedAt: Date.now() })
            .where(eq(s.semesters.id, id))
            .run();
        }),
    };
  });
}

export function startNewSemester(
  id: string | undefined,
  expected: string | undefined,
  draft: SemesterDraft,
  timezone: string,
  copySubjects: boolean,
  copyTimetable: boolean,
) {
  const db = getDatabase();
  const result = db.transaction((tx) => {
    const old = id ? editable(id, expected!, tx) : undefined;
    if (
      old?.studySessions.some(
        (r) => r.state === "running" || r.state === "paused",
      )
    )
      throw new Error(
        "Finish or discard the active study timer before starting a new semester.",
      );
    if (copyTimetable && !copySubjects)
      throw new Error("Copy subjects to copy their timetable.");
    const created = createTimetableSemesterInTransaction(
      draft.name,
      draft.startsOn,
      draft.endsOn,
      timezone,
      draft.targetBps,
      tx,
    ).semester;
    if (old && copySubjects) {
      const subjects = new Map<string, string>(),
        types = new Map<string, string>();
      for (const row of old.subjects.filter((r) => r.archivedAt === null)) {
        const next = { ...row, ...meta(), semesterId: created.id };
        tx.insert(s.subjects).values(next).run();
        subjects.set(row.id, next.id);
      }
      if (copyTimetable) {
        tx.delete(s.classTypes)
          .where(eq(s.classTypes.semesterId, created.id))
          .run();
        for (const row of old.classTypes) {
          const next = { ...row, ...meta(), semesterId: created.id };
          tx.insert(s.classTypes).values(next).run();
          types.set(row.id, next.id);
        }
        const oldSem = old.semesters[0];
        const today = localToday(oldSem.timezone);
        const date =
          today < oldSem.startsOn
            ? oldSem.startsOn
            : today > oldSem.endsOn
              ? oldSem.endsOn
              : today;
        const version = selectVersion(old.timetableVersions, date);
        if (version) {
          const nextVersion = {
            ...meta(),
            semesterId: created.id,
            label: "Copied timetable",
            effectiveFrom: created.startsOn,
          };
          tx.insert(s.timetableVersions).values(nextVersion).run();
          for (const row of old.timetableSlots.filter(
            (r) => r.versionId === version.id && subjects.has(r.subjectId),
          ))
            tx.insert(s.timetableSlots)
              .values({
                ...row,
                ...meta(),
                semesterId: created.id,
                versionId: nextVersion.id,
                subjectId: subjects.get(row.subjectId)!,
                classTypeId: types.get(row.classTypeId)!,
                lineageId: null,
              })
              .run();
        }
      }
    }
    if (id)
      tx.update(s.semesters)
        .set({
          archivedAt: Date.now(),
          revision: sql`${s.semesters.revision} + 1`,
          updatedAt: Date.now(),
        })
        .where(eq(s.semesters.id, id))
        .run();
    validateDatabase(tx);
    return {
      semester: created,
      old,
      saved: semesterFingerprint(created.id, tx),
      archived: id ? semesterFingerprint(id, tx) : undefined,
    };
  });
  return {
    semester: result.semester,
    undo: () =>
      db.transaction((tx) => {
        editable(result.semester.id, result.saved, tx);
        if (id && semesterFingerprint(id, tx) !== result.archived)
          throw new Error(
            "Archived history changed; newer data was preserved.",
          );
        const active = tx
          .select()
          .from(s.settings)
          .where(eq(s.settings.key, "activeSemesterId"))
          .get();
        if (active?.value !== result.semester.id)
          throw new Error("Active semester changed.");
        tx.update(s.settings)
          .set({ value: id ?? sql`'null'`, revision: active.revision + 1 })
          .where(eq(s.settings.key, "activeSemesterId"))
          .run();
        deleteSemesterRows(result.semester.id, tx);
        if (id)
          tx.update(s.semesters)
            .set({
              archivedAt: null,
              revision: sql`${s.semesters.revision} + 1`,
              updatedAt: Date.now(),
            })
            .where(eq(s.semesters.id, id))
            .run();
        validateDatabase(tx);
      }),
  };
}

export function resetSemester(
  id: string,
  expected: string,
  confirmation: string,
) {
  if (confirmation !== "RESET")
    throw new Error("Type RESET exactly to continue.");
  return write((db) => {
    const before = editable(id, expected, db);
    deleteSemesterRows(id, db);
    // Drop only setup drafts tied to the deleted semester; leave app preferences and archives alone.
    for (const key of ["onboardingDraft", "timetableImportDraft"]) {
      const setting = db
        .select()
        .from(s.settings)
        .where(eq(s.settings.key, key))
        .get();
      if (
        setting?.value &&
        typeof setting.value === "object" &&
        "semesterId" in setting.value &&
        setting.value.semesterId === id
      )
        db.delete(s.settings).where(eq(s.settings.key, key)).run();
    }
    const active = db
      .select()
      .from(s.settings)
      .where(eq(s.settings.key, "activeSemesterId"))
      .get();
    if (!active || active.value === id || active.value === null) {
      db.insert(s.settings)
        .values({
          key: "activeSemesterId",
          value: sql`'null'`,
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: s.settings.key,
          set: {
            value: sql`'null'`,
            updatedAt: Date.now(),
            revision: sql`${s.settings.revision}+1`,
          },
        })
        .run();
    }
    return { removed: before };
  });
}

export function holidayImpact(id: string, start: string, end: string) {
  const data = semesterRows(id);
  return data.attendanceRecords.filter(
    (r) =>
      r.kind === "occurrence" &&
      r.onDate >= start &&
      r.onDate <= end &&
      r.status !== "neutral" &&
      !data.extraClasses.find((e) => e.id === r.extraClassId)?.allowOnHoliday,
  ).length;
}
export function addSemesterHoliday(
  id: string,
  expected: string,
  title: string,
  start: string,
  end: string,
) {
  return write((db) => {
    const before = editable(id, expected, db);
    dayNumber(start);
    dayNumber(end);
    if (!title.trim() || start > end)
      throw new Error("Enter a holiday name and a valid inclusive range.");
    const holiday = {
      ...meta(),
      semesterId: id,
      title: title.trim(),
      startsOn: start,
      endsOn: end,
      subjectId: null,
    };
    db.insert(s.holidays).values(holiday).run();
    const records = before.attendanceRecords.filter(
      (r) =>
        r.kind === "occurrence" &&
        r.onDate >= start &&
        r.onDate <= end &&
        !before.extraClasses.find((e) => e.id === r.extraClassId)
          ?.allowOnHoliday,
    );
    for (const row of records)
      db.update(s.attendanceRecords)
        .set({
          status: "neutral",
          attendedDelta: 0,
          heldDelta: 0,
          revision: row.revision + 1,
          updatedAt: Date.now(),
        })
        .where(eq(s.attendanceRecords.id, row.id))
        .run();
    for (const subject of before.subjects)
      ledgerTotals(
        db
          .select()
          .from(s.attendanceRecords)
          .where(eq(s.attendanceRecords.subjectId, subject.id))
          .all(),
      );
    const saved = semesterFingerprint(id, db);
    return {
      undo: () =>
        write((tx) => {
          editable(id, saved, tx);
          tx.delete(s.holidays).where(eq(s.holidays.id, holiday.id)).run();
          for (const row of records)
            tx.update(s.attendanceRecords)
              .set({
                ...row,
                revision: row.revision + 2,
                updatedAt: Date.now(),
              })
              .where(eq(s.attendanceRecords.id, row.id))
              .run();
        }),
    };
  });
}
export function removeSemesterHoliday(
  id: string,
  expected: string,
  holidayId: string,
) {
  return write((db) => {
    const before = editable(id, expected, db),
      row = before.holidays.find((r) => r.id === holidayId);
    if (!row) throw new Error("Holiday unavailable.");
    db.delete(s.holidays).where(eq(s.holidays.id, row.id)).run();
    const saved = semesterFingerprint(id, db);
    return {
      undo: () =>
        write((tx) => {
          editable(id, saved, tx);
          tx.insert(s.holidays)
            .values({
              ...row,
              revision: row.revision + 1,
              updatedAt: Date.now(),
            })
            .run();
        }),
    };
  });
}

/** Deletes every attendance mark and balance adjustment; subjects, timetable and content stay. */
export function clearSemesterAttendance(
  id: string,
  expected: string,
  confirmation: string,
) {
  if (confirmation !== "RESET")
    throw new Error("Type RESET exactly to continue.");
  return write((db) => {
    editable(id, expected, db);
    const removed = db
      .select()
      .from(s.attendanceRecords)
      .where(eq(s.attendanceRecords.semesterId, id))
      .all();
    db.delete(s.attendanceRecords)
      .where(eq(s.attendanceRecords.semesterId, id))
      .run();
    return {
      removed: removed.length,
      undo: () =>
        write((tx) => {
          if (
            tx
              .select({ id: s.attendanceRecords.id })
              .from(s.attendanceRecords)
              .where(eq(s.attendanceRecords.semesterId, id))
              .get()
          )
            throw new Error("New attendance was logged since the reset. Nothing was restored.");
          for (let i = 0; i < removed.length; i += 200)
            tx.insert(s.attendanceRecords).values(removed.slice(i, i + 200)).run();
          validateDatabase(tx);
        }),
    };
  });
}
