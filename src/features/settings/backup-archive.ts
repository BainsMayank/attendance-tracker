import { strFromU8, unzipSync } from "fflate";
import { MAX_ARCHIVE, MAX_JSON, parseAppBackup } from "./backup-model";

/** Validate the container before allocating or trusting any attachment paths. */
export function decodeBackup(bytes: Uint8Array, isZip: boolean) {
  if (bytes.length > MAX_ARCHIVE)
    throw new Error("Backup exceeds the 71 MiB archive limit.");
  const content: Record<string, Uint8Array> = {};
  let json: Uint8Array;
  if (isZip) {
    let expanded = 0;
    const sizes = new Map<string, number>();
    const entries = unzipSync(bytes, {
      filter: (entry) => {
        if (
          entry.name !== "backup.json" &&
          !/^files\/[0-9a-f-]{36}$/i.test(entry.name)
        )
          throw new Error("Unsafe or unexpected ZIP entry.");
        if (sizes.has(entry.name)) throw new Error("Duplicate ZIP entry.");
        if (sizes.size >= 10001)
          throw new Error("ZIP exceeds the attachment entry limit.");
        if (!Number.isSafeInteger(entry.originalSize) || entry.originalSize < 0)
          throw new Error("Invalid ZIP entry size.");
        expanded += entry.originalSize;
        if (
          expanded > MAX_ARCHIVE ||
          (entry.name === "backup.json" && entry.originalSize > MAX_JSON)
        )
          throw new Error("Expanded ZIP exceeds backup limits.");
        sizes.set(entry.name, entry.originalSize);
        return true;
      },
    });
    for (const [name, entry] of Object.entries(entries))
      if (entry.length !== sizes.get(name))
        throw new Error("ZIP entry size mismatch.");
    if (!entries["backup.json"])
      throw new Error("ZIP contains no backup.json.");
    json = entries["backup.json"];
    Object.assign(content, entries);
    delete content["backup.json"];
  } else {
    if (bytes.length > MAX_JSON) throw new Error("JSON backup exceeds 20 MiB.");
    json = bytes;
  }
  const backup = parseAppBackup(JSON.parse(strFromU8(json)));
  if ((backup.attachments === "zip") !== isZip)
    throw new Error("The attachment format does not match this file.");
  const available = backup.rows.files.filter((f) => f.state === "ready");
  if (
    isZip &&
    (Object.keys(content).length !== available.length ||
      available.some(
        (f) =>
          !content[`files/${f.id}`] ||
          content[`files/${f.id}`].length !== f.sizeBytes,
      ))
  )
    throw new Error("ZIP attachment inventory is incomplete.");
  return { backup, content };
}
