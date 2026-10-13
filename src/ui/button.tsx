import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
} from "react-native";
import Animated, { cubicBezier } from "react-native-reanimated";
import { Text } from "./text";
import { useTheme } from "./theme-provider";
import { radii, spacing } from "./tokens";

export type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  label: string;
  variant?: "primary" | "secondary" | "destructive";
  loading?: boolean;
};
export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const { colors, reduceMotion } = useTheme();
  const [pressed, setPressed] = useState(false);
  const ink =
    variant === "primary"
      ? colors.onAccent
      : variant === "destructive"
        ? colors.absent
        : colors.accent;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={12}
    >
      <Animated.View
        style={{
          minHeight: process.env.EXPO_OS === "ios" ? 44 : 48,
          paddingHorizontal: spacing.gutter,
          paddingVertical: spacing.md,
          borderRadius: radii.input,
          borderCurve: "continuous",
          backgroundColor:
            variant === "primary"
              ? colors.accent
              : variant === "destructive"
                ? colors.absentSubtle
                : colors.accentSubtle,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !reduceMotion ? 0.97 : 1 }],
          transitionProperty: ["transform", "opacity"],
          transitionDuration: reduceMotion ? 0 : pressed ? 100 : 120,
          transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
        }}
      >
        {loading && <ActivityIndicator color={ink} />}
        <Text variant="title" style={{ color: ink, textAlign: "center" }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
