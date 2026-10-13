import { promises as fs } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Disk } from "../storage";
import { safeId, safePath } from "../model";
/** Real temporary filesystem transport; the storage state machine runs unchanged. */
export function nodeDisk(root: string): Disk {
  const path = (relative: string) => join(root, safePath(relative));
  const journal = (id: string) => join(root, "journals", safeId(id) + ".json");
  return {
    copy: async (source, dest) => { await fs.mkdir(join(path(dest), ".."), { recursive: true }); await fs.copyFile(source, path(dest)); },
    move: async (from, to) => { await fs.mkdir(join(path(to), ".."), { recursive: true }); await fs.rename(path(from), path(to)); },
    exists: async relative => { try { await fs.access(path(relative)); return true; } catch { return false; } },
    size: async relative => (await fs.stat(path(relative))).size,
    hash: async relative => createHash("sha256").update(await fs.readFile(path(relative))).digest("hex"),
    remove: async relative => { await fs.rm(path(relative), { force: true }); },
    writeJournal: async (id, text) => { await fs.mkdir(join(root, "journals"), { recursive: true }); await fs.writeFile(journal(id), text); },
    readJournals: async () => {
      let names: string[];
      try { names = await fs.readdir(join(root, "journals")); } catch { return []; }
      return Promise.all(names.map(async name => ({ id: name.slice(0, -5), text: await fs.readFile(join(root, "journals", name), "utf8") })));
    },
    removeJournal: async id => { await fs.rm(journal(id), { force: true }); },
    removeSubjectTree: async id => { await fs.rm(join(root, "subjects", safeId(id)), { recursive: true, force: true }); },
  };
}
