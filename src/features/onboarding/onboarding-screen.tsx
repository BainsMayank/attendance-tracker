import { useCallback, useRef, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { Stack } from "expo-router/stack";
import { usePreventRemove } from "expo-router/react-navigation";
import { Button, GlassCard, Text, haptic, useToast } from "@/ui";
import { Screen } from "@/features/shell/screen";
import {
  DateField,
  ErrorText,
  Field,
} from "@/features/timetable/form-controls";
import { errorMessage, invalidateTimetable } from "@/features/timetable/hooks";
import { settingsRepository } from "@/db/repositories";
import { localToday } from "@/db/validation";
import { addDays } from "@/lib/attendance";
import {
  finishSetup,
  prepareSetup,
  saveSetupDraft,
} from "@/db/repositories/onboarding";
import {
  onboardingDraftSchema,
  targetBasisPoints,
  validateSemesterDraft,
  type OnboardingDraft,
} from "./model";

function initialDraft(): OnboardingDraft {
  const saved = onboardingDraftSchema.safeParse(
    settingsRepository.get("onboardingDraft")?.value,
  );
  if (saved.success) return saved.data;
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  const startsOn = localToday(timezone);
  return {
    step: "welcome",
    name: "",
    startsOn,
    endsOn: addDays(startsOn, 120),
    timezone,
    target: "75",
    semesterId: null,
  };
}
export function OnboardingScreen() {
  const [draft, setDraft] = useState(initialDraft),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    toast = useToast();
  usePreventRemove(busy, () => {});
  useFocusEffect(
    useCallback(() => {
      setDraft(initialDraft());
    }, []),
  );
  const update = (patch: Partial<OnboardingDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setError("");
    try {
      saveSetupDraft(next);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const advance = (step: OnboardingDraft["step"]) => {
    try {
      if (draft.step === "semester") validateSemesterDraft(draft);
      if (draft.step === "target") targetBasisPoints(draft.target);
      update({ step });
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const choose = async (manual: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    try {
      const next = prepareSetup(draft, manual);
      setDraft(next);
      invalidateTimetable();
      void haptic("success");
      if (manual) router.push("/onboarding-manual");
      else
        router.push({
          pathname: "/timetable-import",
          params: { semesterId: next.semesterId!, onboarding: "1" },
        });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const finish = (manual = false) => {
    try {
      finishSetup();
      invalidateTimetable();
      void haptic("success");
      toast({
        message:
          draft.step === "done"
            ? "Your semester is ready"
            : "Setup skipped. You can build your timetable anytime.",
      });
      router.replace(manual ? "/timetable-subjects" : "/(tabs)/timetable");
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Set up your semester",
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      {draft.step === "welcome" && (
        <>
          <Text variant="heading">Your semester, at a glance</Text>
          <Text secondary>
            Keep your timetable and attendance together. Your data stays on this
            device and your daily tracking works offline.
          </Text>
          <GlassCard solid>
            <Text variant="title">A few details to get started</Text>
            <Text secondary>
              Name your semester, choose your target, then import or build your
              week.
            </Text>
          </GlassCard>
          <Button label="Get started" onPress={() => advance("semester")} />
        </>
      )}
      {draft.step === "semester" && (
        <>
          <Text variant="heading">When is your semester?</Text>
          <Field
            label="Semester name"
            placeholder="e.g. Semester 3"
            maxLength={120}
            value={draft.name}
            onChangeText={(name) => update({ name })}
          />
          <DateField
            label="Starts on"
            value={draft.startsOn}
            onChange={(startsOn) => update({ startsOn })}
          />
          <DateField
            label="Ends on"
            value={draft.endsOn}
            onChange={(endsOn) => update({ endsOn })}
          />
          <Field
            label="Timezone"
            value={draft.timezone}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(timezone) => update({ timezone })}
          />
          <Button label="Continue" onPress={() => advance("target")} />
          <Button
            label="Back"
            variant="secondary"
            onPress={() => update({ step: "welcome" })}
          />
        </>
      )}
      {draft.step === "target" && (
        <>
          <Text variant="heading">Choose your attendance target</Text>
          <Text secondary>
            You can change this later or set a different target for each
            subject.
          </Text>
          <Field
            label="Target percentage"
            value={draft.target}
            keyboardType="decimal-pad"
            maxLength={6}
            onChangeText={(target) => update({ target })}
          />
          <Text variant="caption" secondary>
            Use 0–100%, with up to two decimal places.
          </Text>
          <Button label="Continue" onPress={() => advance("choice")} />
          <Button
            label="Back"
            variant="secondary"
            onPress={() => update({ step: "semester" })}
          />
        </>
      )}
      {draft.step === "choice" && (
        <>
          <Text variant="heading">Make room for your week</Text>
          <GlassCard solid>
            <Text variant="title">{draft.name}</Text>
            <Text secondary>
              {draft.startsOn} – {draft.endsOn} · Target {draft.target}%
            </Text>
          </GlassCard>
          <Text secondary>
            Use ChatGPT or Gemini to turn a timetable photo into JSON, then
            review it here. Or add subjects and classes yourself.
          </Text>
          <Button
            label="Import with AI"
            loading={busy}
            onPress={() => void choose(false)}
          />
          <Button
            label="Build manually"
            variant="secondary"
            disabled={busy}
            onPress={() => void choose(true)}
          />
          {!draft.semesterId && (
            <Button
              label="Back"
              variant="secondary"
              disabled={busy}
              onPress={() => update({ step: "target" })}
            />
          )}
        </>
      )}
      {draft.step === "done" && (
        <>
          <Text variant="heading">Your semester is ready</Text>
          <Text secondary>
            Track each class in Daily Log. Add or change subjects and your
            timetable whenever you need to.
          </Text>
          <Button label="Done" onPress={() => finish(false)} />
          <Button
            label="Add subjects and classes"
            variant="secondary"
            onPress={() => finish(true)}
          />
        </>
      )}
      <ErrorText message={error} />
      {draft.step !== "done" && (
        <Button
          label="Skip setup"
          variant="secondary"
          disabled={busy}
          onPress={() => finish(false)}
        />
      )}
    </Screen>
  );
}
