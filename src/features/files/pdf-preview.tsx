import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { ErrorText } from "@/features/timetable/form-controls";
import { Text, useTheme } from "@/ui";
export function PdfPreview({ uri, size }: { uri: string; size: number }) {
  const { colors } = useTheme();
  const [html, setHtml] = useState(""), [error, setError] = useState(""), [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      // Base64 plus PDF.js needs several copies in memory. Larger files remain shareable.
      if (size > 20 * 1024 * 1024) throw new Error("PDF previews support files up to 20 MB. Use Share to open this file.");
      const asset = Asset.fromModule(require("../../../assets/files/pdf-viewer.html"));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error("Offline PDF viewer unavailable");
      const template = await new File(asset.localUri).text(), base64 = await new File(uri).base64();
      if (alive) setHtml(template.replace("__PDF_DATA__", JSON.stringify(base64)));
    })().catch(e => { if (alive) setError(e instanceof Error ? e.message : "Could not open PDF"); });
    return () => { alive = false; };
  }, [uri, size]);
  return <View style={{ flex: 1 }}>
    {!ready && !error && <View style={{ padding: 16, gap: 8 }}><ActivityIndicator color={colors.accent} /><Text>Opening PDF…</Text></View>}
    {!!error && <View style={{ padding: 16 }}><ErrorText message={error} /></View>}
    {!!html && <WebView source={{ html, baseUrl: "about:blank" }} style={{ flex: 1, backgroundColor: colors.background }} originWhitelist={["about:*"]} onShouldStartLoadWithRequest={request => request.url === "about:blank" || request.url.startsWith("about:blank#")} javaScriptEnabled allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false} setSupportMultipleWindows={false} onError={e => setError(e.nativeEvent.description)} onContentProcessDidTerminate={() => setError("PDF preview was interrupted. Go back and reopen it, or use Share.")} onMessage={e => {
      try { const value = JSON.parse(e.nativeEvent.data); if (value.error) setError(String(value.error)); if (value.ready) setReady(true); } catch { setError("PDF viewer returned an invalid response"); }
    }} />}
  </View>;
}
