import { useCallback, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router/stack";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Button, EmptyState, Text, useTheme } from "@/ui";
import { fileData } from "@/db/repositories/file-commands";
import { ErrorText } from "@/features/timetable/form-controls";
import { bytesLabel, type FileRow } from "./model";
import { localFile, shareFile } from "./service";
import { ImagePreview } from "./image-preview";
import { PdfPreview } from "./pdf-preview";
export default function FilePreviewScreen() {
  const params = useLocalSearchParams<{ semesterId: string; subjectId: string; fileId: string }>();
  const { colors } = useTheme();
  const [row, setRow] = useState<FileRow>(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    try {
      const file = fileData(params).files.find(f => f.id === params.fileId);
      if (!file) throw new Error("This file is no longer available.");
      if (!localFile(file.relativePath).exists) throw new Error("This file is missing. Go back and import it again with the + menu.");
      setRow(file); setError("");
    } catch (e) { setRow(undefined); setError(e instanceof Error ? e.message : "File unavailable"); }
  }, [params.semesterId, params.subjectId, params.fileId]));
  return <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: 24, gap: 12 }}>
    <Stack.Screen options={{ title: row?.name ?? "File preview", headerLargeTitleEnabled: false }} />
    {row && <View style={{ padding: 16, gap: 12 }}><Text selectable secondary>{bytesLabel(row.sizeBytes)} · {row.mimeType} · {new Date(row.createdAt).toLocaleDateString()}</Text><Button label="Share / Open in another app" variant="secondary" loading={busy} onPress={async () => { setBusy(true); setError(""); try { await shareFile(row); } catch (e) { setError(e instanceof Error ? e.message : "Sharing failed"); } finally { setBusy(false); } }} /></View>}
    {!!error && <View style={{ padding: 16 }}><ErrorText message={error} /></View>}
    {row && (row.mimeType.startsWith("image/") ? <ImagePreview key={row.id} name={row.name} uri={localFile(row.relativePath).uri} /> : row.mimeType === "application/pdf" ? <PdfPreview key={row.id} uri={localFile(row.relativePath).uri} size={row.sizeBytes} /> : <EmptyState title="Open this file in another app" message="Use Share to choose an app that supports this file type." />)}
  </View>;
}
