import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setHeaderScrolled, useGlassScope } from "@/ui";

/** Height of the floating Android tab bar, excluding its bottom margin. */
export const FLOATING_TAB_BAR = 64;
export const FLOATING_TAB_GAP = 12;

/**
 * Bottom padding that keeps a tab's content clear of the floating Android tab
 * bar at rest while still letting it scroll underneath. iOS insets itself.
 */
export function useChromeInsets() {
  const scope = useGlassScope();
  const { bottom } = useSafeAreaInsets();
  if (process.env.EXPO_OS !== "android" || !scope) return undefined;
  return { paddingBottom: bottom + FLOATING_TAB_GAP + FLOATING_TAB_BAR + 32 };
}

/**
 * Scroll handler that drives the Android app bar's scrolled state (Material 3
 * "on scroll" tint). Updates the store only when the state flips.
 */
export function useHeaderScrollEdge() {
  const scope = useGlassScope();
  if (process.env.EXPO_OS !== "android" || !scope) return undefined;
  return (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setHeaderScrolled(scope, event.nativeEvent.contentOffset.y > 2);
}
