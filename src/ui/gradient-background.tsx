import {
  createContext,
  use,
  useEffect,
  useRef,
  type PropsWithChildren,
} from "react";
import { StyleSheet, View } from "react-native";
import { BlurTargetView } from "expo-blur";
import { useTheme } from "./theme-provider";
import { setHeaderScrolled, useGlassScope, useRegisterGlassTarget } from "./glass";

const BlurTarget = createContext<React.RefObject<View | null> | undefined>(
  undefined,
);
export const useBlurTarget = () => use(BlurTarget);
/**
 * Flat app canvas. Inside a tab on Android the content itself is the blur
 * source, so the frosted header and tab bar show it moving underneath.
 */
export function GradientBackground({ children }: PropsWithChildren) {
  const { colors, scheme } = useTheme();
  const ref = useRef<View>(null);
  const scope = useGlassScope();
  const wraps = process.env.EXPO_OS === "android" && !!scope;
  useRegisterGlassTarget(ref, wraps);
  // Content remounts at the top on a theme switch, so the app bar must too.
  useEffect(() => {
    if (scope) setHeaderScrolled(scope, false);
  }, [scope, scheme]);
  if (wraps)
    return (
      <BlurTargetView
        // The native blur source keeps stale pixels across a live theme
        // switch; remount it, as Android itself recreates screens on uiMode.
        key={scheme}
        ref={ref}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        {children}
      </BlurTargetView>
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BlurTargetView
        ref={ref}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
      />
      <BlurTarget value={ref}>{children}</BlurTarget>
    </View>
  );
}
