import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { getDatabase, type Database } from "../client";
import * as s from "../schema";
import { StaleRevisionError } from "./write";
import { descendantIds, fileName, safeId, safePath, type FileRow, type FolderRow, type Scope, type Snapshot } from "@/features/files/model";

function scoped(db: Database, scope: Scope, writable = false) {
  safeId(scope.subjectId); safeId(scope.semesterId);
  const subject = db.select().from(s.subjects).where(eq(s.subjects.id, scope.subjectId)).get();
  const semester = db.select().from(s.semesters).where(eq(s.semesters.id, scope.semesterId)).get();
  if (!subject || !semester || subject.semesterId !== scope.semesterId) throw new Error("Subject unavailable");
  if (writable && (subject.archivedAt !== null || semester.archivedAt !== null)) throw new Error("Archived subjects are read-only");
}
export function fileData(scope: Scope): Snapshot {
  const db = getDatabase(); scoped(db, scope);
  return {
    files: db.select().from(s.files).where(and(eq(s.files.subjectId, scope.subjectId), eq(s.files.semesterId, scope.semesterId))).all(),
    folders: db.select().from(s.folders).where(and(eq(s.folders.subjectId, scope.subjectId), eq(s.folders.semesterId, scope.semesterId))).all(),
  };
}
function destination(db: Database, scope: Scope, id: string | null) {
  if (!id) return;
  const folder = db.select().from(s.folders).where(eq(s.folders.id, id)).get();
  if (!folder || folder.subjectId !== scope.subjectId || folder.semesterId !== scope.semesterId) throw new Error("Destination folder unavailable");
}
function validateRow(row: FileRow, scope: Scope) {
  safePath(row.relativePath); safeId(row.id);
  if (row.subjectId !== scope.subjectId || row.semesterId !== scope.semesterId || !row.relativePath.startsWith(`subjects/${scope.subjectId}/files/`) || !/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.sizeBytes) || row.sizeBytes < 0)
    throw new Error("Invalid attachment metadata");
  fileName(row.name);
}
export function createFolder(scope: Scope, parentId: string | null, name: string) {
  return getDatabase().transaction(db => {
    scoped(db, scope, true); destination(db, scope, parentId);
    const now = Date.now(), title = fileName(name);
    const row = db.insert(s.folders).values({ ...scope, parentId, id: randomUUID(), name: title, normalizedName: title.toLocaleLowerCase(), createdAt: now, updatedAt: now }).returning().get();
    return { row, undo: () => removeEmptyFolder(scope, row) };
  });
}
function removeEmptyFolder(scope: Scope, row: FolderRow) {
  getDatabase().transaction(db => {
    scoped(db, scope, true);
    const deleted = db.delete(s.folders).where(and(eq(s.folders.id, row.id), eq(s.folders.revision, row.revision))).returning().get();
    if (!deleted) throw new StaleRevisionError(); // Foreign keys also reject a now populated folder.
  });
}
export function editEntry(scope: Scope, kind: "file" | "folder", row: FileRow | FolderRow, name: string, target: string | null) {
  const db = getDatabase();
  const apply = (expected: number, title: string, parent: string | null) => db.transaction(tx => {
    scoped(tx, scope, true); destination(tx, scope, parent);
    if (row.subjectId !== scope.subjectId || row.semesterId !== scope.semesterId) throw new Error("Subject mismatch");
    if (kind === "folder" && parent && descendantIds(fileData(scope).folders, row.id).has(parent)) throw new Error("A folder cannot move inside itself");
    const table = kind === "folder" ? s.folders : s.files;
    const patch = kind === "folder" ? { name: fileName(title), normalizedName: fileName(title).toLocaleLowerCase(), parentId: parent } : { name: fileName(title), folderId: parent };
    const saved = tx.update(table).set({ ...patch, revision: sql`${table.revision} + 1`, updatedAt: Date.now() }).where(and(eq(table.id, row.id), eq(table.revision, expected))).returning().get();
    if (!saved) throw new StaleRevisionError();
    return saved;
  });
  const saved = apply(row.revision, name, target);
  return { undo: () => apply(saved.revision, row.name, "parentId" in row ? row.parentId : row.folderId) };
}
export const attachmentRepository = {
  data: fileData,
  assertWritable: (scope: Scope) => scoped(getDatabase(), scope, true),
  insert: (scope: Scope, row: FileRow) => getDatabase().transaction(db => {
    scoped(db, scope, true); validateRow(row, scope); destination(db, scope, row.folderId);
    db.insert(s.files).values(row).run();
  }),
  state: (id: string, state: FileRow["state"]) => getDatabase().update(s.files).set({ state }).where(eq(s.files.id, id)).run(),
  remove: (scope: Scope, snapshot: Snapshot) => getDatabase().transaction(db => {
    scoped(db, scope, true);
    for (const row of snapshot.files) {
      validateRow(row, scope);
      if (!db.delete(s.files).where(and(eq(s.files.id, row.id), eq(s.files.revision, row.revision))).returning().get()) throw new StaleRevisionError();
    }
    for (const row of [...snapshot.folders].reverse()) {
      if (row.subjectId !== scope.subjectId || row.semesterId !== scope.semesterId) throw new Error("Subject mismatch");
      if (!db.delete(s.folders).where(and(eq(s.folders.id, row.id), eq(s.folders.revision, row.revision))).returning().get()) throw new StaleRevisionError();
    }
  }),
  restore: (scope: Scope, snapshot: Snapshot) => getDatabase().transaction(db => {
    scoped(db, scope, true);
    for (const row of snapshot.folders) {
      if (row.subjectId !== scope.subjectId || row.semesterId !== scope.semesterId) throw new Error("Subject mismatch");
      destination(db, scope, row.parentId);
      db.insert(s.folders).values({ ...row, revision: row.revision + 1 }).run();
    }
    for (const row of snapshot.files) {
      validateRow(row, scope); destination(db, scope, row.folderId);
      db.insert(s.files).values({ ...row, revision: row.revision + 1 }).run();
    }
  }),
};
