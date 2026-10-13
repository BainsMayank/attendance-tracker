import type { files, folders } from "@/db/schema";

export type FileRow = typeof files.$inferSelect;
export type FolderRow = typeof folders.$inferSelect;
export type Scope = { semesterId: string; subjectId: string };
export type Snapshot = { files: FileRow[]; folders: FolderRow[] };
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export function safeId(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid file scope");
  return id;
}
export function safePath(path: string) {
  if (!path || !/^[a-zA-Z0-9_./-]+$/.test(path) || path.split("/").some(p => !p || p === "." || p === ".."))
    throw new Error("Unsafe attachment path");
  return path;
}
export function fileName(name: string) {
  const value = name.normalize("NFKC").trim();
  if (!value || value.length > 200 || /[/\\\u0000-\u001f]/.test(value) || value === "." || value === "..")
    throw new Error("Use a name of 1–200 characters without slashes or control characters.");
  return value;
}
export function descendantIds(folders: FolderRow[], root: string) {
  const result = new Set([root]);
  for (let changed = true; changed;) {
    changed = false;
    for (const f of folders) if (f.parentId && result.has(f.parentId) && !result.has(f.id)) { result.add(f.id); changed = true; }
  }
  return result;
}
export function breadcrumbs(folders: FolderRow[], id: string | null) {
  const result: FolderRow[] = [], seen = new Set<string>();
  while (id) {
    if (seen.has(id)) throw new Error("Invalid folder cycle");
    seen.add(id);
    const f = folders.find(f => f.id === id);
    if (!f) break;
    result.unshift(f); id = f.parentId;
  }
  return result;
}
export function bytesLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
export function inferredMime(name: string, mime?: string | null) {
  if (mime && mime !== "application/octet-stream") return mime;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", gif: "image/gif", txt: "text/plain" } as Record<string, string>)[ext] ?? "application/octet-stream";
}
