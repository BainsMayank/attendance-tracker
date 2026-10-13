import {
  Fragment,
  createContext,
  use,
  useEffect,
  type PropsWithChildren,
  type RefObject,
} from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";
import { create } from "zustand";
import { useTheme } from "./theme-provider";

/**
 * Android frosted glass.
 *
 * iOS gets Liquid Glass from the system chrome. Android has no equivalent, so
 * each tab's content renders inside a BlurTargetView (see GradientBackground)
 * registered under its tab name, and chrome that floats over it (the header and
 * the tab bar) blurs that target in real time. Android 12+ only; older versions
 * and Reduce Transparency get an opaque surface instead.
 */
type Target = RefObject<View | null>;
const useTargets = create<{
  targets: Record<string, Target | undefined>;
  set: (scope: string, target: Target | undefined) => void;
}>((set) => ({
  targets: {},
  set: (scope, target) =>
    set((s) => ({ targets: { ...s.targets, [scope]: target } })),
}));

const Scope = createContext<string | null>(null);
/** Names the blur source for everything rendered inside one tab. */
export function GlassScope({ name, children }: PropsWithChildren<{ name: string }>) {
  return <Scope value={name}>{children}</Scope>;
}
export const useGlassScope = () => use(Scope);

/** Registers a BlurTargetView as the blur source for the surrounding scope. */
export function useRegisterGlassTarget(target: Target, enabled: boolean) {
  const scope = useGlassScope();
  const set = useTargets((s) => s.set);
  useEffect(() => {
    if (!scope || !enabled) return;
    set(scope, target);
    return () => {
      if (useTargets.getState().targets[scope] === target) set(scope, undefined);
    };
  }, [scope, target, enabled, set]);
}

const useScrolled = create<{ scrolled: Record<string, boolean> }>(() => ({
  scrolled: {},
}));
/** Whether a tab's content has scrolled under its app bar (Android). */
export const useHeaderScrolled = (scope: string) =>
  useScrolled((s) => !!s.scrolled[scope]);
/** Records a tab's scroll edge; writes only when the state flips. */
export function setHeaderScrolled(scope: string, value: boolean) {
  if (useScrolled.getState().scrolled[scope] === value) return;
  useScrolled.setState((s) => ({ scrolled: { ...s.scrolled, [scope]: value } }));
}

/** True when this device can render real-time blur behind chrome. */
export function useGlassAvailable() {
  const { reduceTransparency, highContrast } = useTheme();
  return (
    process.env.EXPO_OS === "android" &&
    Number(Platform.Version) >= 31 &&
    !reduceTransparency &&
    !highContrast
  );
}

/**
 * Translucent frosted panel: real blur of the scope's content, a tint so text
 * stays legible over busy content, and a hairline edge that catches light.
 */
export function FrostedSurface({
  scope,
  edge,
  fill = "background",
  style,
  children,
  ...props
}: ViewProps & {
  scope: string;
  /** Tint under the blur: the canvas for app bars, the card surface for floating panels. */
  fill?: "background" | "surface";
  /** Which side gets the hairline. "all" outlines a floating panel. */
  edge?: "top" | "bottom" | "all";
}) {
  const { colors, scheme } = useTheme();
  const glass = useGlassAvailable();
  const target = useTargets((s) => s.targets[scope]);
  const live = glass && !!target;
  const hairline =
    edge === "all"
      ? { borderWidth: StyleSheet.hairlineWidth }
      : edge === "top"
        ? { borderTopWidth: StyleSheet.hairlineWidth }
        : edge === "bottom"
          ? { borderBottomWidth: StyleSheet.hairlineWidth }
          : null;
  return (
    <View
      {...props}
      style={[
        { overflow: "hidden" },
        hairline && {
          ...hairline,
          borderColor:
            scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
        },
        style,
      ]}
    >
      {/* Keyed by theme: on a live switch Android keeps the old tint and
          overlay color on these native views, so they remount instead. */}
      {live ? (
        <Fragment key={`glass-${scheme}`}>
          <BlurView
            blurTarget={target}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={scheme === "dark" ? 45 : 35}
            tint={scheme === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: colors[fill],
                opacity: scheme === "dark" ? 0.6 : 0.38,
              },
            ]}
          />
        </Fragment>
      ) : (
        <View
          key={`solid-${scheme}`}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors[fill] }]}
        />
      )}
      {children}
    </View>
  );
}
