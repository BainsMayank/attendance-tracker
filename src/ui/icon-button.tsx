import { Pressable } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useTheme } from "./theme-provider";

export function IconButton({
  label,
  name,
  onPress,
  disabled = false,
}: {
  label: string;
  name: SymbolViewProps["name"];
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 48,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        backgroundColor: colors.accentSubtle,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <SymbolView name={name} tintColor={colors.accent} size={22} />
    </Pressable>
  );
}
