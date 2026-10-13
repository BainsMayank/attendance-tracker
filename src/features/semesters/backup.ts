import { Directory, File, Paths } from "expo-file-system";
import { CryptoDigestAlgorithm, digest, randomUUID } from "expo-crypto";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import {
  semesterFingerprint,
  semesterRows,
} from "@/db/repositories/semester-data";
import { restoreSemesterBackup } from "@/db/repositories/semester-restore";
import { attachments } from "@/features/files/service";
import { resetSemester } from "@/db/repositories/semester-commands";
import { semesterCleanup } from "./cleanup-service";
import { safePath } from "@/features/files/model";
import {
  MAX_BACKUP_BYTES,
  parseSemesterBackup,
  type SemesterBackup,
} from "./backup-model";

const local = (path: string) => new File(Paths.document, safePath(path));
async function hash(file: File) {
  return Array.from(
    new Uint8Array(
      await digest(CryptoDigestAlgorithm.SHA256, await file.bytes()),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export const exportSemesterBackup = (id: string, expected: string) =>
  attachments.settled(() => exportBackup(id, expected));
async function exportBackup(id: string, expected: string) {
  const rows = semesterRows(id);
  if (JSON.stringify(rows) !== expected)
    throw new Error("Semester changed. Reload before backing up.");
  if (rows.files.reduce((sum, f) => sum + f.sizeBytes, 0) > MAX_BACKUP_BYTES)
    throw new Error(
      "Semester backups currently support up to 50 MB of attachments.",
    );
  const attachments = [];
  for (const row of rows.files) {
    const file = local(row.relativePath);
    if (
      row.state !== "ready" ||
      !file.exists ||
      file.size !== row.sizeBytes ||
      (await hash(file)) !== row.sha256
    )
      throw new Error(
        `Resolve the missing or changed file “${row.name}” before backing up.`,
      );
    attachments.push({ id: row.id, base64: await file.base64() });
  }
  if (semesterFingerprint(id) !== expected)
    throw new Error("Semester changed during backup. Try again.");
  const backup = parseSemesterBackup({
    format: "attendance-tracker/semester",
    version: 1,
    createdAt: Date.now(),
    rows,
    attachments,
  });
  const directory = new Directory(Paths.document, "semester-backups");
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, `semester-${id}-${Date.now()}.json`);
  file.write(JSON.stringify(backup));
  // Verify the durable copy before offering it to the system share sheet.
  parseSemesterBackup(JSON.parse(await file.text()));
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      UTI: "public.json",
      dialogTitle: "Save semester backup",
    });
  return file.uri;
}
export async function pickSemesterBackup() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  if (file.size > 80 * 1024 * 1024)
    throw new Error("This backup is too large (80 MB limit).");
  return parseSemesterBackup(JSON.parse(await file.text()));
}
export const recoverSemesterBackup = (backup: SemesterBackup) =>
  attachments.settled(async () => {
    const paths = new Map<string, string>();
    for (const row of backup.rows.files) {
      if (!row.subjectId) throw new Error("Backup file has no subject.");
      paths.set(
        row.id,
        safePath(`subjects/${row.subjectId}/files/${randomUUID()}`),
      );
    }
    await semesterCleanup.prepare(randomUUID(), [...paths.values()]);
    try {
      for (const row of backup.rows.files) {
        const file = local(paths.get(row.id)!);
        file.parentDirectory.create({ intermediates: true, idempotent: true });
        file.write(backup.attachments.find((a) => a.id === row.id)!.base64, {
          encoding: "base64",
        });
        if (file.size !== row.sizeBytes || (await hash(file)) !== row.sha256)
          throw new Error(`Backup checksum failed for “${row.name}”.`);
      }
      return restoreSemesterBackup(backup, paths);
    } finally {
      // A committed restore keeps its bytes; failed cleanup remains journaled for startup.
      await semesterCleanup.recover().catch(() => {});
    }
  });
export const resetSemesterWithFiles = (
  id: string,
  expected: string,
  confirmation: string,
) =>
  attachments.settled(async () => {
    const rows = semesterRows(id);
    if (JSON.stringify(rows) !== expected)
      throw new Error("Semester changed. Reload before resetting.");
    await semesterCleanup.prepare(
      randomUUID(),
      rows.files.map((file) => file.relativePath),
    );
    try {
      resetSemester(id, expected, confirmation);
    } catch (error) {
      await semesterCleanup.recover(); // The transaction rolled back: referenced bytes stay intact.
      throw error;
    }
    // Reset has committed. Keep its completion screen available even if disk cleanup fails.
    try {
      return await semesterCleanup.recover();
    } catch {
      return ["Pending local cleanup"];
    }
  });
