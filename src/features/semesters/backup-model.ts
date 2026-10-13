import { getTableColumns } from "drizzle-orm";
import { z } from "zod";
import {
  semesterTables,
  type SemesterRows,
} from "@/db/repositories/semester-data";
import { safePath } from "@/features/files/model";

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export type SemesterBackup = {
  format: "attendance-tracker/semester";
  version: 1;
  createdAt: number;
  rows: SemesterRows;
  attachments: { id: string; base64: string }[];
};
export function parseSemesterBackup(input: unknown): SemesterBackup {
  const envelope = z
    .object({
      format: z.literal("attendance-tracker/semester"),
      version: z.literal(1),
      createdAt: z.number().int().nonnegative(),
      rows: z.record(z.string(), z.unknown()),
      attachments: z
        .array(
          z
            .object({
              id: z.uuid(),
              base64: z.string().refine((text) => {
                // A simple scan handles large files without repeated-group regex stack growth.
                const padding = text.endsWith("==")
                  ? 2
                  : text.endsWith("=")
                    ? 1
                    : 0;
                return (
                  text.length % 4 === 0 &&
                  !/[^A-Za-z0-9+/]/.test(text.slice(0, text.length - padding))
                );
              }, "Invalid base64 attachment"),
            })
            .strict(),
        )
        .max(10000),
    })
    .strict()
    .parse(input);
  if (Object.keys(envelope.rows).length !== Object.keys(semesterTables).length)
    throw new Error("Backup table inventory is incomplete.");
  const rows: Record<string, unknown> = {};
  for (const [key, table] of Object.entries(semesterTables)) {
    const shape: Record<string, z.ZodType> = {};
    for (const [name, column] of Object.entries(getTableColumns(table))) {
      const type =
        column.dataType === "number"
          ? z.number().finite()
          : column.dataType === "boolean"
            ? z.boolean()
            : z.string();
      shape[name] = column.notNull ? type : type.nullable();
    }
    rows[key] = z
      .array(z.object(shape).strict())
      .max(100000)
      .parse(envelope.rows[key]);
  }
  const data = rows as SemesterRows;
  if (data.semesters.length !== 1)
    throw new Error("Backup must contain exactly one semester.");
  const id = data.semesters[0].id,
    subjects = new Set(data.subjects.map((r) => r.id));
  for (const [key, entries] of Object.entries(data)) {
    const seen = new Set<string>();
    for (const row of entries) {
      if (seen.has(row.id)) throw new Error("Duplicate backup row.");
      seen.add(row.id);
      if (
        key !== "semesters" &&
        (("semesterId" in row && row.semesterId !== id) ||
          (!("semesterId" in row) &&
            "subjectId" in row &&
            !subjects.has(row.subjectId)))
      )
        throw new Error("Backup contains data from another semester.");
    }
  }
  if (
    data.studySessions.some(
      (r) => r.state === "running" || r.state === "paused",
    )
  )
    throw new Error("Finish or discard the active timer before backing up.");
  const attachments = new Map(envelope.attachments.map((a) => [a.id, a]));
  if (
    attachments.size !== envelope.attachments.length ||
    attachments.size !== data.files.length
  )
    throw new Error("Backup attachment inventory does not match.");
  let size = 0;
  for (const file of data.files) {
    safePath(file.relativePath);
    const attachment = attachments.get(file.id);
    if (
      file.state !== "ready" ||
      !attachment ||
      (attachment.base64.length / 4) * 3 -
        (attachment.base64.endsWith("==")
          ? 2
          : attachment.base64.endsWith("=")
            ? 1
            : 0) !==
        file.sizeBytes
    )
      throw new Error("Backup attachment is incomplete.");
    size += file.sizeBytes;
  }
  if (size > MAX_BACKUP_BYTES)
    throw new Error(
      "Semester backups currently support up to 50 MB of attachments.",
    );
  return { ...envelope, rows: data };
}
