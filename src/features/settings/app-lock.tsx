import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { AppState, Modal, View } from "react-native";
import * as Authentication from "expo-local-authentication";
import { z } from "zod";
import { create } from "zustand";
import { Button, Text, useTheme } from "@/ui";
import { readPreference, savePreference } from "./preferences";
import { subscribeTimetable } from "@/features/timetable/hooks";
import { requiresUnlock, canAccessWorkspace } from "./model";

export const useAppLock = create<{
  unlocked: boolean;
  backgroundAt: number | null;
}>(() => ({ unlocked: false, backgroundAt: null }));
// Response listeners can run before the AppState listener on return. Check the
// shared timestamp too, so a pending reminder action cannot race authentication.
export function canOpenWorkspace(now = Date.now()) {
  const state = useAppLock.getState();
  return canAccessWorkspace(state.unlocked, state.backgroundAt, now);
}
let authenticating = false;
export async function authenticate() {
  if (process.env.EXPO_OS === "web")
    throw new Error("App lock is available on iOS and Android.");
  if (authenticating) return false;
  authenticating = true;
  try {
    const result = await Authentication.authenticateAsync({
      promptMessage: "Unlock Attendance Tracker",
      cancelLabel: "Cancel",
      fallbackLabel: "Use device passcode",
      disableDeviceFallback: false,
    });
    return result.success;
  } finally {
    authenticating = false;
  }
}
export async function changeAppLock(enabled: boolean) {
  if (
    enabled &&
    (!(await Authentication.hasHardwareAsync()) ||
      !(await Authentication.isEnrolledAsync()))
  )
    throw new Error(
      "Set up Face ID, Touch ID or fingerprint recognition in your phone settings first.",
    );
  if (!(await authenticate()))
    throw new Error("Authentication cancelled. App lock was unchanged.");
  return savePreference("appLock", enabled);
}
export function AppLock({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(() =>
    readPreference("appLock", z.boolean(), false),
  );
  const [covered, setCovered] = useState(AppState.currentState !== "active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unlocked = useAppLock((s) => s.unlocked);
  const enabledRef = useRef(enabled);
  const backgroundAt = useRef<number | null>(null);
  const unlock = async () => {
    setBusy(true);
    setError("");
    try {
      if (await authenticate()) useAppLock.setState({ unlocked: true });
      else
        setError(
          "Authentication was cancelled or unsuccessful. Try again to unlock.",
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not authenticate. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const initial = readPreference("appLock", z.boolean(), false);
    useAppLock.setState({ unlocked: !initial, backgroundAt: null });
    const initialPrompt = setTimeout(() => {
      if (initial && AppState.currentState === "active") void unlock();
    }, 0);
    const unsubscribe = subscribeTimetable(() => {
      const next = readPreference("appLock", z.boolean(), false);
      enabledRef.current = next;
      setEnabled(next);
      // Enabling is already authenticated by changeAppLock. Restore never imports appLock.
      if (!next) useAppLock.setState({ unlocked: true, backgroundAt: null });
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        if (backgroundAt.current === null) {
          backgroundAt.current = Date.now();
          if (enabledRef.current)
            useAppLock.setState({ backgroundAt: backgroundAt.current });
        }
        if (enabledRef.current) setCovered(true);
      } else if (state === "inactive") {
        if (enabledRef.current) setCovered(true);
      } else if (state === "active") {
        setCovered(false);
        if (
          !authenticating &&
          backgroundAt.current !== null &&
          requiresUnlock(enabledRef.current, backgroundAt.current, Date.now())
        )
          useAppLock.setState({ unlocked: false });
        backgroundAt.current = null;
        useAppLock.setState({ backgroundAt: null });
      }
    });
    return () => {
      clearTimeout(initialPrompt);
      unsubscribe();
      subscription.remove();
    };
    // Mount only: the subscription reads the persisted preference.
  }, []);
  const hidden = enabled && (!unlocked || covered);
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1, opacity: hidden ? 0 : 1 }}
        pointerEvents={hidden ? "none" : "auto"}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      <Modal
        visible={hidden}
        animationType="none"
        presentationStyle="fullScreen"
        allowSwipeDismissal={false}
        onRequestClose={() => {}}
      >
        <View
          accessibilityViewIsModal
          style={{
            flex: 1,
            backgroundColor: colors.background,
            justifyContent: "center",
            padding: 32,
            gap: 24,
          }}
        >
          <Text variant="heading" accessibilityRole="header">
            Your workspace is locked
          </Text>
          <Text secondary>Authenticate with your phone to continue.</Text>
          {error ? (
            <Text selectable accessibilityLiveRegion="assertive">
              {error}
            </Text>
          ) : null}
          <Button
            label="Unlock"
            loading={busy}
            disabled={covered}
            onPress={() => void unlock()}
          />
        </View>
      </Modal>
    </View>
  );
}
