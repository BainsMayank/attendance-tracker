import { eq } from "drizzle-orm";
import { getDatabase, type Database } from "../client";
import * as s from "../schema";
import { semesterTables, type SemesterRows } from "./semester-data";
import { validateDatabase } from "../validation";
import {
  parseAppBackup,
  type AppBackup,
} from "@/features/settings/backup-model";
import { portableSettings } from "@/features/settings/model";
import { timerSnapshot } from "@/features/subjects/content-model";

export function captureAppBackup(
  includeFiles: boolean,
  now = Date.now(),
  db: Database = getDatabase(),
): AppBackup {
  const rows = Object.fromEntries(
    Object.entries(semesterTables).map(([key, table]) => [
      key,
      db
        .select()
        .from(table)
        .all()
        .sort((a, b) => a.id.localeCompare(b.id)),
    ]),
  ) as SemesterRows;
  // A snapshot resumes paused, never credits time spent outside the original phone.
  rows.studySessions = rows.studySessions.map((row) => {
    if (row.state !== "running" && row.state !== "paused") return row;
    const snap = timerSnapshot(row, now);
    return {
      ...row,
      state: "paused",
      activeSeconds: snap.activeSeconds,
      checkpointAt: now,
      phaseStartedAt: now - snap.phaseElapsed * 1000,
    };
  });
  rows.deadlines = rows.deadlines.map((r) => ({ ...r, notificationId: null }));
  const saved = db.select().from(s.settings).all();
  return parseAppBackup({
    format: "attendance-tracker/app",
    version: 1,
    schemaVersion: 4,
    createdAt: now,
    activeSemesterId:
      saved.find((r) => r.key === "activeSemesterId")?.value ?? null,
    attachments: includeFiles ? "zip" : "omitted",
    rows,
    preferences: Object.fromEntries(
      saved
        .filter((r) => r.key in portableSettings)
        .map((r) => [r.key, r.value]),
    ),
  });
}
export function appFingerprint(db: Database = getDatabase()) {
  return JSON.stringify([
    Object.entries(semesterTables).map(([key, table]) => [
      key,
      db.select().from(table).all(),
    ]),
    db
      .select()
      .from(s.settings)
      .all()
      .filter((r) => r.key in portableSettings || r.key === "activeSemesterId"),
  ]);
}
function replace(tx: Database, backup: AppBackup, paths?: Map<string, string>) {
  // Self references are restored in a second pass. Foreign keys stay enabled throughout.
  tx.update(s.folders).set({ parentId: null }).run();
  tx.update(s.timetableSlots).set({ lineageId: null }).run();
  for (const table of Object.values(semesterTables).reverse())
    tx.delete(table).run();
  for (const [key, table] of Object.entries(semesterTables)) {
    for (const original of backup.rows[key as keyof SemesterRows]) {
      const row = { ...original };
      if (key === "folders") Object.assign(row, { parentId: null });
      if (key === "timetableSlots") Object.assign(row, { lineageId: null });
      if (key === "files" && "relativePath" in row)
        Object.assign(row, {
          relativePath: paths?.get(row.id) ?? row.relativePath,
          state:
            backup.attachments === "zip" &&
            "state" in row &&
            row.state === "ready"
              ? "ready"
              : "missing",
        });
      tx.insert(table)
        .values(row as never)
        .run();
    }
  }
  for (const row of backup.rows.folders)
    if (row.parentId)
      tx.update(s.folders)
        .set({ parentId: row.parentId })
        .where(eq(s.folders.id, row.id))
        .run();
  for (const row of backup.rows.timetableSlots)
    if (row.lineageId)
      tx.update(s.timetableSlots)
        .set({ lineageId: row.lineageId })
        .where(eq(s.timetableSlots.id, row.id))
        .run();
  const preserved = new Set(["appLock", "feedbackEmail", "accountMetadata"]);
  for (const row of tx.select().from(s.settings).all())
    if (!preserved.has(row.key))
      tx.delete(s.settings).where(eq(s.settings.key, row.key)).run();
  const settings = {
    ...backup.preferences,
    ...(backup.activeSemesterId
      ? { activeSemesterId: backup.activeSemesterId }
      : {}),
    onboardingVersion: 1,
  };
  for (const [key, value] of Object.entries(settings)) {
    if (
      preserved.has(key) &&
      tx.select().from(s.settings).where(eq(s.settings.key, key)).get()
    )
      continue;
    tx.insert(s.settings)
      .values({ key, value, updatedAt: Date.now(), revision: 1 })
      .onConflictDoUpdate({
        target: s.settings.key,
        set: { value, updatedAt: Date.now() },
      })
      .run();
  }
  validateDatabase(tx);
  // SQL FK constraints cover relationships not rechecked in semantic validation.
  if (tx.all<{ table: string }>("PRAGMA foreign_key_check").length)
    throw new Error("Backup has invalid relationships.");
}
/** Run the real constraints inside an isolated transaction, then deliberately roll it back. */
export function validateAppRestore(backup: AppBackup) {
  const rollback = new Error("validated rollback");
  try {
    getDatabase().transaction((tx) => {
      replace(tx, parseAppBackup(backup));
      throw rollback;
    });
  } catch (e) {
    if (e !== rollback) throw e;
  }
}
export function restoreAppRows(
  backup: AppBackup,
  expected: string,
  paths: Map<string, string>,
) {
  return getDatabase().transaction((tx) => {
    if (appFingerprint(tx) !== expected)
      throw new Error(
        "Your data changed after preview. Choose the backup again.",
      );
    replace(tx, parseAppBackup(backup), paths);
  });
}
