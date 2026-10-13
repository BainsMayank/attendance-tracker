import Animated, { cubicBezier } from "react-native-reanimated";
import { useTheme } from "./theme-provider";
export function Skeleton({
  width = "100%",
  height = 20,
}: {
  width?: number | `${number}%`;
  height?: number;
}) {
  const { colors, reduceMotion } = useTheme();
  return (
    <Animated.View
      accessible
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
      style={{
        width,
        height,
        borderRadius: 8,
        backgroundColor: colors.surfaceRaised,
        ...(reduceMotion
          ? {}
          : {
              animationName: { from: { opacity: 0.5 }, to: { opacity: 1 } },
              animationDuration: 900,
              animationIterationCount: "infinite",
              animationDirection: "alternate",
              animationTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
            }),
      }}
    />
  );
}
