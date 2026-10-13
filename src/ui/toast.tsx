import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AccessibilityInfo, Pressable, ToastAndroid, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Text } from "./text";
import { useTheme } from "./theme-provider";
import { dark, light } from "./tokens";
import { haptic } from "./haptics";
export type ToastMessage = {
  message: string;
  undo?: () => void | Promise<void>;
};
const Context = createContext<((toast: ToastMessage) => void) | null>(null);
export function ToastProvider({ children }: PropsWithChildren) {
  const { scheme, reduceMotion } = useTheme();
  // Snackbars sit on the inverse surface so they read over any content.
  const other = scheme === "dark" ? light : dark;
  const inverse = {
    surface: other.surfaceRaised,
    text: other.textPrimary,
    muted: other.textSecondary,
    accent: other.accent,
  };
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<(ToastMessage & { id: number }) | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const lock = useRef(false),
    sequence = useRef(0);
  const show = (message: ToastMessage) => {
    // Android: every undoable action has a direct reverse on screen (steppers,
    // re-marking, restore), so confirmations stay silent apart from TalkBack.
    // Errors and notices use the system toast: no buttons, gone on its own.
    if (process.env.EXPO_OS === "android") {
      if (message.undo) AccessibilityInfo.announceForAccessibility(message.message);
      else ToastAndroid.show(message.message, ToastAndroid.SHORT);
      return;
    }
    lock.current = false;
    setBusy(false);
    setToast({ ...message, id: ++sequence.current });
    AccessibilityInfo.announceForAccessibility(message.message);
  };
  useEffect(() => {
    if (!toast || busy) return;
    let timer: ReturnType<typeof setTimeout>,
      alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(async (enabled) => {
      const duration = enabled ? 12000 : 4000;
      const recommended =
        process.env.EXPO_OS === "android"
          ? await AccessibilityInfo.getRecommendedTimeoutMillis(duration)
          : duration;
      if (alive) timer = setTimeout(() => setToast(null), recommended);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [toast, busy]);
  return (
    <Context value={show}>
      {children}
      {toast && (
        <Animated.View
          key={toast.id}
          entering={FadeIn.duration(reduceMotion ? 0 : 180)}
          exiting={FadeOut.duration(reduceMotion ? 0 : 150)}
          style={{
            position: "absolute",
            bottom: insets.bottom + 64,
            left: 16,
            right: 16,
            maxWidth: 560,
            alignSelf: "center",
            minHeight: 48,
            borderRadius: 10,
            borderCurve: "continuous",
            backgroundColor: inverse.surface,
            boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
            paddingLeft: 16,
            paddingRight: 4,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{
              flex: 1,
              paddingVertical: 12,
              fontSize: 15,
              lineHeight: 20,
              color: inverse.text,
            }}
          >
            {toast.message}
          </Text>
          <View style={{ flexDirection: "row" }}>
            {toast.undo && (
              <Pressable
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Undo"
                style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: "center" }}
                onPress={async () => {
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(true);
                  try {
                    await toast.undo!();
                    if (toast.id === sequence.current) {
                      setToast(null);
                      void haptic("light");
                    }
                  } catch (error) {
                    if (toast.id === sequence.current)
                      show({
                        message: `Undo failed: ${error instanceof Error ? error.message : "Please retry"}`,
                        undo: toast.undo,
                      });
                  } finally {
                    if (toast.id === sequence.current) {
                      lock.current = false;
                      setBusy(false);
                    }
                  }
                }}
              >
                <Text style={{ color: inverse.accent, fontSize: 15, fontWeight: "600" }}>
                  {busy ? "Undoing…" : "Undo"}
                </Text>
              </Pressable>
            )}
            <Pressable
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
              style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: "center" }}
              onPress={() => setToast(null)}
            >
              <Text style={{ color: inverse.muted, fontSize: 15 }}>Dismiss</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Context>
  );
}
export function useToast() {
  const show = use(Context);
  if (!show) throw new Error("ToastProvider missing");
  return show;
}
