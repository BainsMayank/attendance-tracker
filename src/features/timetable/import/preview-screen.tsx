import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { usePreventRemove } from "expo-router/react-navigation";
import * as Clipboard from "expo-clipboard";
import {
  ActionButton,
  Banner,
  GradientBackground,
  Group,
  GroupLabel,
  Icon,
  RadioCard,
  SegmentedControl,
  Skeleton,
  Text,
  haptic,
  icons,
  toneColors,
  useTheme,
  useToast,
} from "@/ui";
import { ErrorText } from "../form-controls";
import { errorMessage, invalidateTimetable, useTimetable } from "../hooks";
import { scheduleFingerprint } from "@/db/repositories/timetable-commands";
import { importTimetable } from "@/db/repositories/timetable-import";
import { settingsRepository } from "@/db/repositories";
import { savePasteDraft } from "@/db/repositories/onboarding";
import { importPasteSchema } from "@/features/onboarding/model";
import { DAY_NAMES, formatTime, slotsOverlap } from "@/lib/timetable";
import { nameKey, parseImport, withoutSlot } from "./parser";
import { buildImportPreview, type ImportMode } from "./preview";
import { importEffectiveFrom } from "./scope";
import { useImportDraft } from "./draft-store";
import { shortDate } from "@/features/subjects/status";

const mono = process.env.EXPO_OS === "ios" ? "Menlo" : "monospace";

