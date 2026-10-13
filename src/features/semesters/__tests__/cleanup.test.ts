import { createSemesterCleanup } from "../cleanup";

function fixture() {
  const journals = new Map<string, string>(),
    files = new Set(["subjects/a/files/a", "subjects/b/files/b"]);
  const references = new Set(files);
  const removeFile = jest.fn(async (path: string) => {
    files.delete(path);
  });
  const service = createSemesterCleanup(
    {
      write: async (id, text) => {
        journals.set(id, text);
      },
      entries: async () => [...journals].map(([id, text]) => ({ id, text })),
      removeManifest: async (id) => {
        journals.delete(id);
      },
      removeFile,
    },
    (path) => references.has(path),
  );
  return { service, journals, files, references, removeFile };
}
test("reset crash recovery removes only committed, unreferenced files and survives repeated recovery", async () => {
  const f = fixture();
  await f.service.prepare("reset", [...f.files]);
  f.references.delete("subjects/a/files/a");
  expect(await f.service.recover()).toEqual([]);
  expect(f.files).toEqual(new Set(["subjects/b/files/b"]));
  expect(f.journals.size).toBe(0);
  await f.service.recover();
  expect(f.removeFile).toHaveBeenCalledTimes(1);
});
test("failed database transaction preserves all original bytes", async () => {
  const f = fixture();
  await f.service.prepare("reset", [...f.files]);
  expect(await f.service.recover()).toEqual([]);
  expect(f.files.size).toBe(2);
  expect(f.removeFile).not.toHaveBeenCalled();
});
test("disk failure retains the durable journal for restart; successful restore bytes stay", async () => {
  const f = fixture();
  await f.service.prepare("restore", [...f.files]);
  f.references.delete("subjects/a/files/a");
  f.removeFile.mockRejectedValueOnce(new Error("disk unavailable"));
  expect(await f.service.recover()).toEqual(["subjects/a/files/a"]);
  expect(f.journals.size).toBe(1);
  expect(await f.service.recover()).toEqual([]);
  expect(f.files).toEqual(new Set(["subjects/b/files/b"]));
  expect(f.journals.size).toBe(0);
});
test("unsafe or malformed journals fail closed before deleting bytes", async () => {
  const f = fixture();
  await expect(f.service.prepare("bad", ["../outside"])).rejects.toThrow();
  f.journals.set(
    "bad",
    JSON.stringify({ version: 1, paths: ["subjects/a/files/a", "../outside"] }),
  );
  await expect(f.service.recover()).rejects.toThrow();
  expect(f.removeFile).not.toHaveBeenCalled();
  expect(f.files.size).toBe(2);
});
