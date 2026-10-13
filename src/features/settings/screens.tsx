import { useState, useEffect, useRef } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Link } from "expo-router";
import { Stack } from "expo-router/stack";
import Constants from "expo-constants";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import * as s from "@/db/schema";
import { Screen } from "@/features/shell/screen";
import {
  Field,
  Choice,
  ErrorText,
  TimeRow,
} from "@/features/timetable/form-controls";
import { formatTime } from "@/lib/timetable";
import {
  ActionButton,
  FilterChip,
  GradientBackground,
  Group,
  Icon,
  ListRow,
  Pill,
  SwitchRow,
  icons,
  Button,
  GlassCard,
  Text,
  SegmentedControl,
  usePreferences,
  useTheme,
  useToast,
  haptic,
} from "@/ui";
import { invalidateTimetable } from "@/features/timetable/hooks";
import {
  accents,
  accentSchema,
  backupPreferencesSchema,
  backupStateSchema,
  defaultReminders,
  reminderSchema,
  notificationStateSchema,
  defaultNotificationState,
} from "./model";
import { readPreference } from "./preferences";
import { Toggle, useSetting, useSettingsRefresh } from "./controls";
import {
  requestNotificationPermission,
  reconcileNotifications,
  testNotification,
} from "./notifications";
import {
  exportAppBackup,
  pickAppBackup,
  restoreAppBackup,
  localBackups,
  shareBackupFile,
  previewBackupFile,
  safetyBackup,
  type RestorePreview,
} from "./backup";
import { exportAttendance } from "./export";
import { changeAppLock, authenticate } from "./app-lock";
import licenses from "./licenses.json";

