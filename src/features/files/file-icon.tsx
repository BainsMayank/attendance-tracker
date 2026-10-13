import Svg, { Path, Rect } from "react-native-svg";
import { View } from "react-native";
import { Text, useTheme } from "@/ui";
export function FileIcon({ folder = false, mime = "", name = "" }: { folder?: boolean; mime?: string; name?: string }) {
  const { colors } = useTheme();
  const label = mime === "application/pdf" ? "PDF" : mime.startsWith("image/") ? "IMG" : name.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE";
  return <View accessible={false} style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
    <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
      {folder ? <Path d="M5 14a4 4 0 0 1 4-4h10l5 5h15a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" fill={colors.accentSubtle} stroke={colors.accent} strokeWidth={2} /> : <><Path d="M12 4h17l10 10v26a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill={colors.accentSubtle} stroke={colors.accent} strokeWidth={2} /><Path d="M28 4v12h11" stroke={colors.accent} strokeWidth={2} /><Rect x={14} y={23} width={17} height={2} fill={colors.accent} /><Rect x={14} y={29} width={13} height={2} fill={colors.accent} /></>}
    </Svg>
    {!folder && <Text variant="caption" style={{ color: colors.accent, fontSize: 10 }}>{label}</Text>}
  </View>;
}
