import * as Haptics from "expo-haptics";
import { usePreferences } from "./theme-provider";

export async function haptic(
  kind: "selection" | "light" | "medium" | "success" | "error" = "light",
) {
  if (!usePreferences.getState().hapticsEnabled) return;
  try {
    if (kind === "selection") await Haptics.selectionAsync();
    else if (kind === "light" || kind === "medium")
      await Haptics.impactAsync(
        kind === "light"
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium,
      );
    else
      await Haptics.notificationAsync(
        kind === "success"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
  } catch {
    /* Hardware feedback is optional; visible feedback remains authoritative. */
  }
}
