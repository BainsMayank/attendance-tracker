import { eq, getTableColumns, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { getDatabase } from "../client";
import * as s from "../schema";

// Parent-first order for backup restoration; settings are app preferences, not semester data.
export const semesterTables = {
  semesters: s.semesters,
  subjects: s.subjects,
  classTypes: s.classTypes,
  timetableVersions: s.timetableVersions,
  timetableSlots: s.timetableSlots,
  extraClasses: s.extraClasses,
  holidays: s.holidays,
  attendanceRecords: s.attendanceRecords,
  classNotes: s.classNotes,
  units: s.units,
  topics: s.topics,
  notes: s.notes,
  deadlines: s.deadlines,
  marks: s.marks,
  links: s.links,
  folders: s.folders,
  files: s.files,
  studySessions: s.studySessions,
};
export type SemesterRows = {
  [
    K in keyof typeof semesterTables
  ]: (typeof semesterTables)[K]["$inferSelect"][];
};
export function semesterRows(
  id: string,
  db: Database = getDatabase(),
): SemesterRows {
  const subjectIds = db
    .select({ id: s.subjects.id })
    .from(s.subjects)
    .where(eq(s.subjects.semesterId, id))
    .all()
    .map((r) => r.id);
  const entries = Object.entries(semesterTables).map(([key, table]) => {
    const columns = getTableColumns(table);
    const condition =
      key === "semesters"
        ? eq(s.semesters.id, id)
        : "semesterId" in columns
          ? eq(columns.semesterId, id)
          : "subjectId" in columns
            ? inArray(columns.subjectId, subjectIds)
            : undefined;
    return [
      key,
      db
        .select()
        .from(table)
        .where(condition)
        .all()
        .sort((a, b) => a.id.localeCompare(b.id)),
    ];
  });
  return Object.fromEntries(entries) as SemesterRows;
}
export const semesterFingerprint = (id: string, db?: Database) =>
  JSON.stringify(semesterRows(id, db));

/** Generic repository writes cannot alter any row belonging to an archived semester. */
export function archivedSnapshot(db: Database) {
  return db
    .select()
    .from(s.semesters)
    .all()
    .filter((r) => r.archivedAt !== null)
    .map((r) => ({ id: r.id, fingerprint: semesterFingerprint(r.id, db) }));
}
export function assertArchivedUnchanged(
  db: Database,
  before: ReturnType<typeof archivedSnapshot>,
) {
  if (before.some((r) => semesterFingerprint(r.id, db) !== r.fingerprint))
    throw new Error("Archived semesters are read-only.");
}

export function deleteSemesterRows(id: string, db: Database) {
  const snapshot = semesterRows(id, db);
  // Break self-references before child-first deletion. This transaction is never exposed half complete.
  db.update(s.folders)
    .set({ parentId: null })
    .where(eq(s.folders.semesterId, id))
    .run();
  for (const [key, table] of Object.entries(semesterTables).reverse()) {
    const columns = getTableColumns(table);
    const condition =
      key === "semesters"
        ? eq(s.semesters.id, id)
        : "semesterId" in columns
          ? eq(columns.semesterId, id)
          : "subjectId" in columns
            ? inArray(
                columns.subjectId,
                snapshot.subjects.map((r) => r.id),
              )
            : undefined;
    if (!condition) throw new Error("Unknown semester table scope.");
    db.delete(table).where(condition).run();
  }
  return snapshot;
}
