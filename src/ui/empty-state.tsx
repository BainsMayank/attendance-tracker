import { View } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useTheme } from "./theme-provider";
import { Text } from "./text";
import { Button } from "./button";
export function EmptyState({
  title,
  message,
  icon = { ios: "tray", android: "inbox", web: "inbox" },
  action,
}: {
  title: string;
  message: string;
  icon?: SymbolViewProps["name"];
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 32, gap: 16, alignItems: "center" }}>
      <SymbolView name={icon} size={32} tintColor={colors.textMuted} />
      <Text
        variant="heading"
        accessibilityRole="header"
        style={{ textAlign: "center" }}
      >
        {title}
      </Text>
      <Text secondary style={{ textAlign: "center", maxWidth: 360 }}>
        {message}
      </Text>
      {action && <Button {...action} />}
    </View>
  );
}
