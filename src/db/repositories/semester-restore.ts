import { eq } from "drizzle-orm";
import { getDatabase } from "../client";
import * as s from "../schema";
import { validateDatabase } from "../validation";
import { semesterTables, type SemesterRows } from "./semester-data";
import {
  parseSemesterBackup,
  type SemesterBackup,
} from "@/features/semesters/backup-model";

/** Restores only a deleted semester, as read-only history. Existing data is never replaced. */
export function restoreSemesterBackup(
  input: SemesterBackup,
  paths: Map<string, string>,
) {
  const backup = parseSemesterBackup(input);
  const db = getDatabase();
  return db.transaction((tx) => {
    const semester = backup.rows.semesters[0];
    if (
      tx.select().from(s.semesters).where(eq(s.semesters.id, semester.id)).get()
    )
      throw new Error(
        "This semester already exists. No existing data was replaced.",
      );
    for (const [key, table] of Object.entries(semesterTables)) {
      const rows = backup.rows[key as keyof SemesterRows];
      if (key === "folders") {
        const pending = [...backup.rows.folders],
          inserted = new Set<string>();
        while (pending.length) {
          const index = pending.findIndex(
            (r) => !r.parentId || inserted.has(r.parentId),
          );
          if (index < 0) throw new Error("Invalid folder tree in backup.");
          const [row] = pending.splice(index, 1);
          tx.insert(s.folders).values(row).run();
          inserted.add(row.id);
        }
        continue;
      }
      for (const original of rows) {
        const row = { ...original };
        if (key === "semesters" && "archivedAt" in row)
          row.archivedAt = Date.now();
        if (key === "deadlines" && "notificationId" in row)
          row.notificationId = null;
        if (key === "files" && "relativePath" in row) {
          const path = paths.get(row.id);
          if (!path) throw new Error("Restored attachment path missing.");
          row.relativePath = path;
        }
        tx.insert(table)
          .values(row as never)
          .run();
      }
    }
    validateDatabase(tx);
    return semester.id;
  });
}
