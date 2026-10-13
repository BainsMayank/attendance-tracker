import { Directory, File, Paths } from "expo-file-system";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { files } from "@/db/schema";
import { safeId, safePath } from "@/features/files/model";
import { createSemesterCleanup } from "./cleanup";

const directory = () => new Directory(Paths.document, "semester-file-cleanup");
const journal = (id: string, suffix = ".json") =>
  new File(directory(), safeId(id) + suffix);
export const semesterCleanup = createSemesterCleanup(
  {
    write: async (id, text) => {
      directory().create({ intermediates: true, idempotent: true });
      const temp = journal(id, ".tmp");
      temp.write(text);
      temp.move(journal(id));
    },
    entries: async () =>
      directory().exists
        ? Promise.all(
            directory()
              .list()
              .filter(
                (file): file is File =>
                  file instanceof File && file.name.endsWith(".json"),
              )
              .map(async (file) => ({
                id: file.name.slice(0, -5),
                text: await file.text(),
              })),
          )
        : [],
    removeManifest: async (id) => {
      const file = journal(id);
      if (file.exists) file.delete();
    },
    removeFile: async (path) => {
      const file = new File(Paths.document, safePath(path));
      if (file.exists) file.delete();
    },
  },
  (path) =>
    !!getDatabase()
      .select({ id: files.id })
      .from(files)
      .where(eq(files.relativePath, path))
      .get(),
);
