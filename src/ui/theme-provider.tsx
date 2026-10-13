import {
  createContext,
  use,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import {
  AccessibilityInfo,
  Appearance,
  AppState,
  useColorScheme,
} from "react-native";
import { create } from "zustand";
import { dark, light, type Palette } from "./tokens";
import { accents, type Accent } from "@/features/settings/model";

export type ThemeMode = "system" | "light" | "dark";
export const usePreferences = create<{
  mode: ThemeMode;
  hapticsEnabled: boolean;
  reduceEffects: boolean;
  reduceTransparencyPreference: boolean;
  accent: Accent;
  setMode: (mode: ThemeMode) => void;
  setHaptics: (enabled: boolean) => void;
  setReduceEffects: (enabled: boolean) => void;
}>((set) => ({
  mode: "system",
  hapticsEnabled: true,
  reduceEffects: false,
  reduceTransparencyPreference: false,
  accent: "indigo",
  setMode: (mode) => set({ mode }),
  setHaptics: (hapticsEnabled) => set({ hapticsEnabled }),
  setReduceEffects: (reduceEffects) => set({ reduceEffects }),
}));
type Theme = {
  scheme: "light" | "dark";
  colors: Palette;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  highContrast: boolean;
};
const Context = createContext<Theme | null>(null);
let overridden = false;

export function ThemeProvider({
  children,
  forcedScheme,
}: PropsWithChildren<{ forcedScheme?: "light" | "dark" }>) {
  const system = useColorScheme();
  const mode = usePreferences((s) => s.mode);
  const reduceEffects = usePreferences((s) => s.reduceEffects);
  const reducedSurfaces = usePreferences((s) => s.reduceTransparencyPreference);
  const accent = usePreferences((s) => s.accent);
  useEffect(() => {
    const scheme = forcedScheme ?? (mode === "system" ? "unspecified" : mode);
    // Setting "unspecified" when nothing was overridden pins Android's night
    // mode and stops live system theme changes, so only reset a real override.
    if (scheme !== "unspecified" || overridden) {
      Appearance.setColorScheme(scheme);
      overridden = scheme !== "unspecified";
    }
    if (forcedScheme)
      return () => {
        const preferred = usePreferences.getState().mode;
        Appearance.setColorScheme(
          preferred === "system" ? "unspecified" : preferred,
        );
        overridden = preferred !== "system";
      };
  }, [mode, forcedScheme]);
  const [access, setAccess] = useState({
    motion: true,
    transparency: true,
    contrast: false,
  });
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [motion, transparency, contrast] = await Promise.all([
        AccessibilityInfo.isReduceMotionEnabled(),
        process.env.EXPO_OS === "ios"
          ? AccessibilityInfo.isReduceTransparencyEnabled()
          : Promise.resolve(false),
        process.env.EXPO_OS === "ios"
          ? AccessibilityInfo.isDarkerSystemColorsEnabled()
          : Promise.resolve(false),
      ]);
      if (alive) setAccess({ motion, transparency, contrast });
    };
    void refresh().catch(() => {});
    const subscriptions = [
      AccessibilityInfo.addEventListener("reduceMotionChanged", (motion) =>
        setAccess((s) => ({ ...s, motion })),
      ),
      AccessibilityInfo.addEventListener(
        "reduceTransparencyChanged",
        (transparency) => setAccess((s) => ({ ...s, transparency })),
      ),
      AccessibilityInfo.addEventListener(
        "darkerSystemColorsChanged",
        (contrast) => setAccess((s) => ({ ...s, contrast })),
      ),
      AppState.addEventListener("change", (state) => {
        if (state === "active") void refresh().catch(() => {});
      }),
    ];
    return () => {
      alive = false;
      subscriptions.forEach((s) => s.remove());
    };
  }, []);
  const scheme =
    forcedScheme ??
    (mode === "system" ? (system === "dark" ? "dark" : "light") : mode);
  return (
    <Context
      value={{
        scheme,
        colors: {
          ...(scheme === "dark" ? dark : light),
          accent: accents[accent][scheme],
          onAccent: scheme === "dark" ? accents[accent].onDark : "#FFFFFF",
          accentSubtle:
            scheme === "dark"
              ? accents[accent].onDark
              : accents[accent].light + "12",
        },
        reduceMotion: access.motion || reduceEffects,
        reduceTransparency:
          access.transparency || reduceEffects || reducedSurfaces,
        highContrast: access.contrast,
      }}
    >
      {children}
    </Context>
  );
}
export function useTheme(): Theme {
  const theme = use(Context);
  if (!theme) throw new Error("UI must be inside ThemeProvider");
  return theme;
}