function useOperation() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const run = async <T,>(operation: () => Promise<T>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      return await operation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish. Try again.");
      void haptic("error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { busy, error, run };
}
export function NotificationsScreen() {
  const [rules, setRules] = useSetting(
    "reminderRules",
    reminderSchema,
    defaultReminders,
  );
  const { reload } = useSettingsRefresh();
  const op = useOperation();
  const { colors } = useTheme();
  const state = readPreference(
    "notificationState",
    notificationStateSchema,
    defaultNotificationState,
  );
  useEffect(() => {
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [reload]);
  const allowed = state.permission === "Allowed";
  const denied = state.permission.startsWith("Denied");
  const leads = [5, 10, 15, 30];
  const leadOptions = leads.includes(rules.leadMinutes)
    ? leads
    : [...leads, rules.leadMinutes].sort((x, y) => x - y);
  return (
    <PageScreen title="Notifications">
      <Group>
        <ListRow
          title="Allow notifications"
          subtitle={
            allowed
              ? "Allowed · everything below can reach you"
              : denied
                ? "Turned off in system settings"
                : "Everything below needs this on"
          }
          accessory={
            allowed ? (
              <Pill label="On" tone="ok" />
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={op.busy || process.env.EXPO_OS === "web"}
                onPress={() =>
                  void op.run(async () => {
                    if (denied) await Linking.openSettings();
                    else await requestNotificationPermission();
                    reload();
                  })
                }
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ color: colors.accent, fontWeight: "600" }}>
                  {denied ? "Open Settings" : "Allow"}
                </Text>
              </Pressable>
            )
          }
        />
      </Group>
      <View style={{ opacity: allowed ? 1 : 0.55 }}>
        <Group>
          <SwitchRow
            title="Class reminders"
            subtitle="Before each class, with the room"
            value={rules.classes}
            onChange={(classes) => setRules({ ...rules, classes })}
          >
            {rules.classes && (
              <>
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Remind me before"
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {leadOptions.map((m) => (
                    <FilterChip
                      key={m}
                      variant="choice"
                      label={m ? `${m} min` : "At start"}
                      selected={rules.leadMinutes === m}
                      onPress={() => setRules({ ...rules, leadMinutes: m })}
                    />
                  ))}
                </View>
                <View
                  accessibilityLabel="Preview of a class reminder"
                  style={{
                    borderRadius: 22,
                    padding: 12,
                    gap: 10,
                    backgroundColor: colors.surfaceRaised,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 9,
                        backgroundColor: colors.accent,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name={icons.calendarCheck} size={18} color={colors.onAccent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 15, fontWeight: "600" }}>
                          Physics in {rules.leadMinutes || 0} min
                        </Text>
                        <Text variant="caption" secondary>
                          now
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, lineHeight: 19 }}>
                        10:30–11:30 · A101. Hold to mark it from here.
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[
                      ["Present", colors.present],
                      ["Absent", colors.absent],
                    ].map(([label, ink]) => (
                      <View
                        key={label}
                        style={{
                          flex: 1,
                          height: 40,
                          borderRadius: 10,
                          backgroundColor: colors.surface,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: "600", color: ink }}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Link href="/settings-mutes" asChild>
                  <Pressable accessibilityRole="button" style={{ minHeight: 36, justifyContent: "center" }}>
                    <Text style={{ color: colors.accent, fontWeight: "600" }}>
                      Muted subjects ({rules.mutedSubjects.length})
                    </Text>
                  </Pressable>
                </Link>
              </>
            )}
          </SwitchRow>
          <SwitchRow
            title="Low attendance alerts"
            subtitle="Once when a subject drops below its target"
            value={rules.lowAttendance}
            onChange={(lowAttendance) => setRules({ ...rules, lowAttendance })}
          />
          <SwitchRow
            title="Daily log reminder"
            subtitle={`${formatTime(rules.dailyMinute)} · only if today has unmarked classes`}
            value={rules.daily}
            onChange={(daily) => setRules({ ...rules, daily })}
          >
            {rules.daily && (
              <View style={{ marginHorizontal: -16 }}>
                <TimeRow
                  label="Remind at"
                  value={rules.dailyMinute}
                  onChange={(dailyMinute) => setRules({ ...rules, dailyMinute })}
                />
              </View>
            )}
          </SwitchRow>
          <SwitchRow
            title="Exams & deadlines"
            subtitle="1 day and 1 hour before"
            value={rules.deadlines}
            onChange={(deadlines) => setRules({ ...rules, deadlines })}
          />
        </Group>
      </View>
      <Text variant="caption" secondary style={{ paddingHorizontal: 8 }}>
        Notifications are scheduled on this phone from your timetable. No
        server is involved. {state.scheduled} scheduled for the next 7 days
        {state.overflow ? ` · ${state.overflow} beyond the 64-reminder limit` : ""}.
        {process.env.EXPO_OS === "android"
          ? " For on-time delivery, allow Alarms & reminders in system settings."
          : ""}
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <ActionButton
          label="Refresh"
          variant="tonal"
          style={{ flex: 1 }}
          loading={op.busy}
          onPress={() =>
            void op.run(async () => {
              await reconcileNotifications();
              reload();
            })
          }
        />
        <ActionButton
          label="Send test"
          variant="tonal"
          style={{ flex: 1 }}
          disabled={op.busy || !allowed || process.env.EXPO_OS === "web"}
          onPress={() => void op.run(testNotification)}
        />
      </View>
      <ErrorText message={op.error || state.error} />
    </PageScreen>
  );
}
/** Pushed settings page with the large in-content title used by the designs. */
export function PageScreen({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Stack.Screen options={{ title: "", headerLargeTitleEnabled: false }} />
      <GradientBackground>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 48,
            gap: 16,
            width: "100%",
            maxWidth: 680,
            alignSelf: "center",
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              marginHorizontal: 4,
              fontSize: 30,
              lineHeight: 36,
              fontWeight: "600",
              letterSpacing: -0.3,
            }}
          >
            {title}
          </Text>
          {children}
        </ScrollView>
      </GradientBackground>
    </>
  );
}
export function MutedSubjectsScreen() {
  const [rules, setRules] = useSetting(
    "reminderRules",
    reminderSchema,
    defaultReminders,
  );
  const { colors } = useTheme();
  const semesters = new Map(
    getDatabase()
      .select()
      .from(s.semesters)
      .all()
      .filter((sem) => sem.archivedAt === null)
      .map((sem) => [sem.id, sem.name]),
  );
  const subjects = getDatabase()
    .select()
    .from(s.subjects)
    .all()
    .filter((r) => r.archivedAt === null && semesters.has(r.semesterId))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return (
    <FlatList
      data={subjects}
      keyExtractor={(r) => r.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
      style={{ backgroundColor: colors.background }}
      ListHeaderComponent={
        <Text secondary>
          Mute class reminders independently. Attendance nudges and deadline
          reminders stay controlled by their own settings.
        </Text>
      }
      ListEmptyComponent={
        <Text secondary>
          No active subjects. Add a subject to configure muting.
        </Text>
      }
      renderItem={({ item }) => (
        <GlassCard solid>
          <Toggle
            label={item.name}
            value={rules.mutedSubjects.includes(item.id)}
            onChange={(muted) =>
              setRules({
                ...rules,
                mutedSubjects: muted
                  ? [...rules.mutedSubjects, item.id]
                  : rules.mutedSubjects.filter((id) => id !== item.id),
              })
            }
          />
          <Text secondary>
            {semesters.get(item.semesterId)}
            {item.code ? ` · ${item.code}` : ""}. Switch on to mute.
          </Text>
        </GlassCard>
      )}
    />
  );
}
export function AppearanceScreen() {
  const prefs = usePreferences();
  const [theme, setTheme] = useSetting(
    "theme",
    z.enum(["system", "light", "dark"]),
    "system",
  );
  const [accent, setAccent] = useSetting("accent", accentSchema, "indigo");
  const [transparency, setTransparency] = useSetting(
    "reduceTransparency",
    z.boolean(),
    false,
  );
  const [, setEffects] = useSetting("reduceEffects", z.boolean(), false);
  const [, setHaptics] = useSetting("hapticsEnabled", z.boolean(), true);
  const { colors, reduceMotion, reduceTransparency } = useTheme();
  return (
    <Screen>
      <GlassCard solid>
        <Text variant="heading">Theme</Text>
        <SegmentedControl
          values={["system", "light", "dark"]}
          value={theme}
          onChange={(v) => setTheme(v as typeof theme)}
        />
      </GlassCard>
      <GlassCard solid>
        <Text variant="heading">Accent color</Text>
        <View style={{ gap: 12 }}>
          {Object.entries(accents).map(([key, value]) => (
            <Pressable
              key={key}
              onPress={() => setAccent(key as typeof accent)}
              accessibilityRole="radio"
              accessibilityState={{ checked: accent === key }}
              accessibilityLabel={`${value.name} accent`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                minHeight: 48,
                padding: 12,
                borderWidth: accent === key ? 2 : 1,
                borderColor: accent === key ? colors.accent : colors.separator,
                borderRadius: 12,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: value.light,
                }}
              />
              <Text>
                {value.name}
                {accent === key ? " · Selected" : ""}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          label="Accent preview"
          onPress={() => void haptic("selection")}
        />
      </GlassCard>
      <GlassCard solid>
        <Text variant="heading">Comfort</Text>
        <Toggle
          label="Reduce transparency"
          value={transparency}
          onChange={setTransparency}
        />
        <Toggle
          label="Reduce effects and motion"
          value={prefs.reduceEffects}
          onChange={setEffects}
        />
        <Toggle
          label="Haptic feedback"
          value={prefs.hapticsEnabled}
          onChange={setHaptics}
        />
        <Text secondary>
          System accessibility preferences are always respected.
        </Text>
        <Text selectable secondary>
          Motion: {reduceMotion ? "reduced" : "standard"} · Surfaces:{" "}
          {reduceTransparency ? "opaque" : "adaptive"}
        </Text>
      </GlassCard>
    </Screen>
  );
}
export function BackupScreen() {
  const [prefs, setPrefs] = useSetting(
    "backupPreferences",
    backupPreferencesSchema,
    { weekly: true, includeFiles: true },
  );
  const { reload } = useSettingsRefresh();
  const state = readPreference("backupState", backupStateSchema, {
    lastSuccess: 0,
    error: "",
  });
  const [includeFiles, setIncludeFiles] = useState(false);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [message, setMessage] = useState("");
  const op = useOperation();
  const backups = localBackups();
  const safety = safetyBackup();
  const confirmRestore = () => {
    if (!preview) return;
    Alert.alert(
      "Replace your workspace?",
      `This replaces all current semesters and academic data with ${preview.summary.semesters} backed-up semesters and ${preview.summary.records} attendance records. A safety copy of the current workspace is kept locally. Your app lock stays enabled if it is enabled now.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replace & restore",
          style: "destructive",
          onPress: () =>
            void op.run(async () => {
              await restoreAppBackup(preview);
              setPreview(null);
              setMessage(
                "Backup restored. Your previous workspace is available as a safety copy below.",
              );
              invalidateTimetable();
              reload();
              void haptic("success");
            }),
        },
      ],
    );
  };
  return (
    <Screen>
      <Stack.Screen
        options={{ gestureEnabled: !op.busy, headerBackVisible: !op.busy }}
      />
      <GlassCard solid>
        <Text variant="heading">Export a backup</Text>
        <Text secondary>
          Includes all semesters, saved attendance and study content, plus
          portable preferences.
        </Text>
        <Toggle
          label="Include attached files as ZIP"
          value={includeFiles}
          disabled={op.busy}
          onChange={setIncludeFiles}
        />
        <Text secondary>
          JSON excludes attachment bytes. ZIP includes available files and
          verifies checksums. Backups are not encrypted; save them somewhere you
          trust.
        </Text>
        <Button
          label={includeFiles ? "Share ZIP backup" : "Share JSON backup"}
          loading={op.busy}
          onPress={() =>
            void op.run(async () => {
              await exportAppBackup(includeFiles);
              setMessage(
                "Backup created. Use the share sheet to save it to Files, iCloud Drive or a connected Drive app.",
              );
            })
          }
        />
      </GlassCard>
      <GlassCard solid>
        <Text variant="heading">Weekly local backups</Text>
        <Toggle
          label="Automatic weekly backup"
          value={prefs.weekly}
          disabled={op.busy}
          onChange={(weekly) => setPrefs({ ...prefs, weekly })}
        />
        <Toggle
          label="Include files in weekly backups"
          value={prefs.includeFiles}
          disabled={op.busy}
          onChange={(includeFiles) => setPrefs({ ...prefs, includeFiles })}
        />
        <Text selectable secondary>
          {state.lastSuccess
            ? `Last successful backup: ${new Date(state.lastSuccess).toLocaleString()}`
            : "No successful weekly backup yet."}
        </Text>
        <Text secondary>
          The latest four successful weekly copies stay on this phone.
          Background timing is best effort; opening the app creates an overdue
          backup. Uninstalling removes local copies, so save an external copy
          too.
        </Text>
        <ErrorText message={state.error} />
        {backups.map((file) => (
          <View key={file.uri} style={{ gap: 8 }}>
            <Text selectable secondary>
              {file.name}
            </Text>
            <Button
              label="Share this local backup"
              variant="secondary"
              disabled={op.busy}
              onPress={() => void op.run(() => shareBackupFile(file))}
            />
            <Button
              label="Preview this local backup"
              variant="secondary"
              disabled={op.busy}
              onPress={() =>
                void op.run(async () => {
                  setPreview(await previewBackupFile(file));
                })
              }
            />
          </View>
        ))}
      </GlassCard>
      <GlassCard solid>
        <Text variant="heading">Restore</Text>
        <Button
          label="Choose JSON or ZIP backup"
          loading={op.busy}
          onPress={() =>
            void op.run(async () => {
              const next = await pickAppBackup();
              if (next) setPreview(next);
            })
          }
        />
        {safety && (
          <Button
            label="Preview previous workspace safety copy"
            variant="secondary"
            disabled={op.busy}
            onPress={() =>
              void op.run(async () => {
                setPreview(await previewBackupFile(safety));
              })
            }
          />
        )}
        {preview && (
          <View style={{ gap: 16 }}>
            <Text variant="title">Ready to review</Text>
            <Text selectable>
              {new Date(preview.backup.createdAt).toLocaleString()} · Format{" "}
              {preview.backup.version}
            </Text>
            <Text selectable>
              {preview.summary.semesters} semesters · {preview.summary.subjects}{" "}
              subjects · {preview.summary.records} records ·{" "}
              {preview.summary.files} files
            </Text>
            <Text secondary>
              {preview.backup.attachments === "omitted"
                ? "Attachment bytes are omitted. Restored file entries will be marked missing and can be reimported."
                : `Available attachment sizes and checksums verified. ${preview.summary.missingFiles} file entries have no bytes and stay marked missing.`}
            </Text>
            <Text secondary>
              Replaces all current academic data. Saved timers resume paused.
              App lock and device-specific permissions are not imported.
            </Text>
            <Button
              label="Restore this backup"
              variant="destructive"
              disabled={op.busy}
              onPress={confirmRestore}
            />
            <Button
              label="Cancel preview"
              variant="secondary"
              disabled={op.busy}
              onPress={() => setPreview(null)}
            />
          </View>
        )}
      </GlassCard>
      {message ? (
        <Text selectable accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      <ErrorText message={op.error} />
    </Screen>
  );
}
export function ExportScreen() {
  useSettingsRefresh();
  const semesters = getDatabase().select().from(s.semesters).all();
  const [id, setId] = useState(() => semesters[0]?.id ?? "");
  const selected = semesters.some((r) => r.id === id)
    ? id
    : (semesters[0]?.id ?? "");
  const op = useOperation();
  return (
    <Screen>
      <Text secondary>
        Export the selected semester, including archived subject history.
        Reports use saved records; unmarked classes remain pending.
      </Text>
      <Choice
        label="Semester"
        value={selected}
        onChange={setId}
        options={semesters.map((r) => ({
          value: r.id,
          label: `${r.name}${r.archivedAt !== null ? " · Archived" : ""}`,
        }))}
      />
      {!semesters.length && (
        <Text secondary>Create a semester before exporting attendance.</Text>
      )}
      <GlassCard solid>
        <Text variant="heading">Attendance CSV</Text>
        <Text secondary>
          Every saved occurrence and adjustment, including dates, weights,
          statuses and reasons.
        </Text>
        <Button
          label="Share attendance CSV"
          disabled={!selected}
          loading={op.busy}
          onPress={() => void op.run(() => exportAttendance(selected, "csv"))}
        />
      </GlassCard>
      <GlassCard solid>
        <Text variant="heading">PDF report</Text>
        <Text secondary>
          Overall and subject attendance, targets and monthly logging in a clean
          printable report.
        </Text>
        <Button
          label="Share PDF report"
          disabled={!selected}
          loading={op.busy}
          onPress={() => void op.run(() => exportAttendance(selected, "pdf"))}
        />
      </GlassCard>
      <ErrorText message={op.error} />
    </Screen>
  );
}
export function PrivacyScreen() {
  useSettingsRefresh();
  const enabled = readPreference("appLock", z.boolean(), false);
  const op = useOperation(),
    toast = useToast();
  return (
    <Screen>
      <GlassCard solid>
        <Text variant="heading">App lock</Text>
        <Toggle
          label="Require Face ID or fingerprint"
          value={enabled}
          disabled={op.busy || process.env.EXPO_OS === "web"}
          onChange={(next) =>
            void op.run(async () => {
              const result = await changeAppLock(next);
              toast({
                message: next ? "App lock enabled" : "App lock disabled",
                undo: async () => {
                  if (!(await authenticate()))
                    throw new Error(
                      "Authenticate to undo the app lock preference.",
                    );
                  result.undo();
                },
              });
              void haptic("success");
            })
          }
        />
        <Text secondary>
          Authenticate on launch and after one minute in the background. Your
          device passcode can be used when the phone offers it. Cancelling keeps
          the workspace locked.
        </Text>
        <Text secondary>
          Face ID requires a development build for testing; Expo Go cannot test
          Face ID. Fingerprint and Touch ID support depends on your device.
        </Text>
      </GlassCard>
      <GlassCard solid>
        <Text variant="heading">Your data stays on your phone</Text>
        <Text secondary>
          No account, analytics, ads, uploads or cloud sync. Attendance, notes
          and files are stored locally.
        </Text>
        <Text secondary>
          Exporting or sharing sends only the file you choose to the destination
          you select. External links and the optional external timetable AI
          workflow use the service you open.
        </Text>
        <Text secondary>
          App lock controls access to the interface. SQLite and exported
          JSON/ZIP files are not encrypted by app lock.
        </Text>
      </GlassCard>
      <ErrorText message={op.error} />
    </Screen>
  );
}
export function AboutScreen() {
  const [saved, setSaved] = useSetting(
    "feedbackEmail",
    z.union([z.literal(""), z.email().max(254)]),
    "",
  );
  const [email, setEmail] = useState(saved);
  const op = useOperation();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const build =
    process.env.EXPO_OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode;
  return (
    <Screen>
      <GlassCard solid>
        <Text variant="heading">Attendance Tracker</Text>
        <Text selectable>
          Version {version}
          {build ? ` (${build})` : ""}
          {__DEV__ ? " · Development" : ""}
        </Text>
        <Text secondary>Your data stays on your phone.</Text>
      </GlassCard>
      <GlassCard solid>
        <Text variant="heading">Feedback</Text>
        <Field
          label="Feedback email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <Button
          label="Save feedback address"
          variant="secondary"
          onPress={() => setSaved(email.trim())}
        />
        <Button
          label="Write feedback email"
          disabled={!saved}
          onPress={() =>
            void op.run(() =>
              Linking.openURL(
                `mailto:${saved}?subject=${encodeURIComponent(`Attendance Tracker ${version} feedback`)}`,
              ),
            )
          }
        />
        <Text secondary>
          {saved
            ? `Opens your mail app addressed to ${saved}. You review and send it yourself.`
            : "No feedback address has been configured yet."}
        </Text>
      </GlassCard>
      <Link href="/settings-licenses" asChild>
        <Button label="Open-source licenses" variant="secondary" />
      </Link>
      <ErrorText message={op.error} />
    </Screen>
  );
}
export function LicensesScreen() {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null),
    [search, setSearch] = useState("");
  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={licenses.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase()),
      )}
      keyExtractor={(r) => `${r.name}@${r.version}`}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Text secondary>
            License notices from installed production dependencies. Tap a
            package to read its bundled terms.
          </Text>
          <Field
            label="Find a package"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      }
      ListEmptyComponent={<Text secondary>No matching packages.</Text>}
      renderItem={({ item }) => {
        const key = `${item.name}@${item.version}`;
        return (
          <GlassCard solid>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: expanded === key }}
              onPress={() => setExpanded(expanded === key ? null : key)}
              style={{ minHeight: 48, gap: 4 }}
            >
              <Text variant="title">{item.name}</Text>
              <Text secondary>
                {item.version} · {item.license}
              </Text>
            </Pressable>
            {expanded === key && (
              <Text selectable variant="caption">
                {item.text}
              </Text>
            )}
          </GlassCard>
        );
      }}
    />
  );
}
