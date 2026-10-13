import { createAttachmentService, type Disk } from "../storage";
import type { Snapshot } from "../model";

test("semester lifecycle waits for a queued import and settles deletes before removing its scope", async () => {
  const scope = { subjectId: "subject", semesterId: "semester" };
  const bytes = new Set<string>(),
    journals = new Map<string, string>(),
    events: string[] = [];
  let data: Snapshot = { files: [], folders: [] };
  let id = 0;
  const disk: Disk = {
    copy: async (_, path) => {
      bytes.add(path);
      events.push("copy");
    },
    move: async (from, to) => {
      bytes.delete(from);
      bytes.add(to);
      events.push("move");
    },
    exists: async (path) => bytes.has(path),
    size: async () => 0,
    hash: async () => "a".repeat(64),
    remove: async (path) => {
      bytes.delete(path);
    },
    writeJournal: async (key, text) => {
      journals.set(key, text);
    },
    readJournals: async () =>
      [...journals].map(([key, text]) => ({ id: key, text })),
    removeJournal: async (key) => {
      journals.delete(key);
    },
    removeSubjectTree: async () => {},
  };
  const service = createAttachmentService(
    disk,
    {
      data: () => data,
      assertWritable: () => {},
      insert: (_, row) => {
        data.files.push(row);
        events.push("insert");
      },
      state: (_, state) => {
        data.files[0].state = state;
        events.push(state);
      },
      remove: () => {
        data = { files: [], folders: [] };
      },
      restore: (_, snapshot) => {
        data = snapshot;
      },
    },
    () => `id-${++id}`,
  );
  const imported = service.importFile(scope, null, {
    uri: "picked",
    name: "notes.txt",
    mimeType: "text/plain",
  });
  await service.settled(() => {
    events.push("lifecycle");
    expect(data.files[0].state).toBe("ready");
    expect(journals.size).toBe(0);
  });
  expect(events).toEqual(["copy", "insert", "move", "ready", "lifecycle"]);
  const row = await imported;
  await service.deleteEntry(scope, "file", row.id);
  expect(bytes.size).toBe(1); // The normal Undo window still retains bytes.
  await service.settled(() => {
    expect(bytes.size).toBe(0);
    expect(journals.size).toBe(0);
  });
});
