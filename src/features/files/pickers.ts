import * as Documents from "expo-document-picker";
import * as Photos from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { attachments } from "./service";
import { inferredMime, type Scope } from "./model";
import { z } from "zod";

export type PickedSource = { uri: string; name: string; mimeType: string; size?: number };
const pendingFile = () => new File(Paths.document, "pending-file-picker.json");
const pendingSchema = z.object({ semesterId: z.string().regex(/^[\w-]+$/), subjectId: z.string().regex(/^[\w-]+$/), folderId: z.string().nullable() });
function photoSources(assets: Photos.ImagePickerAsset[]): PickedSource[] {
  return assets.map((asset, index) => {
    const name = asset.fileName || `Photo-${Date.now()}-${index + 1}.${asset.mimeType === "image/png" ? "png" : "jpg"}`;
    return { uri: asset.uri, name, mimeType: inferredMime(name, asset.mimeType), size: asset.fileSize };
  });
}
export async function pickSources(source: "documents" | "photos" | "camera", scope: Scope, folderId: string | null) {
  if (source === "documents") {
    const result = await Documents.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    return result.canceled ? [] : result.assets.map(a => ({ uri: a.uri, name: a.name, mimeType: inferredMime(a.name, a.mimeType), size: a.size }));
  }
  if (source === "camera") {
    const permission = await Photos.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error(permission.canAskAgain ? "Camera permission is needed to take a photo. Try again to allow access." : "Camera access is disabled. Allow it in your device Settings, then retry.");
  }
  pendingFile().write(JSON.stringify({ ...scope, folderId }));
  try {
    const result = source === "camera"
      ? await Photos.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
      : await Photos.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 1 });
    return result.canceled ? [] : photoSources(result.assets);
  } finally { if (pendingFile().exists) pendingFile().delete(); }
}
export async function recoverPendingPicker() {
  if (process.env.EXPO_OS !== "android" || !pendingFile().exists) return;
  const saved = pendingSchema.parse(JSON.parse(await pendingFile().text()));
  const result = await Photos.getPendingResultAsync();
  if (result && "assets" in result && !result.canceled && result.assets) {
    for (const source of photoSources(result.assets)) await attachments.importFile(saved, saved.folderId, source);
  }
  pendingFile().delete();
}
