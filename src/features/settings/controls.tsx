import { Host, Switch, FieldGroup, ListItem } from "@expo/ui";
import { useFocusEffect } from "expo-router";
import {
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { z } from "zod";
import { haptic, useTheme, useToast } from "@/ui";
import { readPreference, savePreference } from "./preferences";
import { subscribeTimetable } from "@/features/timetable/hooks";
export function useSettingsRefresh() {
  const [revision, update] = useState(0);
  const reload = useCallback(() => update((n) => n + 1), []);
  useFocusEffect(reload);
  useEffect(() => subscribeTimetable(reload), [reload]);
  return { revision, reload };
}
export function useSetting<T>(key: string, schema: z.ZodType<T>, fallback: T) {
  const { reload } = useSettingsRefresh();
  const toast = useToast();
  const value = readPreference(key, schema, fallback);
  const set = (next: T) => {
    try {
      const result = savePreference(key, schema.parse(next));
      reload();
      void haptic("selection");
      toast({ message: "Preference saved", undo: result.undo });
    } catch (e) {
      toast({
        message: e instanceof Error ? e.message : "Could not save preference.",
      });
      void haptic("error");
    }
  };
  return [value, set] as const;
}
export function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors, scheme } = useTheme();
  return (
    <Host matchContents colorScheme={scheme} seedColor={colors.accent}>
      <Switch
        label={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      />
    </Host>
  );
}
export function SettingsGroup({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return <FieldGroup.Section title={title}>{children}</FieldGroup.Section>;
}
export function SettingsRow({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <ListItem onPress={onPress} supportingText={detail} trailing="›">
      {title}
    </ListItem>
  );
}
