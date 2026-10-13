import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import Constants from "expo-constants";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  Card,
  GradientBackground,
  Group,
  GroupLabel,
  ListRow,
  SegmentedControl,
  SwitchRow,
  Text,
  contentStyle,
  haptic,
  icons,
  toneColors,
  usePreferences,
  useTheme,
  useToast,
} from "@/ui";
import { getDatabase } from "@/db/client";
import * as s from "@/db/schema";
import { semestersRepository, settingsRepository } from "@/db/repositories";
import { demoCounts, loadDemoData } from "@/db/demo";
import { invalidateTimetable } from "@/features/timetable/hooks";
import {
  backupPreferencesSchema,
  backupStateSchema,
  defaultReminders,
  reminderSchema,
} from "./model";
import { readPreference } from "./preferences";
import { useSetting, useSettingsRefresh } from "./controls";
import { useChromeInsets, useHeaderScrollEdge } from "@/features/shell/chrome";

const themes = ["System", "Light", "Dark"] as const;
function lastBackupLabel(time: number) {
  if (!time) return "Never";
  const date = new Date(time);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const clock = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return sameDay
    ? `Today, ${clock}`
    : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
}

export function SettingsScreen() {
  const toast = useToast();
  const { colors } = useTheme();
  useSettingsRefresh();
  const chrome = useChromeInsets();
  const scrollEdge = useHeaderScrollEdge();
  const prefs = usePreferences();
  const [theme, setTheme] = useSetting(
    "theme",
    z.enum(["system", "light", "dark"]),
    "system",
  );
  const [, setHaptics] = useSetting("hapticsEnabled", z.boolean(), true);
  const [busy, setBusy] = useState(false);
  const [now] = useState(Date.now);
  const [counts, setCounts] = useState(() => (__DEV__ ? demoCounts() : null));
  const rules = readPreference("reminderRules", reminderSchema, defaultReminders);
  const backups = readPreference("backupPreferences", backupPreferencesSchema, {
    weekly: true,
    includeFiles: true,
  });
  const backupState = readPreference("backupState", backupStateSchema, {
    lastSuccess: 0,
    error: "",
  });
  const semesters = semestersRepository.list();
  const activeId = settingsRepository.get("activeSemesterId")?.value;
  const active =
    semesters.find((x) => x.id === activeId && x.archivedAt === null) ??
    semesters.find((x) => x.archivedAt === null);
  const archived = semesters.filter((x) => x.archivedAt !== null).length;
  const holidays = active
    ? getDatabase()
        .select({ id: s.holidays.id })
        .from(s.holidays)
        .where(eq(s.holidays.semesterId, active.id))
        .all().length
    : 0;
  const remindersOn = [
    rules.classes,
    rules.daily,
    rules.lowAttendance,
    rules.deadlines,
  ].filter(Boolean).length;
  const stale =
    !backupState.lastSuccess ||
    now - backupState.lastSuccess > 8 * 86400000 ||
    !!backupState.error;
  const status = toneColors(colors, backupState.error ? "bad" : stale ? "warn" : "ok");
  const version = Constants.expoConfig?.version ?? "1.0";
  const semesterPush = (pathname: "/semester" | "/semester-setup") =>
    active
      ? router.push(
          pathname === "/semester"
            ? "/semester"
            : { pathname, params: { mode: "edit", semesterId: active.id } },
        )
      : router.push({ pathname: "/semester-setup", params: { mode: "new" } });
  return (
    <GradientBackground>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[contentStyle, chrome, { gap: 14 }]}
        onScroll={scrollEdge}
        scrollEventThrottle={16}
      >
        <Card gap={12}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 19, lineHeight: 24, fontWeight: "600" }}>
              {active?.name ?? "No active semester"}
            </Text>
            <Text variant="caption" secondary style={{ fontWeight: "400" }}>
              Stored on this device. No account needed.
            </Text>
          </View>
          <View
            accessible
            accessibilityRole="summary"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingTop: 12,
              borderTopWidth: 0.5,
              borderTopColor: colors.separator,
            }}
          >
            <View
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: status.fg }}
            />
            <Text variant="secondary" secondary style={{ flex: 1 }}>
              {backupState.error
                ? "Last weekly backup failed"
                : backupState.lastSuccess
                  ? `${backups.weekly ? "Weekly backups on" : "Weekly backups off"} · last ${lastBackupLabel(backupState.lastSuccess).toLowerCase()}`
                  : backups.weekly
                    ? "Weekly backups on · none saved yet"
                    : "No backup yet · keep a copy off this phone"}
            </Text>
            <Text
              accessibilityRole="button"
              onPress={() => router.push("/settings-backup")}
              style={{ color: colors.accent, fontSize: 15, fontWeight: "500", paddingVertical: 8 }}
            >
              Back up
            </Text>
          </View>
        </Card>

        <GroupLabel>Semester</GroupLabel>
        <Group inset={56}>
          <ListRow
            icon={icons.calendar}
            title="Current semester"
            value={active?.name ?? "Set up"}
            onPress={() => semesterPush("/semester")}
          />
          <ListRow
            icon={icons.target}
            title="Attendance target"
            value={active ? `${active.targetBps / 100}%` : "—"}
            disabled={!active}
            onPress={() => semesterPush("/semester-setup")}
          />
          <ListRow
            icon={icons.umbrella}
            title="Holidays & breaks"
            value={String(holidays)}
            disabled={!active}
            onPress={() => semesterPush("/semester")}
          />
          <ListRow
            icon={icons.chart}
            title="Attendance history"
            onPress={() => router.push("/semester-history")}
          />
          <ListRow
            icon={icons.archive}
            title="Past semesters"
            value={archived ? `${archived} archived` : "None"}
            onPress={() =>
              router.push({ pathname: "/semester-history", params: { view: "archived" } })
            }
          />
        </Group>

        <GroupLabel>Notifications</GroupLabel>
        <Group inset={56}>
          <ListRow
            icon={icons.bell}
            title="Reminders & alerts"
            value={remindersOn ? `${remindersOn} on` : "Off"}
            onPress={() => router.push("/settings-notifications")}
          />
        </Group>

        <GroupLabel>Your data</GroupLabel>
        <Group inset={56}>
          <ListRow
            icon={icons.backup}
            title="Back up now"
            value={lastBackupLabel(backupState.lastSuccess)}
            onPress={() => router.push("/settings-backup")}
          />
          <ListRow
            icon={icons.export}
            title="Export attendance"
            value="CSV or PDF"
            onPress={() => router.push("/settings-export")}
          />
          <ListRow
            icon={icons.restore}
            title="Restore from backup"
            onPress={() => router.push("/settings-backup")}
          />
        </Group>

        <GroupLabel>Appearance</GroupLabel>
        <Group inset={56}>
          <ListRow
            icon={icons.moon}
            title="Theme"
            accessory={
              <View style={{ width: process.env.EXPO_OS === "android" ? 240 : 190 }}>
                <SegmentedControl
                  values={themes}
                  value={themes[["system", "light", "dark"].indexOf(theme)]}
                  onChange={(v) => setTheme(v.toLowerCase() as typeof theme)}
                />
              </View>
            }
          />
          <SwitchRow
            icon={icons.haptics}
            title="Haptics"
            value={prefs.hapticsEnabled}
            onChange={setHaptics}
          />
          <ListRow
            icon={icons.palette}
            title="Accent & accessibility"
            onPress={() => router.push("/settings-appearance")}
          />
        </Group>

        <GroupLabel>About</GroupLabel>
        <Group inset={56}>
          <ListRow
            icon={icons.hand}
            title="Privacy"
            value="No ads, no tracking"
            onPress={() => router.push("/settings-privacy")}
          />
          <ListRow
            icon={icons.info}
            title="About & feedback"
            value={`Version ${version}`}
            onPress={() => router.push("/settings-about")}
          />
        </Group>

        {active && (
          <Group inset={56} style={{ marginTop: 10 }}>
            <ListRow
              icon={icons.reset}
              iconTone="warn"
              tone="warn"
              title="Reset semester"
              onPress={() =>
                router.push({ pathname: "/semester-reset", params: { semesterId: active.id } })
              }
            />
          </Group>
        )}

        {__DEV__ && (
          <>
            <GroupLabel>Developer tools</GroupLabel>
            <Group inset={56}>
              <ListRow
                icon={icons.palette}
                iconTone="neutral"
                title="Design showcase"
                onPress={() => router.push("/design-showcase")}
              />
              <ListRow
                icon={icons.book}
                iconTone="neutral"
                title={busy ? "Loading demo…" : "Load demo data"}
                subtitle={
                  counts
                    ? `${counts.subjects} subjects · ${counts.slots} weekly slots · ${counts.records} records`
                    : "Add sample data"
                }
                onPress={() => {
                  if (busy) return;
                  setBusy(true);
                  requestAnimationFrame(() => {
                    try {
                      const result = loadDemoData();
                      setCounts(demoCounts());
                      invalidateTimetable();
                      void haptic("success");
                      toast({
                        message: result.alreadyLoaded
                          ? "Demo data is already loaded"
                          : "Demo semester loaded",
                        undo: result.undo
                          ? () => {
                              result.undo!();
                              setCounts(demoCounts());
                              invalidateTimetable();
                            }
                          : undefined,
                      });
                    } catch (e) {
                      toast({
                        message: e instanceof Error ? e.message : "Could not load demo.",
                      });
                    } finally {
                      setBusy(false);
                    }
                  });
                }}
              />
            </Group>
          </>
        )}
        <Text variant="caption" secondary style={{ textAlign: "center", marginTop: 4 }}>
          Attendance Tracker {version} · Your data lives on this device.
        </Text>
      </ScrollView>
    </GradientBackground>
  );
}
