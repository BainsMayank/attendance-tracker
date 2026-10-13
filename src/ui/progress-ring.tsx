import { useEffect } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
  ReduceMotion,
} from "react-native-reanimated";
import { useTheme } from "./theme-provider";
import { Text } from "./text";
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export function ProgressRing({
  progress,
  size = 128,
  label,
  color,
  valueLabel,
}: {
  progress: number | null;
  size?: number;
  label?: string;
  color?: string;
  valueLabel?: string;
}) {
  const { colors, reduceMotion } = useTheme();
  const fraction =
    progress === null || !Number.isFinite(progress)
      ? 0
      : Math.max(0, Math.min(1, progress));
  const value = useSharedValue(0);
  const radius = (size - 12) / 2,
    circumference = 2 * Math.PI * radius;
  useEffect(() => {
    value.set(
      withTiming(fraction, {
        duration: reduceMotion ? 0 : 180,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [fraction, reduceMotion, value]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.get()),
  }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Attendance"}
      accessibilityValue={
        progress === null
          ? { text: "No counted classes" }
          : { min: 0, max: 100, now: fraction * 100, text: valueLabel }
      }
      style={{
        width: size,
        minHeight: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.surfaceRaised}
          strokeWidth={8}
        />
        <AnimatedCircle
          animatedProps={animatedProps}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color ?? colors.accent}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text
        variant="heading"
        selectable
        style={{
          fontVariant: ["tabular-nums"],
          textAlign: "center",
          maxWidth: size - 24,
        }}
      >
        {valueLabel ??
          (progress === null ? "—" : `${Math.round(fraction * 100)}%`)}
      </Text>
    </View>
  );
}
