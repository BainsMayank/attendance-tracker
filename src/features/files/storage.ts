import { z } from "zod";
import {
  MAX_FILE_BYTES,
  breadcrumbs,
  descendantIds,
  fileName,
  safeId,
  safePath,
  type FileRow,
  type Scope,
  type Snapshot,
} from "./model";

export interface Disk {
  copy(source: string, path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  size(path: string): Promise<number>;
  hash(path: string): Promise<string>;
  remove(path: string): Promise<void>;
  writeJournal(id: string, value: string): Promise<void>;
  readJournals(): Promise<{ id: string; text: string }[]>;
  removeJournal(id: string): Promise<void>;
  removeSubjectTree(subjectId: string): Promise<void>;
}
export interface AttachmentRepository {
  data(scope: Scope): Snapshot;
  assertWritable(scope: Scope): void;
  insert(scope: Scope, row: FileRow): void;
  state(id: string, state: FileRow["state"]): unknown;
  remove(scope: Scope, snapshot: Snapshot): void;
  restore(scope: Scope, snapshot: Snapshot): void;
}
const scopeSchema = z.object({
  semesterId: z.string().regex(/^[\w-]+$/),
  subjectId: z.string().regex(/^[\w-]+$/),
});
const meta = {
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  revision: z.number().int().positive(),
  semesterId: z.string(),
  subjectId: z.string().nullable(),
};
const fileSchema = z.object({
  ...meta,
  folderId: z.string().nullable(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string(),
  sourceName: z.string().nullable(),
  state: z.enum(["ready", "staged", "missing", "error"]),
});
const folderSchema = z.object({
  ...meta,
  parentId: z.string().nullable(),
  name: z.string(),
  normalizedName: z.string(),
});
const journalSchema = z.discriminatedUnion("kind", [
  z.object({
    version: z.literal(1),
    kind: z.literal("import"),
    scope: scopeSchema,
    id: z.string(),
    path: z.string(),
    stage: z.string(),
  }),
  z.object({
    version: z.literal(1),
    kind: z.literal("delete"),
    scope: scopeSchema,
    expires: z.number(),
    wholeSubject: z.boolean(),
    snapshot: z.object({
      files: z.array(fileSchema),
      folders: z.array(folderSchema),
    }),
  }),
]);
type Journal = z.infer<typeof journalSchema>;

/** All filesystem/DB changes pass through one queue, including startup and Undo. */
export function createAttachmentService(
  disk: Disk,
  repo: AttachmentRepository,
  uuid: () => string,
  now = Date.now,
) {
  let tail: Promise<unknown> = Promise.resolve();
  const serialized = <T>(run: () => Promise<T>) => {
    const result = tail.then(run);
    tail = result.catch(() => {});
    return result;
  };
  const save = (id: string, journal: Journal) =>
    disk.writeJournal(id, JSON.stringify(journal));
  const verify = async (row: FileRow, path = row.relativePath) => {
    if (
      !(await disk.exists(path)) ||
      (await disk.size(path)) !== row.sizeBytes ||
      (await disk.hash(path)) !== row.sha256
    )
      throw new Error(`File is missing or damaged: ${row.name}`);
  };
  async function finalize(
    id: string,
    journal: Extract<Journal, { kind: "delete" }>,
  ) {
    let data: Snapshot;
    try {
      data = repo.data(journal.scope);
    } catch {
      throw new Error(
        "Cannot verify deleted attachment scope; cleanup will retry.",
      );
    }
    const rows = [...journal.snapshot.files, ...journal.snapshot.folders];
    const remaining = rows.filter((r) =>
      [...data.files, ...data.folders].some((current) => current.id === r.id),
    );
    if (remaining.length) {
      if (remaining.length !== rows.length)
        throw new Error(
          "Attachment cleanup needs recovery; saved data was preserved.",
        );
      await disk.removeJournal(id);
      return; // The transaction never committed, or Undo committed.
    }
    for (const row of journal.snapshot.files)
      await disk.remove(row.relativePath);
    if (journal.wholeSubject) {
      if (data.files.length || data.folders.length)
        throw new Error("New subject files were preserved. Retry cleanup.");
      await disk.removeSubjectTree(journal.scope.subjectId);
    }
    await disk.removeJournal(id);
  }
  const deleteSnapshot = async (
    scope: Scope,
    snapshot: Snapshot,
    wholeSubject = false,
  ) => {
    repo.assertWritable(scope);
    snapshot = {
      files: snapshot.files,
      folders: [...snapshot.folders].sort(
        (a, b) =>
          breadcrumbs(snapshot.folders, a.id).length -
          breadcrumbs(snapshot.folders, b.id).length,
      ),
    };
    const id = uuid(),
      expires = now() + 60_000;
    const journal: Extract<Journal, { kind: "delete" }> = {
      version: 1,
      kind: "delete",
      scope,
      snapshot,
      expires,
      wholeSubject,
    };
    await save(id, journal);
    repo.remove(scope, snapshot);
    let undone = false;
    return {
      expires,
      finalize: () => serialized(() => finalize(id, journal)),
      undo: () =>
        serialized(async () => {
          if (undone) throw new Error("Already undone");
          if (now() >= expires) throw new Error("The Undo window has ended");
          for (const row of snapshot.files)
            if (row.state === "ready") await verify(row);
          repo.restore(scope, snapshot);
          undone = true;
          await disk.removeJournal(id);
        }),
    };
  };
  return {
    importFile: (
      scope: Scope,
      folderId: string | null,
      source: { uri: string; name: string; mimeType: string; size?: number },
    ) =>
      serialized(async () => {
        repo.assertWritable(scope);
        safeId(scope.subjectId);
        const name = fileName(source.name),
          id = safeId(uuid());
        if (source.size !== undefined && source.size > MAX_FILE_BYTES)
          throw new Error(`${name}: maximum file size is 50 MB`);
        const ext = name.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1].toLowerCase();
        const path = `subjects/${scope.subjectId}/files/${id}${ext ? `.${ext}` : ""}`,
          stage = `subjects/${scope.subjectId}/staging/${id}`;
        const journal: Journal = {
          version: 1,
          kind: "import",
          scope,
          id,
          path,
          stage,
        };
        await save(id, journal);
        let committed = false;
        try {
          await disk.copy(source.uri, stage);
          const sizeBytes = await disk.size(stage);
          if (sizeBytes > MAX_FILE_BYTES)
            throw new Error(`${name}: maximum file size is 50 MB`);
          const sha256 = await disk.hash(stage),
            stamp = now();
          const row: FileRow = {
            ...scope,
            id,
            folderId,
            name,
            mimeType: source.mimeType,
            sizeBytes,
            sha256,
            relativePath: path,
            sourceName: name,
            state: "staged",
            createdAt: stamp,
            updatedAt: stamp,
            revision: 1,
          };
          // Revalidate the destination after the asynchronous copy (it may have been archived/deleted).
          repo.insert(scope, row);
          committed = true;
          await disk.move(stage, path);
          repo.state(id, "ready");
          await disk.removeJournal(id);
          return { ...row, state: "ready" as const };
        } catch (error) {
          if (!committed) {
            await disk.remove(stage);
            await disk.remove(path);
            await disk.removeJournal(id);
          }
          throw error;
        }
      }),
    deleteEntry: (scope: Scope, kind: "file" | "folder", id: string) =>
      serialized(async () => {
        const data = repo.data(scope);
        const ids =
          kind === "folder"
            ? descendantIds(data.folders, id)
            : new Set<string>();
        const snapshot = {
          files: data.files.filter((f) =>
            kind === "file" ? f.id === id : !!f.folderId && ids.has(f.folderId),
          ),
          folders: data.folders.filter((f) => ids.has(f.id)),
        };
        if (!snapshot.files.length && !snapshot.folders.length)
          throw new Error("Item unavailable");
        return deleteSnapshot(scope, snapshot);
      }),
    cleanupSubjectFiles: (scope: Scope) =>
      serialized(async () => {
        await deleteSnapshot(scope, repo.data(scope), true);
        // Explicit whole-subject cleanup has no Undo; complete disk deletion before resolving.
        // Other pending operations must be settled first by recover(true).
        await finalizeAllDeletes(scope);
        await actionFinalizeDirect(scope);
      }),
    recover: (force = false) => serialized(() => recoverDirect(force)),
    /** Settle imports and deferred deletes before a semester lifecycle transaction. */
    settled: <T>(operation: () => Promise<T> | T) =>
      serialized(async () => {
        await recoverDirect(true);
        return operation();
      }),
  };
  async function recoverDirect(force = false) {
    for (const entry of await disk.readJournals()) {
      safeId(entry.id);
      const journal = journalSchema.parse(JSON.parse(entry.text));
      if (journal.kind === "import") {
        safeId(journal.id);
        safePath(journal.path);
        safePath(journal.stage);
        if (
          !journal.path.startsWith(
            `subjects/${journal.scope.subjectId}/files/`,
          ) ||
          journal.stage !==
            `subjects/${journal.scope.subjectId}/staging/${journal.id}`
        )
          throw new Error("Unsafe recovery path");
        const row = repo
          .data(journal.scope)
          .files.find((f) => f.id === journal.id);
        if (row) {
          if (row.relativePath !== journal.path)
            throw new Error("Attachment recovery mismatch");
          try {
            if (
              !(await disk.exists(journal.path)) &&
              (await disk.exists(journal.stage))
            ) {
              await verify(row, journal.stage);
              await disk.move(journal.stage, journal.path);
            }
            await verify(row);
            repo.state(row.id, "ready");
          } catch {
            repo.state(row.id, "missing");
          }
        } else await disk.remove(journal.path);
        await disk.remove(journal.stage);
        await disk.removeJournal(entry.id);
      } else {
        validateDeleteJournal(journal);
        if (force || journal.expires <= now())
          await finalize(entry.id, journal);
      }
    }
  }

  function validateDeleteJournal(
    journal: Extract<Journal, { kind: "delete" }>,
  ) {
    for (const row of journal.snapshot.files) {
      safePath(row.relativePath);
      if (
        !row.relativePath.startsWith(
          `subjects/${journal.scope.subjectId}/files/`,
        ) ||
        row.subjectId !== journal.scope.subjectId ||
        row.semesterId !== journal.scope.semesterId
      )
        throw new Error("Unsafe cleanup scope");
    }
    for (const row of journal.snapshot.folders)
      if (
        row.subjectId !== journal.scope.subjectId ||
        row.semesterId !== journal.scope.semesterId
      )
        throw new Error("Unsafe cleanup scope");
  }
  async function finalizeAllDeletes(scope: Scope) {
    for (const entry of await disk.readJournals()) {
      const journal = journalSchema.parse(JSON.parse(entry.text));
      if (
        journal.kind === "delete" &&
        journal.scope.subjectId === scope.subjectId
      ) {
        validateDeleteJournal(journal);
        await finalize(entry.id, journal);
      } else if (
        journal.kind === "import" &&
        journal.scope.subjectId === scope.subjectId
      ) {
        safePath(journal.stage);
        safePath(journal.path);
        if (
          !journal.stage.startsWith(`subjects/${scope.subjectId}/staging/`) ||
          !journal.path.startsWith(`subjects/${scope.subjectId}/files/`)
        )
          throw new Error("Unsafe cleanup scope");
        await disk.remove(journal.stage);
        await disk.remove(journal.path);
        await disk.removeJournal(entry.id);
      }
    }
  }
  async function actionFinalizeDirect(scope: Scope) {
    await disk.removeSubjectTree(scope.subjectId);
  }
}
