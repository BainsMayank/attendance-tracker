import { z } from "zod";
import { safeId, safePath } from "@/features/files/model";

const manifest = z
  .object({ version: z.literal(1), paths: z.array(z.string()).max(100000) })
  .strict();
export interface CleanupDisk {
  write(id: string, text: string): Promise<void>;
  entries(): Promise<{ id: string; text: string }[]>;
  removeManifest(id: string): Promise<void>;
  removeFile(path: string): Promise<void>;
}
/** A journal written before the DB transaction makes cleanup safe across crashes.
 * A rolled-back reset or committed restore keeps every referenced file. */
export function createSemesterCleanup(
  disk: CleanupDisk,
  referenced: (path: string) => boolean,
) {
  return {
    prepare: async (id: string, paths: string[]) => {
      safeId(id);
      paths.forEach(safePath);
      await disk.write(id, JSON.stringify({ version: 1, paths }));
    },
    recover: async () => {
      const failures: string[] = [];
      for (const entry of await disk.entries()) {
        safeId(entry.id);
        const value = manifest.parse(JSON.parse(entry.text));
        value.paths.forEach(safePath);
        let failed = false;
        for (const path of value.paths) {
          try {
            if (!referenced(path)) await disk.removeFile(path);
          } catch {
            failed = true;
            failures.push(path);
          }
        }
        if (!failed) await disk.removeManifest(entry.id);
      }
      return failures;
    },
  };
}
