import { Directory, File, Paths } from "expo-file-system";
import { digest, CryptoDigestAlgorithm, randomUUID } from "expo-crypto";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { zipSync, strToU8 } from "fflate";
import {
  captureAppBackup,
  appFingerprint,
  validateAppRestore,
  restoreAppRows,
} from "@/db/repositories/app-backup";
import { attachments, localFile } from "@/features/files/service";
import { semesterCleanup } from "@/features/semesters/cleanup-service";
import { safePath } from "@/features/files/model";
import {
  backupSummary,
  MAX_ARCHIVE,
  MAX_JSON,
  type AppBackup,
} from "./backup-model";
import { decodeBackup } from "./backup-archive";
import { readPreference, savePreference, syncAppearance } from "./preferences";
import { backupPreferencesSchema, backupStateSchema } from "./model";

const directory = () => new Directory(Paths.document, "app-backups");
export async function checksum(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(
      await digest(CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
const yieldWork = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
export function localBackups() {
  return directory().exists
    ? directory()
        .list()
        .filter(
          (f): f is File =>
            f instanceof File && /^weekly-\d+\.(json|zip)$/.test(f.name),
        )
        .sort((a, b) => b.name.localeCompare(a.name))
    : [];
}
async function createBackup(
  includeFiles: boolean,
  kind: "weekly" | "manual" | "safety",
) {
  const before = appFingerprint();
  const backup = captureAppBackup(includeFiles);
  const json = strToU8(JSON.stringify(backup));
  if (json.length > MAX_JSON)
    throw new Error("Backup data exceeds the 20 MiB JSON limit.");
  let bytes = json;
  if (includeFiles) {
    const archive: Record<string, Uint8Array> = { "backup.json": json };
    for (const row of backup.rows.files) {
      if (row.state === "missing") continue;
      const file = localFile(row.relativePath);
      if (!file.exists || file.size !== row.sizeBytes)
        throw new Error(
          `“${row.name}” is missing or changed. Reimport it or exclude attached files.`,
        );
      const content = await file.bytes();
      if ((await checksum(content)) !== row.sha256)
        throw new Error(
          `Checksum failed for “${row.name}”. Reimport it before backing up.`,
        );
      archive[`files/${row.id}`] = content;
      await yieldWork();
    }
    // Store ZIP entries without compression: bounded memory and no expensive deflate on the UI thread.
    bytes = zipSync(archive, { level: 0 });
  }
  if (appFingerprint() !== before)
    throw new Error("Your data changed during backup. Try again.");
  directory().create({ intermediates: true, idempotent: true });
  const temp = new File(directory(), `${kind}-${backup.createdAt}.tmp`);
  const final = new File(
    directory(),
    `${kind}-${backup.createdAt}.${includeFiles ? "zip" : "json"}`,
  );
  try {
    temp.write(bytes);
    const checked = await readBackupFile(temp, includeFiles);
    if (JSON.stringify(checked.backup) !== JSON.stringify(backup))
      throw new Error("Backup verification failed.");
    temp.move(final);
  } catch (e) {
    if (temp.exists) temp.delete();
    throw e;
  }
  if (kind === "weekly")
    for (const file of localBackups().slice(4)) file.delete();
  if (kind === "safety") {
    const older = directory()
      .list()
      .filter(
        (f): f is File =>
          f instanceof File &&
          f.name.startsWith("safety-") &&
          f.uri !== final.uri,
      );
    for (const file of older) file.delete();
  }
  return final;
}
export async function shareBackupFile(file: File) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error(
      "Sharing is unavailable. The backup is retained locally; try again later.",
    );
  await Sharing.shareAsync(file.uri, {
    mimeType: file.name.endsWith("zip")
      ? "application/zip"
      : "application/json",
    UTI: file.name.endsWith("zip") ? "public.zip-archive" : "public.json",
    dialogTitle: "Save Attendance Tracker backup",
  });
}
export const exportAppBackup = (includeFiles: boolean) =>
  attachments.settled(async () => {
    const file = await createBackup(includeFiles, "manual");
    await shareBackupFile(file);
    return file;
  });
export async function weeklyBackupIfDue() {
  if (process.env.EXPO_OS === "web") return;
  const prefs = readPreference("backupPreferences", backupPreferencesSchema, {
    weekly: true,
    includeFiles: true,
  });
  const state = readPreference("backupState", backupStateSchema, {
    lastSuccess: 0,
    error: "",
  });
  if (!prefs.weekly || Date.now() - state.lastSuccess < 7 * 86400000) return;
  await attachments.settled(async () => {
    // Another foreground/background invocation may have completed while this queued.
    const current = readPreference("backupState", backupStateSchema, {
      lastSuccess: 0,
      error: "",
    });
    if (Date.now() - current.lastSuccess < 7 * 86400000) return;
    const latest = readPreference(
      "backupPreferences",
      backupPreferencesSchema,
      { weekly: true, includeFiles: true },
    );
    if (!latest.weekly) return;
    try {
      await createBackup(latest.includeFiles, "weekly");
      savePreference(
        "backupState",
        { lastSuccess: Date.now(), error: "" },
        false,
      );
    } catch (e) {
      savePreference(
        "backupState",
        {
          ...current,
          error: (e instanceof Error ? e.message : String(e)).slice(0, 2000),
        },
        false,
      );
      throw e;
    }
  });
}
export type RestorePreview = {
  backup: AppBackup;
  content: Record<string, Uint8Array>;
  expected: string;
  summary: ReturnType<typeof backupSummary>;
};
export async function readBackupFile(
  file: File,
  isZip = file.name.endsWith(".zip"),
) {
  if (file.size > MAX_ARCHIVE)
    throw new Error("Backup exceeds the 71 MiB archive limit.");
  const { backup, content } = decodeBackup(await file.bytes(), isZip);
  if (isZip)
    for (const row of backup.rows.files.filter((f) => f.state === "ready")) {
      const bytes = content[`files/${row.id}`];
      if (
        !bytes ||
        bytes.length !== row.sizeBytes ||
        (await checksum(bytes)) !== row.sha256
      )
        throw new Error(`Backup checksum failed for “${row.name}”.`);
      await yieldWork();
    }
  return { backup, content };
}
export async function previewBackupFile(file: File): Promise<RestorePreview> {
  const expected = appFingerprint();
  const { backup, content } = await readBackupFile(file);
  validateAppRestore(backup);
  if (appFingerprint() !== expected)
    throw new Error("Data changed while validating. Choose the backup again.");
  return { backup, content, expected, summary: backupSummary(backup) };
}
export async function pickAppBackup() {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/json",
      "application/zip",
      "application/x-zip-compressed",
      "text/plain",
    ],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return previewBackupFile(new File(result.assets[0].uri));
}
export const restoreAppBackup = (preview: RestorePreview) =>
  attachments.settled(async () => {
    if (appFingerprint() !== preview.expected)
      throw new Error("Data changed after preview. Choose the backup again.");
    // Preserve the previous dataset and every available attachment before replacing anything.
    const safety = await createBackup(true, "safety");
    const paths = new Map<string, string>();
    for (const row of preview.backup.rows.files)
      paths.set(
        row.id,
        safePath(
          `${row.subjectId ? `subjects/${row.subjectId}` : `semesters/${row.semesterId}`}/files/restored-${randomUUID()}`,
        ),
      );
    // This pre-commit journal preserves referenced old bytes after rollback, and new bytes after commit.
    const oldPaths = captureAppBackup(false).rows.files.map(
      (f) => f.relativePath,
    );
    await semesterCleanup.prepare(randomUUID(), [
      ...oldPaths,
      ...paths.values(),
    ]);
    try {
      if (preview.backup.attachments === "zip")
        for (const row of preview.backup.rows.files.filter(
          (f) => f.state === "ready",
        )) {
          const file = localFile(paths.get(row.id)!);
          file.parentDirectory.create({
            intermediates: true,
            idempotent: true,
          });
          file.write(preview.content[`files/${row.id}`]);
          if (
            file.size !== row.sizeBytes ||
            (await checksum(await file.bytes())) !== row.sha256
          )
            throw new Error(`Restored file verification failed: ${row.name}`);
          await yieldWork();
        }
      restoreAppRows(preview.backup, preview.expected, paths);
      syncAppearance();
      return safety;
    } finally {
      await semesterCleanup.recover().catch(() => {});
    }
  });
export function safetyBackup() {
  return directory().exists
    ? directory()
        .list()
        .filter(
          (f): f is File =>
            f instanceof File && /^safety-\d+\.zip$/.test(f.name),
        )
        .sort((a, b) => b.name.localeCompare(a.name))[0]
    : undefined;
}
