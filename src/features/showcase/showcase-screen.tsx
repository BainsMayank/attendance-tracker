import { useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { Screen } from "@/features/shell/screen";
import {
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  GlassCard,
  IconButton,
  ProgressRing,
  SegmentedControl,
  Skeleton,
  Text,
  ThemeProvider,
  ToastProvider,
  haptic,
  useTheme,
  useToast,
} from "@/ui";

function Preview({
  mode,
  setMode,
}: {
  mode: "light" | "dark";
  setMode: (mode: "light" | "dark") => void;
}) {
  const { colors, reduceMotion, reduceTransparency } = useTheme();
  const toast = useToast();
  const [selected, setSelected] = useState("All"),
    [progress, setProgress] = useState<number | null>(0.75),
    [open, setOpen] = useState(false),
    [count, setCount] = useState(0);
  const changeFilter = (value: string) => {
    const old = selected;
    setSelected(value);
    void haptic("selection");
    toast({ message: `${value} selected`, undo: () => setSelected(old) });
  };
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack.Screen
        options={{
          title: "Design showcase",
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: colors.textPrimary,
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Screen>
        <Text secondary>Native components, quiet feedback, one accent.</Text>
        <SegmentedControl
          values={["light", "dark"]}
          value={mode}
          onChange={setMode}
        />
        <Text variant="caption" secondary>
          {reduceMotion ? "Reduced motion" : "Standard motion"} ·{" "}
          {reduceTransparency ? "Opaque surfaces" : "Adaptive surfaces"}
        </Text>
        <View style={{ gap: 12 }}>
          <Text variant="heading">Typography & color</Text>
          <Text
            variant="statistic"
            selectable
            style={{ fontVariant: ["tabular-nums"] }}
          >
            75.0%
          </Text>
          <Text variant="title">A clear view of your semester</Text>
          <Text>Body text stays comfortably readable.</Text>
          <Text variant="secondary" secondary>
            Secondary text supports the main task.
          </Text>
          <Text variant="caption" secondary>
            Caption · supplementary information
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(
              ["accent", "present", "warning", "absent", "neutral"] as const
            ).map((key) => (
              <View
                key={key}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors[`${key}Subtle`],
                  minWidth: 88,
                }}
              >
                <Text variant="caption" style={{ color: colors[key] }}>
                  {key}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <Text variant="heading">Surfaces</Text>
          <GlassCard>
            <Text variant="title">Adaptive glass</Text>
            <Text secondary>
              Native glass when available, blur otherwise. Accessibility
              preferences select a solid surface.
            </Text>
          </GlassCard>
          <GlassCard solid>
            <Text variant="title">Solid content surface</Text>
            <Text secondary>
              Reading, forms, and data stay on opaque surfaces.
            </Text>
          </GlassCard>
        </View>
        <View style={{ gap: 12 }}>
          <Text variant="heading">Attendance ring</Text>
          <View style={{ alignItems: "center" }}>
            <ProgressRing progress={progress} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[null, 0, 0.75, 1].map((value) => (
              <Chip
                key={String(value)}
                label={value === null ? "No data" : `${value * 100}%`}
                selected={value === progress}
                onPress={() => setProgress(value)}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <Text variant="heading">Actions</Text>
          <Button
            label={`Add a sample · ${count}`}
            onPress={() => {
              const prior = count;
              setCount(count + 1);
              void haptic();
              toast({ message: "Sample added", undo: () => setCount(prior) });
            }}
          />
          <Button
            label="Open bottom sheet"
            variant="secondary"
            onPress={() => setOpen(true)}
          />
          <Button
            label="Destructive action"
            variant="destructive"
            onPress={() => {
              const prior = count;
              setCount(0);
              void haptic("medium");
              toast({
                message: "Samples cleared",
                undo: () => setCount(prior),
              });
            }}
          />
          <Button label="Disabled action" disabled />
          <Button label="Saving" loading />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <IconButton
              label="Add sample"
              name={{ ios: "plus", android: "add", web: "add" }}
              onPress={() => {
                const prior = count;
                setCount(count + 1);
                void haptic();
                toast({ message: "Sample added", undo: () => setCount(prior) });
              }}
            />
            <IconButton
              label="Unavailable sample action"
              name={{ ios: "plus", android: "add", web: "add" }}
              onPress={() => {}}
              disabled
            />
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <Text variant="heading">Selection</Text>
          <SegmentedControl
            values={["All", "Present", "Absent"]}
            value={selected}
            onChange={changeFilter}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {["All", "Present", "Absent"].map((label) => (
              <Chip
                key={label}
                label={label}
                selected={selected === label}
                onPress={() => changeFilter(label)}
              />
            ))}
            <Chip label="Disabled" disabled />
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <Text variant="heading">Loading & empty</Text>
          <Skeleton height={24} width="65%" />
          <Skeleton />
          <Skeleton width="85%" />
          <EmptyState
            title="No subjects yet"
            message="Create your first subject when the subject workflow is ready."
            action={{
              label: "Reset preview",
              onPress: () => {
                const prior = count;
                setCount(0);
                void haptic();
                toast({
                  message: "Preview reset",
                  undo: () => setCount(prior),
                });
              },
            }}
          />
        </View>
        <View style={{ gap: 12 }}>
          <Text variant="heading">Haptics</Text>
          <Text secondary>
            Optional hardware feedback always accompanies a visible message.
          </Text>
          <View style={{ gap: 8 }}>
            {(
              ["selection", "light", "medium", "success", "error"] as const
            ).map((kind) => (
              <Button
                key={kind}
                label={`${kind} feedback`}
                variant="secondary"
                onPress={() => {
                  void haptic(kind);
                  toast({ message: `${kind} feedback requested` });
                }}
              />
            ))}
          </View>
        </View>
      </Screen>
      <BottomSheet
        open={open}
        onDismiss={() => setOpen(false)}
        title="A little more room"
      >
        <Text>
          Native sheet chrome, a clear close action, and scrollable content for
          larger text.
        </Text>
        <Button
          label="Add a sample"
          onPress={() => {
            const prior = count;
            setCount(count + 1);
            setOpen(false);
            void haptic();
            toast({
              message: "Sample added from sheet",
              undo: () => setCount(prior),
            });
          }}
        />
      </BottomSheet>
    </>
  );
}
export function ShowcaseScreen() {
  const [mode, setMode] = useState<"light" | "dark">("light");
  return (
    <ThemeProvider forcedScheme={mode}>
      <ToastProvider>
        <Preview mode={mode} setMode={setMode} />
      </ToastProvider>
    </ThemeProvider>
  );
}
