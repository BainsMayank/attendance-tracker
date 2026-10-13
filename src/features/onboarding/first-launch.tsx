import { useEffect } from "react";
import { router, useRootNavigationState, useSegments } from "expo-router";
import { semestersRepository, settingsRepository } from "@/db/repositories";
import { shouldOnboard } from "./model";

// Mounted inside DatabaseProvider so migration failures never trigger setup.
export function FirstLaunch() {
  const navigation = useRootNavigationState();
  const segments = useSegments();
  useEffect(() => {
    if (
      !navigation?.key ||
      segments[0] === "onboarding" ||
      segments[0] === "onboarding-manual" ||
      segments[0] === "timetable-import" ||
      segments[0] === "semester" ||
      segments[0] === "semester-setup" ||
      segments[0] === "semester-reset" ||
      segments[0] === "timetable-import-preview"
    )
      return;
    if (
      shouldOnboard(
        settingsRepository.get("onboardingVersion")?.value,
        semestersRepository.list().length > 0,
        !!settingsRepository.get("onboardingDraft"),
      )
    )
      router.replace("/onboarding");
  }, [navigation?.key, segments]);
  return null;
}
