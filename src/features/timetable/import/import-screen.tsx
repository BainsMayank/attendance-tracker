import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import {
  ActionButton,
  Card,
  GradientBackground,
  Icon,
  Text,
  haptic,
  icons,
  useTheme,
} from "@/ui";
import { ErrorText } from "../form-controls";
import { errorMessage, useTimetable } from "../hooks";
import { savePasteDraft } from "@/db/repositories/onboarding";
import { IMPORT_PROMPT } from "./prompt";
import { useImportDraft } from "./draft-store";

const services = [
  ["ChatGPT", "https://chatgpt.com/"],
  ["Gemini", "https://gemini.google.com/"],
  ["Claude", "https://claude.ai/"],
] as const;
const mono = process.env.EXPO_OS === "ios" ? "Menlo" : "monospace";

function Step({
  n,
  title,
  body,
  last = false,
  children,
}: {
  n: number;
  title: string;
  body: ReactNode;
  last?: boolean;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 14 }}>
      <View style={{ alignItems: "center" }}>
        <View
          accessibilityLabel={`Step ${n}`}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surfaceRaised,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
            {n}
          </Text>
        </View>
        {!last && (
          <View
            style={{
              width: 2,
              flex: 1,
              marginTop: 6,
              borderRadius: 1,
              backgroundColor: colors.separator,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 10, paddingBottom: last ? 0 : 22 }}>
        <Text
          accessibilityRole="header"
          style={{ marginTop: 4, fontSize: 18, lineHeight: 23, fontWeight: "600" }}
        >
          {title}
        </Text>
        <Text variant="secondary" secondary>
          {body}
        </Text>
        {children}
      </View>
    </View>
  );
}

export function ImportScreen() {
  const params = useLocalSearchParams<{
    semesterId?: string;
    onboarding?: string;
  }>();
  const { data, loading, error: loadError, reload } = useTimetable(
    params.semesterId,
  );
  const semesterId = data?.semester.id ?? null;
  const [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [busy, setBusy] = useState(false);
  const { colors } = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(IMPORT_PROMPT);
      void haptic("success");
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const open = (name: string, url: string) =>
    void Linking.openURL(url).catch(() =>
      setError(`Could not open ${name}. Open ${url} in your browser, then come back.`),
    );
  const paste = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = await Clipboard.getStringAsync().catch(() => "");
      if (value.length > 512000)
        throw new Error("The copied text is too large. Copy one timetable under 512,000 characters.");
      if (value.trim()) {
        useImportDraft.getState().set(value, semesterId);
        savePasteDraft(value, semesterId);
      }
      router.push({
        pathname: "/timetable-import-preview",
        params: { semesterId: semesterId ?? undefined, onboarding: params.onboarding },
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const archived = data?.semester.archivedAt != null;
  return (
    <GradientBackground>
      <Stack.Screen options={{ title: "", headerLargeTitleEnabled: false }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 40,
          gap: 20,
          width: "100%",
          maxWidth: 680,
          alignSelf: "center",
        }}
      >
        <View style={{ gap: 8 }}>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 30, lineHeight: 36, fontWeight: "600", letterSpacing: -0.3 }}
          >
            Import from a photo
          </Text>
          <Text style={{ fontSize: 16, lineHeight: 23, color: colors.textSecondary }}>
            This app doesn’t run AI itself, so it stays free. A chatbot you
            already use reads the photo; you paste its answer back here. Takes
            about two minutes.
          </Text>
        </View>
        <View accessibilityRole="list">
          <Step
            n={1}
            title="Get a clear picture"
            body="Photograph or screenshot the full week. Keep it flat and well lit, with every day, time and room readable."
          />
          <Step
            n={2}
            title="Open a free AI chat"
            body="Any of these works on the free plan. Start a new chat."
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {services.map(([name, url]) => (
                <Pressable
                  key={name}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${name}`}
                  onPress={() => open(name, url)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.separator,
                    backgroundColor: colors.surface,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15, fontWeight: "600" }}>
                    {name}
                  </Text>
                  <Icon name={icons.link} size={11} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          </Step>
          <Step
            n={3}
            title="Attach the photo and send this prompt"
            body="The prompt tells the chatbot exactly which format this app reads."
          >
            <Card padding={0} gap={0} style={{ overflow: "hidden", borderWidth: 1, borderColor: colors.separator }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.separator,
                }}
              >
                <Text variant="caption" secondary style={{ fontWeight: "600" }}>
                  Import prompt · v1
                </Text>
                <Text variant="caption" secondary>
                  {IMPORT_PROMPT.length.toLocaleString()} characters
                </Text>
              </View>
              <ScrollView
                nestedScrollEnabled
                accessibilityLabel="Prompt text"
                style={{ maxHeight: 236, backgroundColor: colors.background }}
                contentContainerStyle={{ padding: 14 }}
              >
                <Text selectable style={{ fontFamily: mono, fontSize: 12, lineHeight: 18 }}>
                  {IMPORT_PROMPT}
                </Text>
              </ScrollView>
            </Card>
            <ActionButton
              label={copied ? "Copied. Now paste it in the chat" : "Copy prompt"}
              icon={copied ? icons.check : icons.copy}
              variant={copied ? "success" : "primary"}
              accessibilityLiveRegion="polite"
              onPress={() => void copy()}
            />
          </Step>
          <Step
            n={4}
            last
            title="Copy the reply, paste it here"
            body={
              <>
                The reply is a block of text starting with{" "}
                <Text style={{ fontFamily: mono, fontSize: 13, color: colors.textPrimary }}>
                  {'{"formatVersion": 1'}
                </Text>
                . If the chatbot asks about a smudged cell, answer it first.
              </>
            }
          >
            <ActionButton
              label="Paste reply"
              icon={icons.paste}
              variant="inverted"
              loading={busy}
              disabled={!data || archived || !!loadError}
              onPress={() => void paste()}
            />
          </Step>
        </View>
        <ErrorText message={loadError || error} />
        {loadError && (
          <ActionButton label="Retry loading semester" variant="tonal" onPress={reload} />
        )}
        {!loading && !loadError && !data && (
          <Card>
            <Text secondary>
              Create a semester first so the import has dates to apply to.
            </Text>
            <ActionButton label="Set up semester" onPress={() => router.push("/timetable-semester")} />
          </Card>
        )}
        {archived && (
          <Text secondary>
            This semester is archived. Choose the active semester in Timetable to import.
          </Text>
        )}
        <Card style={{ flexDirection: "row", gap: 12 }}>
          <Icon name={icons.lock} size={20} color={colors.present} />
          <Text variant="secondary" secondary style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600" }}>Your photo never touches this app.</Text>{" "}
            It goes only to the chatbot you pick. You review everything before
            it’s saved.
          </Text>
        </Card>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            params.onboarding === "1" ? router.push("/onboarding-manual") : router.back()
          }
          style={{ alignSelf: "center", minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.accent }}>
            Rather type it in? Add classes manually
          </Text>
        </Pressable>
      </ScrollView>
    </GradientBackground>
  );
}
