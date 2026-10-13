import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { useTheme } from "./theme-provider";
import { useBlurTarget } from "./gradient-background";
import { radii, spacing } from "./tokens";

export function GlassCard({
  children,
  style,
  solid = false,
  ...props
}: ViewProps & { solid?: boolean }) {
  const { colors, scheme, reduceTransparency, highContrast } = useTheme();
  const target = useBlurTarget();
  const opaque =
    solid ||
    reduceTransparency ||
    highContrast ||
    (process.env.EXPO_OS === "android" &&
      (!target || Number(Platform.Version) < 31));
  const glass =
    !opaque &&
    process.env.EXPO_OS === "ios" &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  const shape = {
    borderRadius: radii.card,
    borderCurve: "continuous" as const,
    overflow: "hidden" as const,
  };
  const content = (
    <View style={{ padding: spacing.row, gap: spacing.md }}>{children}</View>
  );
  if (opaque)
    return (
      <View
        {...props}
        style={[
          shape,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.separator,
          },
          style,
        ]}
      >
        {content}
      </View>
    );
  if (glass)
    return (
      <GlassView
        {...props}
        colorScheme={scheme}
        glassEffectStyle="regular"
        style={[shape, style]}
      >
        {content}
      </GlassView>
    );
  return (
    <View {...props} style={[shape, style]}>
      <BlurView
        blurTarget={target}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={scheme === "dark" ? 55 : 40}
        tint={scheme}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.surface,
            opacity: scheme === "dark" ? 0.8 : 0.85,
          },
        ]}
      />
      {content}
    </View>
  );
}
