import { Pressable } from "react-native";
import { useTheme } from "./theme-provider";
import { Text } from "./text";
export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 12,
        justifyContent: "center",
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.controlBorder,
        backgroundColor: selected ? colors.accentSubtle : colors.surface,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        variant="secondary"
        style={{ color: selected ? colors.accent : colors.textSecondary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
