import { eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { getDatabase, type Database } from "../client";
import * as s from "../schema";
import { localToday, normalizeName } from "../validation";
import { write, StaleRevisionError } from "./write";
import { validateSlots } from "@/lib/timetable";
import { mondayAnchor } from "@/lib/attendance";

export type SlotRow = typeof s.timetableSlots.$inferSelect;
export type SubjectRow = typeof s.subjects.$inferSelect;
export type SlotDraft = Pick<
  SlotRow,
  | "subjectId"
  | "classTypeId"
  | "weekday"
  | "parity"
  | "startMinute"
  | "endMinute"
  | "room"
  | "teacher"
  | "countsAs"
> & { id?: string };
export function timetableData(
  semesterId: string,
  db: Database = getDatabase(),
) {
  const semester = db
    .select()
    .from(s.semesters)
    .where(eq(s.semesters.id, semesterId))
    .get();
  if (!semester) throw new Error("Select a semester before adding classes.");
  const subjects = db
    .select()
    .from(s.subjects)
    .where(eq(s.subjects.semesterId, semesterId))
    .all();
  const types = db
    .select()
    .from(s.classTypes)
    .where(eq(s.classTypes.semesterId, semesterId))
    .all();
  const versions = db
    .select()
    .from(s.timetableVersions)
    .where(eq(s.timetableVersions.semesterId, semesterId))
    .all();
  const slots = db
    .select()
    .from(s.timetableSlots)
    .where(eq(s.timetableSlots.semesterId, semesterId))
    .all();
  const records = db
    .select()
    .from(s.attendanceRecords)
    .where(eq(s.attendanceRecords.semesterId, semesterId))
    .all();
  const extras = db
    .select()
    .from(s.extraClasses)
    .where(eq(s.extraClasses.semesterId, semesterId))
    .all();
  return { semester, subjects, types, versions, slots, records, extras };
}
export type TimetableData = ReturnType<typeof timetableData>;
export function scheduleFingerprint(data: TimetableData) {
  return JSON.stringify([
    data.semester,
    data.versions,
    data.slots,
    data.types,
    data.subjects,
    data.records,
    data.extras,
  ]);
}
const meta = () => ({
  id: randomUUID(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  revision: 1,
});

// Explicit setup action, never a render-time write. Existing defaults are retained.
export function ensureClassTypes(semesterId: string) {
  return write((db) => {
    const existing = db
      .select()
      .from(s.classTypes)
      .where(eq(s.classTypes.semesterId, semesterId))
      .all();
    const created: (typeof s.classTypes.$inferSelect)[] = [];
    for (const name of ["Lecture", "Lab", "Tutorial"])
      if (!existing.some((t) => t.normalizedName === normalizeName(name)))
        created.push(
          db
            .insert(s.classTypes)
            .values({
              ...meta(),
              semesterId,
              name,
              normalizedName: normalizeName(name),
              defaultCountsAs: 1,
            })
            .returning()
            .get(),
        );
    return {
      created: created.length,
      undo: () =>
        write((tx) => {
          for (const row of created) {
            const current = tx
              .select()
              .from(s.classTypes)
              .where(eq(s.classTypes.id, row.id))
              .get();
            if (!current || current.revision !== row.revision)
              throw new StaleRevisionError();
            tx.delete(s.classTypes).where(eq(s.classTypes.id, row.id)).run();
          }
        }),
    };
  });
}
export function createTimetableSemester(
  name: string,
  startsOn: string,
  endsOn: string,
  timezone: string,
  targetBps = 7500,
) {
  return write((db) =>
    createTimetableSemesterInTransaction(
      name,
      startsOn,
      endsOn,
      timezone,
      targetBps,
      db,
    ),
  );
}
export function createTimetableSemesterInTransaction(
  name: string,
  startsOn: string,
  endsOn: string,
  timezone: string,
  targetBps: number,
  db: Database,
) {
  const semester = db
    .insert(s.semesters)
    .values({
      ...meta(),
      name: name.trim(),
      startsOn,
      endsOn,
      timezone,
      weekAnchor: mondayAnchor(startsOn),
      targetBps,
    })
    .returning()
    .get();
  for (const name of ["Lecture", "Lab", "Tutorial"])
    db.insert(s.classTypes)
      .values({
        ...meta(),
        semesterId: semester.id,
        name,
        normalizedName: normalizeName(name),
        defaultCountsAs: 1,
      })
      .run();
  const previous = db
    .select()
    .from(s.settings)
    .where(eq(s.settings.key, "activeSemesterId"))
    .get();
  db.insert(s.settings)
    .values({
      key: "activeSemesterId",
      value: semester.id,
      updatedAt: Date.now(),
      revision: 1,
    })
    .onConflictDoUpdate({
      target: s.settings.key,
      set: {
        value: semester.id,
        updatedAt: Date.now(),
        revision: (previous?.revision ?? 0) + 1,
      },
    })
    .run();
  const saved = scheduleFingerprint(timetableData(semester.id, db));
  return {
    semester,
    undo: () =>
      write((tx) => {
        if (scheduleFingerprint(timetableData(semester.id, tx)) !== saved)
          throw new Error("Semester changed; it has been preserved.");
        const current = tx
          .select()
          .from(s.settings)
          .where(eq(s.settings.key, "activeSemesterId"))
          .get();
        if (current?.value !== semester.id) throw new StaleRevisionError();
        if (previous)
          tx.update(s.settings)
            .set({ ...previous, revision: current.revision + 1 })
            .where(eq(s.settings.key, "activeSemesterId"))
            .run();
        else
          tx.delete(s.settings)
            .where(eq(s.settings.key, "activeSemesterId"))
            .run();
        tx.delete(s.classTypes)
          .where(eq(s.classTypes.semesterId, semester.id))
          .run();
        tx.delete(s.semesters).where(eq(s.semesters.id, semester.id)).run();
      }),
  };
}

export type SaveTimetableInput = {
  semesterId: string;
  expectedFingerprint: string;
  sourceVersionId?: string;
  slots: SlotDraft[];
  scope?: "today" | "semester";
};
export function saveTimetable(input: SaveTimetableInput) {
  return write((db) => {
    const result = saveTimetableInTransaction(input, db);
    return {
      version: result.version,
      undo: () => write(result.undoInTransaction),
    };
  });
}
export function saveTimetableInTransaction(
  input: SaveTimetableInput,
  db: Database,
) {
  const before = timetableData(input.semesterId, db);
  if (scheduleFingerprint(before) !== input.expectedFingerprint)
    throw new StaleRevisionError();
  if (before.semester.archivedAt !== null)
    throw new Error("This semester is archived.");
  if (before.records.length && !input.scope)
    throw new Error("Choose when to apply this timetable.");
  const today = localToday(before.semester.timezone);
  const from =
    input.scope === "today"
      ? today < before.semester.startsOn
        ? before.semester.startsOn
        : today
      : before.semester.startsOn;
  if (from > before.semester.endsOn)
    throw new Error(
      "This semester has ended. Apply to the whole semester to correct its timetable.",
    );
  const source = before.versions.find(
    (v) => v.id === input.sourceVersionId && v.supersededAt === null,
  );
  if (input.sourceVersionId && !source) throw new StaleRevisionError();
  validateSlots(input.slots);
  const originals = before.slots.filter(
    (slot) => slot.versionId === source?.id,
  );
  const seenIds = new Set<string>();
  for (const slot of input.slots) {
    const old = originals.find((s) => s.id === slot.id);
    if (slot.id && (!old || seenIds.has(slot.id)))
      throw new StaleRevisionError();
    if (slot.id) seenIds.add(slot.id);
    const subject = before.subjects.find((s) => s.id === slot.subjectId);
    const type = before.types.find((t) => t.id === slot.classTypeId);
    if (
      !subject ||
      (subject.archivedAt !== null && old?.subjectId !== subject.id)
    )
      throw new Error("Choose an active subject.");
    if (!type || (type.archivedAt !== null && old?.classTypeId !== type.id))
      throw new Error("Choose an active class type.");
    if (!Number.isSafeInteger(slot.countsAs) || slot.countsAs < 1)
      throw new Error("Class weight must be a positive whole number.");
  }
  const affected = before.versions.filter(
    (v) =>
      v.supersededAt === null && (!v.effectiveUntil || v.effectiveUntil > from),
  );
  for (const version of affected)
    db.update(s.timetableVersions)
      .set({
        supersededAt: Date.now(),
        updatedAt: Date.now(),
        revision: sql`${s.timetableVersions.revision} + 1`,
      })
      .where(eq(s.timetableVersions.id, version.id))
      .run();
  const createdVersions: string[] = [];
  const clone = (
    drafts: SlotDraft[],
    start: string,
    until: string | null,
    label: string,
  ) => {
    const version = db
      .insert(s.timetableVersions)
      .values({
        ...meta(),
        semesterId: input.semesterId,
        effectiveFrom: start,
        effectiveUntil: until,
        label,
      })
      .returning()
      .get();
    createdVersions.push(version.id);
    for (const draft of drafts) {
      const old = before.slots.find((s) => s.id === draft.id);
      db.insert(s.timetableSlots)
        .values({
          ...draft,
          ...meta(),
          semesterId: input.semesterId,
          versionId: version.id,
          lineageId: old ? (old.lineageId ?? old.id) : null,
        })
        .run();
    }
    return version;
  };
  const prefix = affected.find((v) => v.effectiveFrom < from);
  if (prefix)
    clone(
      before.slots.filter((s) => s.versionId === prefix.id),
      prefix.effectiveFrom,
      from,
      prefix.label,
    );
  const version = clone(input.slots, from, null, `Timetable from ${from}`);
  const saved = scheduleFingerprint(timetableData(input.semesterId, db));
  return {
    version,
    undoInTransaction: (tx: Database) => {
      if (scheduleFingerprint(timetableData(input.semesterId, tx)) !== saved)
        throw new Error(
          "Timetable or attendance changed; it has been preserved.",
        );
      for (const id of createdVersions) {
        tx.delete(s.timetableSlots)
          .where(eq(s.timetableSlots.versionId, id))
          .run();
        tx.delete(s.timetableVersions)
          .where(eq(s.timetableVersions.id, id))
          .run();
      }
      for (const old of affected)
        tx.update(s.timetableVersions)
          .set({
            supersededAt: null,
            updatedAt: Date.now(),
            revision: sql`${s.timetableVersions.revision} + 1`,
          })
          .where(eq(s.timetableVersions.id, old.id))
          .run();
    },
  };
}
