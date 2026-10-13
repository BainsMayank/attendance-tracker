import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { File as MockFile } from "expo-file-system";
import { strToU8, zipSync } from "fflate";
import {
  exportAppBackup,
  localBackups,
  previewBackupFile,
  readBackupFile,
  restoreAppBackup,
  safetyBackup,
  weeklyBackupIfDue,
} from "../backup";
import {
  parseAppBackup as mockParseAppBackup,
  type AppBackup,
} from "../backup-model";
import { backupFixture, id, meta } from "./fixtures";
import { NativeFile } from "./native-disk";
let mockRoot = "";
let mockSnapshot: AppBackup;
let mockPreferences: Record<string, unknown>;
let mockJournal: string[] = [];
let mockQueue = Promise.resolve();
const mockRestore = jest.fn(
  (backup: AppBackup, _expected: string, paths: Map<string, string>) => {
    mockSnapshot = {
      ...backup,
      rows: {
        ...backup.rows,
        files: backup.rows.files.map((f) => ({
          ...f,
          relativePath: paths.get(f.id)!,
          state: backup.attachments === "zip" ? f.state : "missing",
        })),
      },
    };
  },
);
jest.mock("expo-file-system", () => {
  const disk =
    jest.requireActual<typeof import("./native-disk")>("./native-disk");
  return {
    File: disk.NativeFile,
    Directory: disk.NativeDirectory,
    Paths: {
      get document() {
        return mockRoot;
      },
    },
  };
});
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  randomUUID: () =>
    jest
      .requireActual<typeof import("node:crypto")>("node:crypto")
      .randomUUID(),
  digest: async (_algorithm: string, bytes: Uint8Array) =>
    new Uint8Array(
      jest
        .requireActual<typeof import("node:crypto")>("node:crypto")
        .createHash("sha256")
        .update(bytes)
        .digest(),
    ).buffer,
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: async () => true,
  shareAsync: jest.fn(async () => {}),
}));
jest.mock("expo-document-picker", () => ({}));
jest.mock("@/db/repositories/app-backup", () => ({
  appFingerprint: () => JSON.stringify(mockSnapshot),
  captureAppBackup: (include: boolean) =>
    mockParseAppBackup({
      ...mockSnapshot,
      createdAt: Date.now(),
      attachments: include ? "zip" : "omitted",
    }),
  validateAppRestore: jest.fn(),
  restoreAppRows: (...args: Parameters<typeof mockRestore>) =>
    mockRestore(...args),
}));
jest.mock("../preferences", () => ({
  readPreference: (key: string, _schema: unknown, fallback: unknown) =>
    mockPreferences[key] ?? fallback,
  savePreference: (key: string, value: unknown) => {
    mockPreferences[key] = value;
  },
  syncAppearance: jest.fn(),
}));
jest.mock("@/features/files/service", () => ({
  localFile: (path: string) => new MockFile(mockRoot, path),
  attachments: {
    settled: <T>(op: () => Promise<T>) => {
      const result = mockQueue.then(op);
      mockQueue = result.then(
        () => {},
        () => {},
      );
      return result;
    },
  },
}));
jest.mock("@/features/semesters/cleanup-service", () => ({
  semesterCleanup: {
    prepare: async (_id: string, paths: string[]) => {
      mockJournal = paths;
    },
    recover: async () => {
      for (const path of mockJournal)
        if (!mockSnapshot.rows.files.some((f) => f.relativePath === path)) {
          const file = new MockFile(mockRoot, path);
          if (file.exists) file.delete();
        }
      mockJournal = [];
    },
  },
}));
beforeEach(() => {
  mockRoot = mkdtempSync(join(tmpdir(), "attendance-settings-"));
  mockSnapshot = mockParseAppBackup(backupFixture());
  mockPreferences = {
    backupPreferences: { weekly: true, includeFiles: false },
  };
  mockJournal = [];
  mockQueue = Promise.resolve();
  mockRestore.mockClear();
  jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-05T12:00:00Z"));
});
afterEach(() => {
  jest.restoreAllMocks();
  rmSync(mockRoot, { recursive: true, force: true });
});
function addFile() {
  const bytes = strToU8("Saved lecture notes");
  const file = {
    ...meta,
    id: id(50),
    semesterId: id(1),
    subjectId: id(2),
    folderId: null,
    name: "notes.txt",
    mimeType: "text/plain",
    sizeBytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    relativePath: "original/notes.txt",
    sourceName: "notes.txt",
    state: "ready" as const,
  };
  mockSnapshot.rows.files = [file];
  const disk = new MockFile(mockRoot, file.relativePath);
  disk.parentDirectory.create({ intermediates: true });
  disk.write(bytes);
  return { file, disk, bytes };
}
test("weekly backup catches up once, serializes competing calls, and retains only four successful weeks", async () => {
  await Promise.all([weeklyBackupIfDue(), weeklyBackupIfDue()]);
  expect(localBackups()).toHaveLength(1);
  await weeklyBackupIfDue();
  expect(localBackups()).toHaveLength(1);
  for (let week = 1; week <= 5; week++) {
    jest
      .spyOn(Date, "now")
      .mockReturnValue(
        Date.parse("2026-01-05T12:00:00Z") + week * 7 * 86400000,
      );
    await weeklyBackupIfDue();
  }
  expect(localBackups()).toHaveLength(4);
  expect(localBackups().map((f) => f.name)).not.toContain(
    "weekly-1767614400000.json",
  );
  expect(mockPreferences.backupState).toMatchObject({ error: "" });
});
test("ZIP round trip verifies real bytes and restore creates a safety copy before replacing paths", async () => {
  const { disk, bytes } = addFile();
  const original = disk.uri;
  const exported = await exportAppBackup(true);
  const preview = await previewBackupFile(exported);
  expect(preview.content[`files/${id(50)}`]).toEqual(bytes);
  await restoreAppBackup(preview);
  expect(mockRestore).toHaveBeenCalledTimes(1);
  expect(safetyBackup()?.exists).toBe(true);
  expect(mockSnapshot.rows.files[0].relativePath).toMatch(
    new RegExp(`^subjects/${id(2)}/files/restored-`),
  );
  expect(new MockFile(original).exists).toBe(false);
  expect(
    await new MockFile(
      mockRoot,
      mockSnapshot.rows.files[0].relativePath,
    ).bytes(),
  ).toEqual(bytes);
  expect(
    (await readBackupFile(safetyBackup()!)).backup.rows.files[0].relativePath,
  ).toBe("original/notes.txt");
});
test("stale preview refuses replacement and checksum corruption fails before a preview", async () => {
  addFile();
  const exported = await exportAppBackup(true);
  const preview = await previewBackupFile(exported);
  mockSnapshot.rows.subjects[0].teacher = "Changed";
  await expect(restoreAppBackup(preview)).rejects.toThrow(
    "changed after preview",
  );
  expect(mockRestore).not.toHaveBeenCalled();
  const corrupt = new MockFile(mockRoot, "corrupt.zip");
  corrupt.write(
    zipSync({
      "backup.json": strToU8(JSON.stringify(preview.backup)),
      [`files/${id(50)}`]: new Uint8Array(
        preview.backup.rows.files[0].sizeBytes,
      ),
    }),
  );
  await expect(previewBackupFile(corrupt)).rejects.toThrow("checksum");
});
test("a failed database commit preserves old bytes, removes uncommitted files and keeps the safety copy", async () => {
  const { disk, bytes } = addFile();
  const preview = await previewBackupFile(await exportAppBackup(true));
  mockRestore.mockImplementationOnce(() => {
    throw new Error("Commit failed");
  });
  await expect(restoreAppBackup(preview)).rejects.toThrow("Commit failed");
  expect(await disk.bytes()).toEqual(bytes);
  expect(safetyBackup()?.exists).toBe(true);
  expect(readdirSync(join(mockRoot, "subjects", id(2), "files"))).toEqual([]);
});
test("missing attachment bytes report an error without advancing success, and disabled weekly backup writes nothing", async () => {
  const { disk } = addFile();
  disk.delete();
  mockPreferences.backupPreferences = { weekly: true, includeFiles: true };
  await expect(weeklyBackupIfDue()).rejects.toThrow("missing or changed");
  expect(mockPreferences.backupState).toMatchObject({
    lastSuccess: 0,
    error: expect.stringContaining("missing"),
  });
  expect(localBackups()).toHaveLength(0);
  mockPreferences.backupPreferences = { weekly: false, includeFiles: true };
  await weeklyBackupIfDue();
  expect(localBackups()).toHaveLength(0);
});
test("disk write failure leaves the original workspace untouched", async () => {
  const { disk, bytes } = addFile();
  const preview = await previewBackupFile(await exportAppBackup(true));
  const original = NativeFile.prototype.write;
  jest.spyOn(NativeFile.prototype, "write").mockImplementation(function (
    this: NativeFile,
    content,
  ) {
    if (this.uri.includes("/files/restored-")) throw new Error("Disk full");
    original.call(this, content);
  });
  await expect(restoreAppBackup(preview)).rejects.toThrow("Disk full");
  expect(mockRestore).not.toHaveBeenCalled();
  expect(await disk.bytes()).toEqual(bytes);
});