export function ImportPreviewScreen() {
  const params = useLocalSearchParams<{
    semesterId?: string;
    onboarding?: string;
  }>();
  const { data, loading, error: loadError, reload } = useTimetable(
    params.semesterId,
  );
  const stored = useImportDraft();
  const [raw, setRaw] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("replace"),
    [scope, setScope] = useState<"today" | "semester">("today");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [kept, setKept] = useState<{ name: string; day: string; previous: string } | null>(null);
  const lock = useRef(false),
    input = useRef<TextInput>(null),
    toast = useToast();
  const { colors } = useTheme();
  usePreventRemove(busy, () => {});
  // Start from the reply the guide just read from the clipboard, else the saved draft.
  const initial = useMemo(() => {
    if (!data) return "";
    const saved = importPasteSchema.safeParse(
      settingsRepository.get("timetableImportDraft")?.value,
    );
    return stored.raw &&
      (stored.semesterId === data.semester.id || stored.semesterId === null)
      ? stored.raw
      : saved.success &&
          (saved.data.semesterId === data.semester.id ||
            saved.data.semesterId === null)
        ? saved.data.raw
        : "";
    // Only the first load seeds the editor; later edits live in `raw`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.semester.id]);
  const text = raw ?? initial;
  useEffect(() => {
    if (raw === null || !data) return;
    const timer = setTimeout(() => {
      try {
        savePasteDraft(raw, data.semester.id);
        useImportDraft.getState().set(raw, data.semester.id);
      } catch {
        /* The draft is a convenience; the text stays on screen. */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [raw, data]);
  const result = useMemo(() => {
    if (!data || !text.trim()) return null;
    try {
      const from = importEffectiveFrom(data.semester, scope);
      const draft = parseImport(text);
      return { from, draft, preview: buildImportPreview(draft, data, mode, from) };
    } catch (e) {
      return { error: errorMessage(e) };
    }
  }, [data, text, mode, scope]);
  if (loading)
    return (
      <GradientBackground>
        <View style={{ padding: 16, paddingTop: 120, gap: 16 }}>
          <Skeleton height={168} />
          <Skeleton height={200} />
        </View>
      </GradientBackground>
    );
  if (loadError || !data)
    return (
      <GradientBackground>
        <View style={{ padding: 16, paddingTop: 120, gap: 16 }}>
          <ErrorText message={loadError || "No semester is available."} />
          <ActionButton label={loadError ? "Retry" : "Back"} onPress={loadError ? reload : () => router.back()} />
        </View>
      </GradientBackground>
    );
  const ok =
    result?.preview && result.draft
      ? { from: result.from!, draft: result.draft, preview: result.preview }
      : null;
  const parseError = result?.error ?? "";
  const model = ok?.preview;
  // Overlapping pairs; an imported class can be dropped to resolve one.
  const pairs: [number, number][] = [];
  if (model)
    for (let i = 0; i < model.slots.length; i++)
      for (let j = 0; j < i; j++)
        if (slotsOverlap(model.slots[i], model.slots[j])) pairs.push([j, i]);
  const pair = pairs[0];
  const otherConflicts = model
    ? [...model.conflicts.values()].flat().filter((m) => !m.startsWith("Overlaps Slot") && !m.startsWith("Overlaps Existing"))
    : [];
  const describe = (index: number) => {
    const s = model!.slots[index];
    return `${s.subjectName} (${formatTime(s.startMinute)}–${formatTime(s.endMinute)}${s.room ? `, ${s.room}` : ""})`;
  };
  const keep = (keepIndex: number, dropIndex: number) => {
    const drop = model!.slots[dropIndex];
    if (!drop.imported) return;
    try {
      const next = withoutSlot(text, Number(drop.label.replace("Slot ", "")));
      setKept({
        name: model!.slots[keepIndex].subjectName,
        day: DAY_NAMES[drop.weekday - 1],
        previous: text,
      });
      setRaw(next);
      void haptic("selection");
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const imported = model?.slots.filter((s) => s.imported) ?? [];
  const blocked = !model || !!model.errors.length || !!model.conflicts.size || data.semester.archivedAt !== null;
  const commit = async () => {
    if (lock.current || blocked) return;
    lock.current = true;
    setBusy(true);
    setError("");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const saved = importTimetable({
        raw: text,
        semesterId: data.semester.id,
        expectedFingerprint: scheduleFingerprint(data),
        mode,
        scope,
        onboarding: params.onboarding === "1",
      });
      const paste = settingsRepository.get("timetableImportDraft");
      // Clearing a convenience draft must not turn a durable save into a failure.
      try {
        if (paste) settingsRepository.remove("timetableImportDraft", paste.revision);
      } catch {
        /* The saved timetable is authoritative. */
      }
      useImportDraft.getState().set("", null);
      invalidateTimetable();
      void haptic("success");
      toast({
        message: "Timetable imported",
        undo: () => {
          saved.undo();
          invalidateTimetable();
        },
      });
      setBusy(false);
      requestAnimationFrame(() =>
        router.dismissTo(params.onboarding === "1" ? "/onboarding" : "/(tabs)/timetable"),
      );
    } catch (e) {
      setError(errorMessage(e));
      void haptic("error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const subjectRows = model
    ? model.subjects.map((s) => ({
        name: s.name,
        existing: s.existing,
        n: imported.filter((x) => nameKey(x.subjectName) === nameKey(s.name)).length,
      }))
    : [];
  const days = model
    ? DAY_NAMES.map((d, i) => ({
        d: d.slice(0, 3),
        n: model.slots.filter((s) => s.weekday === i + 1).length,
        clash: pairs.some(([a]) => model.slots[a].weekday === i + 1),
      })).filter((x, i) => i < 5 || x.n > 0)
    : [];
  const borderColor = !text.trim()
    ? colors.separator
    : parseError
      ? colors.absent
      : colors.present;
  return (
    <GradientBackground>
      <Stack.Screen options={{ title: "", headerLargeTitleEnabled: false }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 40,
          gap: 16,
          width: "100%",
          maxWidth: 680,
          alignSelf: "center",
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ marginHorizontal: 4, fontSize: 30, lineHeight: 36, fontWeight: "600", letterSpacing: -0.3 }}
        >
          Review import
        </Text>
        <View style={{ gap: 8 }}>
          <GroupLabel>Chatbot reply</GroupLabel>
          <TextInput
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            ref={input}
            accessibilityLabel="Chatbot reply"
            value={text}
            onChangeText={(v) => {
              setRaw(v);
              setKept(null);
              setError("");
            }}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            maxLength={512000}
            textAlignVertical="top"
            placeholder='Paste the reply that starts with {"formatVersion": 1'
            placeholderTextColor={colors.textSecondary}
            style={{
              height: 168,
              marginTop: 8,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: 12,
              fontFamily: mono,
              fontSize: 12,
              lineHeight: 18,
              color: colors.textPrimary,
            }}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SmallButton
            label="Paste again"
            icon={icons.paste}
            onPress={async () => {
              const value = await Clipboard.getStringAsync().catch(() => "");
              if (!value.trim()) setError("Nothing to paste. Copy the chatbot’s reply first.");
              else {
                setRaw(value.slice(0, 512000));
                setKept(null);
                setError("");
              }
            }}
          />
          <SmallButton label="Clear" onPress={() => { setRaw(""); setKept(null); }} />
        </View>
        {!!parseError && <Banner tone="bad" icon={icons.warning}>{parseError}</Banner>}
        {ok && (
          <Banner tone="ok" icon={icons.checkCircle}>
            {`Read ${ok.draft.subjects.length} ${ok.draft.subjects.length === 1 ? "subject" : "subjects"} and ${ok.draft.slots.length} weekly ${ok.draft.slots.length === 1 ? "class" : "classes"}${model!.duplicates ? ` · ${model!.duplicates} exact ${model!.duplicates === 1 ? "duplicate" : "duplicates"} skipped` : ""}`}
          </Banner>
        )}
        {pair && (
          <View
            accessibilityLabel="Overlap to resolve"
            style={{
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: colors.absent,
              backgroundColor: colors.surface,
              padding: 14,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Icon name={icons.warning} size={20} color={colors.absent} />
              <Text style={{ flex: 1, color: colors.absent, fontSize: 16, fontWeight: "600" }}>
                {pairs.length} {pairs.length === 1 ? "overlap" : "overlaps"} to fix ·{" "}
                {DAY_NAMES[model!.slots[pair[0]].weekday - 1]}
              </Text>
            </View>
            <Text variant="secondary" secondary>
              {describe(pair[0])} overlaps {describe(pair[1])}.{" "}
              {model!.slots[pair[0]].imported && model!.slots[pair[1]].imported
                ? "The photo may have been misread."
                : "One of them is already in your timetable; Replace mode swaps it out."}
            </Text>
            <View style={{ gap: 8 }}>
              {(
                [
                  [pair[0], pair[1]],
                  [pair[1], pair[0]],
                ] as const
              ).map(([k, d]) =>
                model!.slots[d].imported ? (
                  <SmallButton
                    key={k}
                    full
                    label={`Keep ${model!.slots[k].subjectName}`}
                    onPress={() => keep(k, d)}
                  />
                ) : null,
              )}
              <SmallButton full label="Edit the reply" onPress={() => input.current?.focus()} />
            </View>
          </View>
        )}
        {kept && !pair && (
          <Banner
            tone="neutral"
            icon={icons.check}
            action={{ label: "Undo", onPress: () => { setRaw(kept.previous); setKept(null); } }}
          >
            <Text style={{ fontSize: 15 }}>
              Kept {kept.name} on {kept.day}
            </Text>
          </Banner>
        )}
        {model?.errors.map((m) => (
          <Banner key={m} tone="bad" icon={icons.warning}>{m}</Banner>
        ))}
        {otherConflicts.slice(0, 3).map((m) => (
          <Banner key={m} tone="bad" icon={icons.warning}>{m}</Banner>
        ))}
        {model && (
          <>
            <GroupLabel>Subjects</GroupLabel>
            <Group>
              {subjectRows.map((s) => {
                const c = toneColors(colors, s.existing ? "neutral" : "accent");
                return (
                  <View
                    key={s.name}
                    accessible
                    accessibilityLabel={`${s.name}, ${s.n} a week, ${s.existing ? "matches an existing subject" : "new subject"}`}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingVertical: 8, paddingHorizontal: 14 }}
                  >
                    <Text style={{ flex: 1, fontSize: 15 }}>{s.name}</Text>
                    <Text variant="caption" secondary>
                      {s.n}/wk
                    </Text>
                    <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 7, backgroundColor: c.bg, justifyContent: "center" }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: c.fg }}>
                        {s.existing ? "Matches" : "New"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Group>
            <GroupLabel>Week</GroupLabel>
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 6,
              }}
            >
              {days.map((d) => (
                <View
                  key={d.d}
                  accessible
                  accessibilityLabel={`${d.d}: ${d.n} classes${d.clash ? ", has an overlap" : ""}`}
                  style={{ flex: 1, alignItems: "center" }}
                >
                  <Text variant="caption" secondary style={{ fontWeight: "600" }}>
                    {d.d}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: "600", color: d.clash ? colors.absent : colors.textPrimary }}>
                    {d.n}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
        <GroupLabel>How to apply</GroupLabel>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          <RadioCard
            title="Replace current timetable"
            subtitle="Weekly classes are swapped. Subjects, files and past attendance stay."
            selected={mode === "replace"}
            onPress={() => !busy && setMode("replace")}
          />
          <RadioCard
            title="Merge with current"
            subtitle="Adds new classes. Exact duplicates are skipped."
            selected={mode === "merge"}
            onPress={() => !busy && setMode("merge")}
          />
        </View>
        <SegmentedControl
          values={["From today", "Whole semester"] as const}
          value={scope === "today" ? "From today" : "Whole semester"}
          onChange={(v) => !busy && setScope(v === "From today" ? "today" : "semester")}
        />
        <ErrorText message={error} />
        <View style={{ gap: 8, marginTop: 4 }}>
          <ActionButton
            label={
              !model
                ? "Paste a reply to continue"
                : pairs.length || model.conflicts.size
                  ? "Fix the overlap to continue"
                  : model.errors.length
                    ? "Fix the issues above to continue"
                    : `Import ${imported.length} ${imported.length === 1 ? "class" : "classes"}`
            }
            loading={busy}
            disabled={blocked}
            style={{ minHeight: 52 }}
            onPress={() => void commit()}
          />
          <Text variant="caption" secondary style={{ textAlign: "center" }}>
            {blocked || !ok
              ? "Nothing is saved until you confirm."
              : `${mode === "replace" ? "Replaces" : "Merges into"} your timetable ${scope === "today" ? `from ${shortDate(ok.from, true)}` : `for all of ${data.semester.name}`}.`}
          </Text>
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

function SmallButton({
  label,
  icon,
  onPress,
  full = false,
}: {
  label: string;
  icon?: { ios: string; android: string };
  onPress: () => void;
  full?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: full ? 44 : 36,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.separator,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon && <Icon name={icon} size={14} color={colors.textPrimary} />}
      <Text style={{ fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
