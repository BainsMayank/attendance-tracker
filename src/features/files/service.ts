import { AppState } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";
import { CryptoDigestAlgorithm, digest, randomUUID } from "expo-crypto";
import * as Sharing from "expo-sharing";
import { attachmentRepository } from "@/db/repositories/file-commands";
import { createAttachmentService, type Disk } from "./storage";
import { safeId, safePath, type FileRow } from "./model";

export const localFile = (path: string) => new File(Paths.document, safePath(path));
const journals = () => new Directory(Paths.document, "file-operations");
const journalFile = (id: string, suffix = ".json") => new File(journals(), safeId(id) + suffix);
const disk: Disk = {
  copy: async (source, path) => {
    const file = localFile(path); file.parentDirectory.create({ intermediates: true, idempotent: true });
    await copyAsync({ from: source, to: file.uri });
  },
  move: async (from, to) => { const target = localFile(to); target.parentDirectory.create({ intermediates: true, idempotent: true }); localFile(from).move(target); },
  exists: async path => localFile(path).exists,
  size: async path => localFile(path).size,
  hash: async path => Array.from(new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, await localFile(path).bytes()))).map(n => n.toString(16).padStart(2, "0")).join(""),
  remove: async path => { const file = localFile(path); if (file.exists) file.delete(); },
  writeJournal: async (id, value) => {
    journals().create({ intermediates: true, idempotent: true });
    const temp = journalFile(id, ".tmp"); temp.write(value); temp.move(journalFile(id));
  },
  readJournals: async () => journals().exists ? await Promise.all(journals().list().filter((f): f is File => f instanceof File && f.name.endsWith(".json")).map(async f => ({ id: f.name.slice(0, -5), text: await f.text() }))) : [],
  removeJournal: async id => { const file = journalFile(id); if (file.exists) file.delete(); },
  removeSubjectTree: async id => { const dir = new Directory(Paths.document, "subjects", safeId(id)); if (dir.exists) dir.delete(); },
};
export const attachments = createAttachmentService(disk, attachmentRepository, randomUUID);
export async function shareFile(row: FileRow) {
  const file = localFile(row.relativePath);
  if (!file.exists) throw new Error("This file is missing. Import it again from the + menu.");
  if (!await Sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device.");
  // A readable cached name gives the receiving app the current filename after a rename.
  const directory = new Directory(Paths.cache, "file-shares", randomUUID()); directory.create({ intermediates: true });
  const copy = new File(directory, row.name);
  try { await copyAsync({ from: file.uri, to: copy.uri }); await Sharing.shareAsync(copy.uri, { mimeType: row.mimeType, dialogTitle: row.name }); }
  finally { if (directory.exists) directory.delete(); }
}
export function startFileRecovery() {
  if (process.env.EXPO_OS === "web") return () => {};
  // Failed cleanup retains the journal for the next run. Bootstrap reports initial failures.
  const recover = () => { void attachments.recover().catch(() => {}); };
  const interval = setInterval(recover, 15_000);
  const subscription = AppState.addEventListener("change", state => { if (state === "active") recover(); });
  return () => { clearInterval(interval); subscription.remove(); };
}
