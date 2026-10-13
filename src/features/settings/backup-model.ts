import { getTableColumns } from "drizzle-orm";
import { z } from "zod";
import {
  semesterTables,
  type SemesterRows,
} from "@/db/repositories/semester-data";
import { safePath } from "@/features/files/model";
import { portableSettings } from "./model";

export const MAX_JSON = 20 * 1024 * 1024;
export const MAX_FILES = 50 * 1024 * 1024;
export const MAX_ARCHIVE = MAX_JSON + MAX_FILES + 1024 * 1024;
export type AppBackup = {
  format: "attendance-tracker/app";
  version: 1;
  schemaVersion: 4;
  createdAt: number;
  activeSemesterId: string | null;
  attachments: "omitted" | "zip";
  rows: SemesterRows;
  preferences: Record<string, unknown>;
};
export function parseAppBackup(input: unknown): AppBackup {
  const value = z
    .object({
      format: z.literal("attendance-tracker/app"),
      version: z.literal(1),
      schemaVersion: z.literal(4),
      createdAt: z.number().int().nonnegative(),
      activeSemesterId: z.uuid().nullable(),
      attachments: z.enum(["omitted", "zip"]),
      rows: z.record(z.string(), z.unknown()),
      preferences: z.record(z.string(), z.unknown()),
    })
    .strict()
    .parse(input);
  if (Object.keys(value.rows).length !== Object.keys(semesterTables).length)
    throw new Error("Backup table inventory is incomplete.");
  let count = 0;
  const rows: Record<string, unknown> = {};
  for (const [key, table] of Object.entries(semesterTables)) {
    const shape: Record<string, z.ZodType> = {};
    for (const [name, column] of Object.entries(getTableColumns(table))) {
      const type =
        column.dataType === "number"
          ? z.number().finite()
          : column.dataType === "boolean"
            ? z.boolean()
            : z.string().max(1_000_000);
      shape[name] = column.notNull ? type : type.nullable();
    }
    const entries = z
      .array(z.object(shape).strict())
      .max(100000)
      .parse(value.rows[key]);
    count += entries.length;
    if (count > 100000) throw new Error("Backup exceeds 100,000 rows.");
    const ids = new Set<string>();
    for (const row of entries) {
      z.uuid().parse(row.id);
      if (ids.has(String(row.id))) throw new Error("Duplicate backup row.");
      ids.add(String(row.id));
    }
    rows[key] = entries;
  }
  const preferences: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value.preferences)) {
    if (!(key in portableSettings))
      throw new Error(`Unsupported backup preference: ${key}`);
    preferences[key] =
      portableSettings[key as keyof typeof portableSettings].parse(v);
  }
  const data = rows as SemesterRows;
  if (data.files.length > 10000)
    throw new Error("Backup exceeds 10,000 attachments.");
  const paths = new Set<string>();
  let bytes = 0;
  for (const f of data.files) {
    safePath(f.relativePath);
    if (paths.has(f.relativePath))
      throw new Error("Duplicate attachment path.");
    paths.add(f.relativePath);
    if (
      !Number.isSafeInteger(f.sizeBytes) ||
      f.sizeBytes < 0 ||
      !/^[a-f0-9]{64}$/.test(f.sha256)
    )
      throw new Error("Invalid attachment metadata.");
    if (f.state === "ready") bytes += f.sizeBytes;
    if (value.attachments === "zip" && ["staged", "error"].includes(f.state))
      throw new Error(`Resolve “${f.name}” before including files.`);
  }
  if (value.attachments === "zip" && bytes > MAX_FILES)
    throw new Error("Attached backups support up to 50 MiB of files.");
  if (
    value.activeSemesterId &&
    !data.semesters.some((s) => s.id === value.activeSemesterId)
  )
    throw new Error("Backup active semester is unavailable.");
  return { ...value, rows: data, preferences };
}
export function backupSummary(backup: AppBackup) {
  return {
    semesters: backup.rows.semesters.length,
    subjects: backup.rows.subjects.length,
    records: backup.rows.attendanceRecords.length,
    files: backup.rows.files.length,
    bytes: backup.rows.files
      .filter((f) => f.state === "ready")
      .reduce((n, f) => n + f.sizeBytes, 0),
    missingFiles: backup.rows.files.filter(
      (f) => f.state !== "ready" || backup.attachments === "omitted",
    ).length,
    rows: Object.values(backup.rows).reduce(
      (n, entries) => n + entries.length,
      0,
    ),
  };
}
