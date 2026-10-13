import { Text as NativeText, type TextProps } from "react-native";
import { useTheme } from "./theme-provider";
import { type } from "./tokens";

export function Text({
  variant = "body",
  secondary = false,
  style,
  ...props
}: TextProps & { variant?: keyof typeof type; secondary?: boolean }) {
  const { colors } = useTheme();
  return (
    <NativeText
      {...props}
      style={[
        type[variant],
        { color: secondary ? colors.textSecondary : colors.textPrimary },
        style,
      ]}
    />
  );
}
