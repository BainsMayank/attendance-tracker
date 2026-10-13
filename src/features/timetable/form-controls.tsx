import { Host, Picker } from "@expo/ui";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { router, useNavigation } from "expo-router";
import { Stack } from "expo-router/stack";
import { usePreventRemove } from "expo-router/react-navigation";
import { useRef, useState, type PropsWithChildren } from "react";
import { Alert, TextInput, View, type TextInputProps } from "react-native";
import { Button, HeaderActions, Text, haptic, icons, useTheme, useToast } from "@/ui";
import type { ButtonProps } from "@/ui/button";
import { Screen } from "@/features/shell/screen";
import { errorMessage, invalidateTimetable } from "./hooks";
import { formatTime } from "@/lib/timetable";

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="secondary">{label}</Text>
      <TextInput
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          {
            minHeight: 48,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.controlBorder,
            backgroundColor: colors.surface,
            color: colors.textPrimary,
            fontSize: 17,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  const { scheme, colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="secondary">{label}</Text>
      <Host
        matchContents
        colorScheme={scheme}
        seedColor={colors.accent}
        style={{ minHeight: 48 }}
      >
        <Picker
          selectedValue={value}
          onValueChange={onChange}
          enabled={options.length > 0}
          testID={label}
        >
          {options.map((o) => (
            <Picker.Item key={o.value} {...o} />
          ))}
        </Picker>
      </Host>
    </View>
  );
}
export function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { colors, scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const date = new Date(2026, 0, 1, Math.floor(value / 60), value % 60);
  return (
    <View style={{ gap: 8 }}>
      <Text variant="secondary">{label}</Text>
      <Button
        label={formatTime(value)}
        accessibilityLabel={`${label}, ${formatTime(value)}`}
        variant="secondary"
        onPress={() => setOpen(!open)}
      />
      {open && (
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour
          display={process.env.EXPO_OS === "ios" ? "spinner" : "default"}
          themeVariant={scheme}
          accentColor={colors.accent}
          onDismiss={() => setOpen(false)}
          onValueChange={(_, d) => {
            onChange(d.getHours() * 60 + d.getMinutes());
            if (process.env.EXPO_OS !== "ios") setOpen(false);
          }}
        />
      )}
      {open && process.env.EXPO_OS === "ios" && (
        <Button
          label="Done choosing time"
          variant="secondary"
          onPress={() => setOpen(false)}
        />
      )}
    </View>
  );
}
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const parts = value.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12);
  return (
    <View style={{ gap: 8 }}>
      <Text variant="secondary">{label}</Text>
      <Button
        label={value}
        variant="secondary"
        onPress={() => setOpen(!open)}
      />
      {open && (
        <DateTimePicker
          value={date}
          mode="date"
          themeVariant={scheme}
          display={process.env.EXPO_OS === "ios" ? "inline" : "default"}
          onDismiss={() => setOpen(false)}
          onValueChange={(_, d) => {
            onChange(
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
            );
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}
export function ErrorText({ message }: { message: string }) {
  const { colors } = useTheme();
  return message ? (
    <Text
      selectable
      accessibilityLiveRegion="assertive"
      style={{ color: colors.absent }}
    >
      {message}
    </Text>
  ) : null;
}
export function Editor({
  title,
  dirty,
  busy,
  primaryAction,
  children,
}: PropsWithChildren<{
  title: string;
  dirty: boolean;
  busy: boolean;
  primaryAction?: Pick<ButtonProps, "label" | "disabled" | "loading"> & {
    onPress: () => void;
  };
}>) {
  const navigation = useNavigation();
  usePreventRemove(dirty || busy, ({ data }) => {
    if (busy) return;
    Alert.alert("Discard changes?", "Your unsaved changes will be lost.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });
  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLargeTitleEnabled: false,
          gestureEnabled: !dirty && !busy,
          headerBackVisible: false,
          ...(process.env.EXPO_OS === "web"
            ? {
                headerLeft: () => (
                  <Button
                    label="Cancel"
                    variant="secondary"
                    disabled={busy}
                    onPress={() => router.back()}
                  />
                ),
                headerRight: primaryAction
                  ? () => <Button {...primaryAction} label="Save" />
                  : undefined,
              }
            : {}),
        }}
      />
      {process.env.EXPO_OS !== "web" && (
        <HeaderActions
          left={[
            {
              label: "Cancel",
              // Material full-screen dialogs close with an X.
              icon: process.env.EXPO_OS === "android" ? icons.xmark : undefined,
              disabled: busy,
              onPress: () => router.back(),
            },
          ]}
          right={
            primaryAction
              ? [
                  {
                    label: primaryAction.loading ? "Saving…" : "Save",
                    prominent: true,
                    disabled:
                      busy || primaryAction.disabled || primaryAction.loading,
                    onPress: primaryAction.onPress,
                  },
                ]
              : undefined
          }
        />
      )}
      <Screen>{children}</Screen>
    </>
  );
}
export function useSave() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const lock = useRef(false),
    toast = useToast();
  const save = async (
    operation: () => { undo?: () => void } | Promise<{ undo?: () => void }>,
    message: string,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    try {
      const result = await operation();
      invalidateTimetable();
      setDone(true);
      setBusy(false);
      void haptic("success");
      toast({
        message,
        undo: result.undo
          ? () => {
              result.undo!();
              invalidateTimetable();
            }
          : undefined,
      });
      requestAnimationFrame(() => router.back());
    } catch (e) {
      setError(errorMessage(e));
      void haptic("error");
      setBusy(false);
    } finally {
      lock.current = false;
    }
  };
  return { busy, error, setError, done, save };
}

/** Grouped-form row: fixed label on the left, control on the right. */
export function FormRow({
  label,
  children,
  stacked = false,
}: PropsWithChildren<{ label: string; stacked?: boolean }>) {
  return (
    <View
      style={{
        flexDirection: stacked ? "column" : "row",
        alignItems: stacked ? "stretch" : "center",
        gap: stacked ? 10 : 12,
        minHeight: 52,
        paddingVertical: stacked ? 14 : 6,
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ width: stacked ? undefined : 96, fontSize: 16, fontWeight: "500" }}>
        {label}
      </Text>
      {stacked ? children : <View style={{ flex: 1, alignItems: "flex-end" }}>{children}</View>}
    </View>
  );
}
export function InputRow({
  label,
  ...props
}: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <FormRow label={label}>
      <TextInput
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        style={{
          alignSelf: "stretch",
          minHeight: 40,
          fontSize: 16,
          textAlign: "right",
          color: colors.textPrimary,
        }}
      />
    </FormRow>
  );
}
export function PickerRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  const { scheme, colors } = useTheme();
  return (
    <FormRow label={label}>
      <Host matchContents colorScheme={scheme} seedColor={colors.accent} style={{ minHeight: 40 }}>
        <Picker
          selectedValue={value}
          onValueChange={onChange}
          enabled={options.length > 0}
          testID={label}
        >
          {options.map((o) => (
            <Picker.Item key={o.value} {...o} />
          ))}
        </Picker>
      </Host>
    </FormRow>
  );
}
/** Compact native time picker on iOS; a value button opening the system dialog elsewhere. */
export function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { colors, scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const date = new Date(2026, 0, 1, Math.floor(value / 60) % 24, value % 60);
  const pick = (d: Date) => onChange(d.getHours() * 60 + d.getMinutes());
  return (
    <FormRow label={label}>
      {process.env.EXPO_OS === "ios" ? (
        <DateTimePicker
          value={date}
          mode="time"
          display="compact"
          style={{ width: 92 }}
          themeVariant={scheme}
          accentColor={colors.accent}
          locale="en_GB"
          onValueChange={(_, d) => pick(d)}
        />
      ) : (
        <>
          <Button
            label={formatTime(value)}
            accessibilityLabel={`${label}, ${formatTime(value)}`}
            variant="secondary"
            onPress={() => setOpen(true)}
          />
          {open && (
            <DateTimePicker
              value={date}
              mode="time"
              is24Hour
              onDismiss={() => setOpen(false)}
              onValueChange={(_, d) => {
                setOpen(false);
                pick(d);
              }}
            />
          )}
        </>
      )}
    </FormRow>
  );
}
