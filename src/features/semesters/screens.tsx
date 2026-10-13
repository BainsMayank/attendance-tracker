import { Host, Switch } from "@expo/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { usePreventRemove } from "expo-router/react-navigation";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { semestersRepository, settingsRepository } from "@/db/repositories";
import {
  semesterRows,
  type SemesterRows,
} from "@/db/repositories/semester-data";
import {
  addSemesterHoliday,
  holidayImpact,
  removeSemesterHoliday,
  saveSemester,
  startNewSemester,
  clearSemesterAttendance,
} from "@/db/repositories/semester-commands";
import { Screen } from "@/features/shell/screen";
import {
  Choice,
  DateField,
  Editor,
  ErrorText,
  Field,
  useSave,
} from "@/features/timetable/form-controls";
import {
  invalidateTimetable,
  subscribeTimetable,
  errorMessage,
} from "@/features/timetable/hooks";
import { attachments } from "@/features/files/service";
import { semesterCleanup } from "./cleanup-service";
import { localToday } from "@/db/validation";
import { addDays } from "@/lib/attendance";
import { targetBasisPoints } from "@/features/onboarding/model";
import { PageScreen } from "@/features/settings/screens";
import {
  ActionButton,
  Card,
  Checkbox,
  Icon,
  RadioCard,
  icons,
  Button,
  EmptyState,
  GlassCard,
  Skeleton,
  Text,
  haptic,
  useTheme,
  useToast,
} from "@/ui";
import {
  exportSemesterBackup,
  pickSemesterBackup,
  recoverSemesterBackup,
  resetSemesterWithFiles,
} from "./backup";

function useSemester(id?: string, retainDeleted = false) {
  const [data, setData] = useState<SemesterRows>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    try {
      const active = settingsRepository.get("activeSemesterId")?.value;
      const selected =
        id ??
        (typeof active === "string"
          ? active
          : semestersRepository.list().find((s) => s.archivedAt === null)?.id);
      const next = selected ? semesterRows(selected) : undefined;
      setData((previous) =>
        retainDeleted &&
        !next?.semesters[0] &&
        previous?.semesters[0]?.id === selected
          ? previous
          : next,
      );
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, retainDeleted]);
  useFocusEffect(reload);
  useEffect(() => subscribeTimetable(reload), [reload]);
  return { data, error, loading, reload };
}
function useOperation() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    toast = useToast();
  const run = async (
    operation: () =>
      | Promise<{ undo?: () => void; message?: string }>
      | { undo?: () => void; message?: string },
    message: string,
  ) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      const result = await operation();
      invalidateTimetable();
      void haptic("success");
      toast({
        message: result.message ?? message,
        undo: result.undo
          ? () => {
              result.undo!();
              invalidateTimetable();
            }
          : undefined,
      });
      return true;
    } catch (e) {
      setError(errorMessage(e));
      void haptic("error");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function SemesterScreen() {
  const state = useSemester(),
    action = useOperation();
  const data = state.data,
    sem = data?.semesters[0];
  const expected = JSON.stringify(data);
  return (
    <Screen>
      <Stack.Screen options={{ title: "Semester" }} />
      {state.loading ? (
        <Skeleton height={200} />
      ) : state.error ? (
        <>
          <ErrorText message={state.error} />
          <Button label="Retry" onPress={state.reload} />
        </>
      ) : sem && data ? (
        <>
          <GlassCard solid>
            <Text variant="heading">{sem.name}</Text>
            <Text selectable>
              {sem.startsOn} — {sem.endsOn}
            </Text>
            <Text secondary>
              Global target {sem.targetBps / 100}% · {sem.timezone}
            </Text>
            <Text secondary variant="caption">
              Subject overrides keep their own targets.
            </Text>
            <Button
              label="Edit semester"
              variant="secondary"
              disabled={action.busy || sem.archivedAt !== null}
              onPress={() =>
                router.push({
                  pathname: "/semester-setup",
                  params: { mode: "edit", semesterId: sem.id },
                })
              }
            />
          </GlassCard>
          <GlassCard solid>
            <Text variant="heading">Holidays</Text>
            {data.holidays.length ? (
              data.holidays.map((h) => (
                <View key={h.id} style={{ gap: 8 }}>
                  <Text>{h.title}</Text>
                  <Text secondary variant="secondary">
                    {h.startsOn} — {h.endsOn}
                    {h.subjectId ? " · subject only" : " · all subjects"}
                  </Text>
                  <Button
                    label={`Remove ${h.title}`}
                    variant="secondary"
                    disabled={action.busy || sem.archivedAt !== null}
                    onPress={() =>
                      Alert.alert(
                        "Remove holiday?",
                        "Saved neutral marks remain neutral until you edit them in Daily Log.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Remove",
                            style: "destructive",
                            onPress: () =>
                              void action.run(
                                () =>
                                  removeSemesterHoliday(sem.id, expected, h.id),
                                "Holiday removed",
                              ),
                          },
                        ],
                      )
                    }
                  />
                </View>
              ))
            ) : (
              <Text secondary>No holidays added.</Text>
            )}
            <Button
              label="Add day or range"
              disabled={action.busy || sem.archivedAt !== null}
              onPress={() =>
                router.push({
                  pathname: "/semester-holiday",
                  params: { semesterId: sem.id },
                })
              }
            />
          </GlassCard>
          <Button
            label="Back up current semester"
            loading={action.busy}
            onPress={() =>
              void action.run(async () => {
                await exportSemesterBackup(sem.id, expected);
                return {
                  message:
                    "Complete semester backup saved locally. Use sharing to keep an external copy.",
                };
              }, "Backup saved")
            }
          />
          <Button
            label="Start new semester"
            disabled={action.busy}
            onPress={() =>
              router.push({
                pathname: "/semester-setup",
                params: { mode: "new", semesterId: sem.id },
              })
            }
          />
          <Button
            label="Reset semester"
            variant="destructive"
            disabled={action.busy || sem.archivedAt !== null}
            onPress={() =>
              router.push({
                pathname: "/semester-reset",
                params: { semesterId: sem.id },
              })
            }
          />
        </>
      ) : (
        <EmptyState
          title="Set up your semester"
          message="Choose a name, dates and attendance target."
          action={{
            label: "Set up semester",
            onPress: () =>
              router.push({
                pathname: "/semester-setup",
                params: { mode: "new" },
              }),
          }}
        />
      )}
      <Button
        label="Attendance history"
        variant="secondary"
        disabled={action.busy}
        onPress={() => router.push("/semester-history")}
      />
      <Button
        label="Recover a semester backup"
        variant="secondary"
        disabled={action.busy}
        onPress={() =>
          void action.run(async () => {
            const backup = await pickSemesterBackup();
            if (!backup) return { message: "Backup selection cancelled" };
            const confirmed = await new Promise<boolean>((resolve) =>
              Alert.alert(
                "Recover archived semester?",
                `${backup.rows.semesters[0].name}\n${backup.rows.subjects.length} subjects · ${backup.rows.attendanceRecords.length} attendance records · ${backup.rows.files.length} files. This adds read-only history; existing semesters are never replaced.`,
                [
                  {
                    text: "Cancel",
                    style: "cancel",
                    onPress: () => resolve(false),
                  },
                  { text: "Recover", onPress: () => resolve(true) },
                ],
                { cancelable: true, onDismiss: () => resolve(false) },
              ),
            );
            if (!confirmed) return { message: "Recovery cancelled" };
            await recoverSemesterBackup(backup);
            return { message: "Semester recovered in Attendance history" };
          }, "Semester recovered")
        }
      />
      <ErrorText message={action.error} />
    </Screen>
  );
}

export function SemesterSetupScreen() {
  const params = useLocalSearchParams<{ mode?: string; semesterId?: string }>();
  const state = useSemester(params.semesterId ?? "");
  if (state.loading)
    return (
      <Screen>
        <Skeleton height={250} />
      </Screen>
    );
  if (state.error)
    return (
      <Screen>
        <ErrorText message={state.error} />
        <Button label="Retry" onPress={state.reload} />
      </Screen>
    );
  if (params.mode === "edit" && !state.data?.semesters[0])
    return (
      <Screen>
        <Text secondary>Semester unavailable.</Text>
      </Screen>
    );
  if (state.data?.semesters[0]?.archivedAt != null)
    return (
      <Screen>
        <Text secondary>Archived semesters are read-only.</Text>
      </Screen>
    );
  return (
    <SemesterForm
      key={`${params.mode}:${state.data?.semesters[0]?.id ?? "new"}`}
      source={state.data?.semesters.length ? state.data : undefined}
      edit={params.mode === "edit"}
    />
  );
}
function SemesterForm({
  source,
  edit,
}: {
  source?: SemesterRows;
  edit: boolean;
}) {
  const [initialSource] = useState(source),
    sem = initialSource?.semesters[0];
  const timezone =
    sem?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localToday(timezone);
  const [name, setName] = useState(edit ? (sem?.name ?? "") : ""),
    [start, setStart] = useState(edit ? sem!.startsOn : today),
    [end, setEnd] = useState(edit ? sem!.endsOn : addDays(today, 120)),
    [target, setTarget] = useState(String((sem?.targetBps ?? 7500) / 100));
  const [copySubjects, setCopySubjects] = useState(true),
    [copyTimetable, setCopyTimetable] = useState(true),
    [step, setStep] = useState(0);
  const { scheme, colors } = useTheme(),
    form = useSave();
  const [initial] = useState(
    JSON.stringify([name, start, end, target, copySubjects, copyTimetable]),
  );
  const submit = () =>
    void form.save(
      () =>
        attachments.settled(() => {
          const draft = {
            name,
            startsOn: start,
            endsOn: end,
            targetBps: targetBasisPoints(target),
          };
          if (edit) {
            if (!sem) throw new Error("Semester unavailable.");
            return saveSemester(sem.id, JSON.stringify(initialSource), draft);
          }
          return startNewSemester(
            sem?.id,
            initialSource ? JSON.stringify(initialSource) : undefined,
            draft,
            timezone,
            !!sem && copySubjects,
            !!sem && copySubjects && copyTimetable,
          );
        }),
      edit
        ? "Semester saved"
        : "New semester started. Previous history is archived.",
    );
  return (
    <Editor
      title={
        edit
          ? "Edit semester"
          : step === 0
            ? "New semester · dates"
            : "New semester · target"
      }
      dirty={
        !form.done &&
        JSON.stringify([
          name,
          start,
          end,
          target,
          copySubjects,
          copyTimetable,
        ]) !== initial
      }
      busy={form.busy}
      primaryAction={
        edit || step === 1
          ? {
              label: "Save",
              onPress: submit,
              disabled: !name.trim(),
              loading: form.busy,
            }
          : undefined
      }
    >
      {(edit || step === 0) && (
        <>
          <Field
            label="Semester name"
            value={name}
            onChangeText={setName}
            editable={!form.busy}
            maxLength={120}
          />
          <DateField label="Starts on" value={start} onChange={setStart} />
          <DateField label="Ends on" value={end} onChange={setEnd} />
          <Text secondary variant="caption">
            Dates use {timezone}. Changing an existing start week with a
            timetable requires a new semester.
          </Text>
        </>
      )}
      {!edit && step === 0 && sem && (
        <>
          <Text secondary>
            “{sem.name}” will be archived only after you finish setup.
            Attendance and study content stay with it. Copy uses its current
            weekly timetable; holidays, extras and future schedule changes are
            not copied.
          </Text>
          <Host matchContents colorScheme={scheme} seedColor={colors.accent}>
            <Switch
              label="Copy active subjects"
              value={copySubjects}
              onValueChange={(v) => {
                setCopySubjects(v);
                if (!v) setCopyTimetable(false);
              }}
            />
          </Host>
          {copySubjects && (
            <Host matchContents colorScheme={scheme} seedColor={colors.accent}>
              <Switch
                label="Copy timetable and class types"
                value={copyTimetable}
                onValueChange={setCopyTimetable}
              />
            </Host>
          )}
        </>
      )}
      {(edit || step === 1) && (
        <>
          <Field
            label="Global attendance target (%)"
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
            editable={!form.busy}
          />
          <Text secondary>
            0–100%, up to two decimal places. Subject overrides are retained
            when subjects are copied.
          </Text>
        </>
      )}
      <ErrorText message={form.error} />
      {!edit && step === 0 ? (
        <Button
          label="Continue to target"
          disabled={!name.trim() || end < start}
          onPress={() => setStep(1)}
        />
      ) : (
        <>
          <Button
            label={edit ? "Save semester" : "Start new semester"}
            loading={form.busy}
            disabled={!name.trim()}
            onPress={submit}
          />
          {!edit && (
            <Button
              label="Back to dates"
              variant="secondary"
              disabled={form.busy}
              onPress={() => setStep(0)}
            />
          )}
        </>
      )}
    </Editor>
  );
}

export function SemesterHolidayScreen() {
  const { semesterId } = useLocalSearchParams<{ semesterId: string }>(),
    state = useSemester(semesterId);
  if (state.loading)
    return (
      <Screen>
        <Skeleton height={250} />
      </Screen>
    );
  if (!state.data?.semesters[0])
    return (
      <Screen>
        <ErrorText message={state.error || "Semester unavailable"} />
      </Screen>
    );
  return <HolidayForm source={state.data} />;
}
function HolidayForm({ source }: { source: SemesterRows }) {
  const [snapshot] = useState(source),
    sem = snapshot.semesters[0],
    form = useSave();
  const [title, setTitle] = useState(""),
    [start, setStart] = useState(sem.startsOn),
    [end, setEnd] = useState(sem.startsOn),
    [mode, setMode] = useState("day");
  const submit = () => {
    const until = mode === "day" ? start : end;
    const impact = holidayImpact(sem.id, start, until);
    Alert.alert(
      "Add holiday?",
      `${title || "Holiday"}: ${start} — ${until}. ${impact} recorded classes will become neutral and be excluded from totals. Undo restores their previous outcomes.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add holiday",
          onPress: () =>
            void form.save(
              () =>
                addSemesterHoliday(
                  sem.id,
                  JSON.stringify(snapshot),
                  title,
                  start,
                  until,
                ),
              "Holiday added",
            ),
        },
      ],
    );
  };
  return (
    <Editor
      title="Add holiday"
      dirty={!form.done && !!title}
      busy={form.busy}
      primaryAction={{
        label: "Save",
        onPress: submit,
        disabled: !title.trim() || sem.archivedAt !== null,
      }}
    >
      <Field
        label="Holiday name"
        value={title}
        onChangeText={setTitle}
        editable={!form.busy}
      />
      <Choice
        label="Holiday length"
        value={mode}
        onChange={setMode}
        options={[
          { value: "day", label: "Single day" },
          { value: "range", label: "Date range" },
        ]}
      />
      <DateField label="Starts on" value={start} onChange={setStart} />
      {mode === "range" && (
        <DateField label="Ends on (inclusive)" value={end} onChange={setEnd} />
      )}
      <Text secondary>
        Applies to every subject. Extras explicitly allowed on holidays keep
        their attendance.
      </Text>
      <ErrorText message={form.error} />
      <Button
        label="Add holiday"
        disabled={!title.trim() || sem.archivedAt !== null}
        loading={form.busy}
        onPress={submit}
      />
    </Editor>
  );
}

export function SemesterResetScreen() {
  const { semesterId } = useLocalSearchParams<{ semesterId: string }>(),
    state = useSemester(semesterId, true);
  if (state.loading)
    return (
      <Screen>
        <Skeleton height={250} />
      </Screen>
    );
  if (!state.data?.semesters[0])
    return (
      <Screen>
        <ErrorText message={state.error || "Semester unavailable"} />
      </Screen>
    );
  return <ResetForm source={state.data} />;
}
type ResetMode = "clear" | "new" | "delete";
function ResetForm({ source }: { source: SemesterRows }) {
  const [snapshot] = useState(source),
    sem = snapshot.semesters[0],
    action = useOperation();
  const { colors } = useTheme();
  const [mode, setMode] = useState<ResetMode>("clear");
  const [confirmation, setConfirmation] = useState(""),
    [skip, setSkip] = useState(false),
    [backupPath, setBackupPath] = useState("");
  const [cleanup, setCleanup] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  usePreventRemove(action.busy, () => {});
  const step1 = !!backupPath || skip;
  const match = confirmation.trim().toUpperCase() === "RESET";
  const ready = step1 && match && sem.archivedAt === null && !completed;
  const marks = snapshot.attendanceRecords.length;
  const subjects = snapshot.subjects.filter((x) => x.archivedAt === null).length;
  const impact = {
    clear: [
      `Removes ${marks} attendance ${marks === 1 ? "mark" : "marks"} across ${subjects} ${subjects === 1 ? "subject" : "subjects"}`,
      "Keeps subjects, timetable, topics, files and notes",
    ],
    new: [
      `Ends ${sem.name} and removes it from the Subjects tab`,
      `Copies subjects and timetable into the new semester; ${sem.name} stays in history`,
    ],
    delete: [
      `Deletes ${snapshot.subjects.length} subjects, ${marks} attendance records, ${snapshot.files.length} files and all notes, topics and deadlines in ${sem.name}`,
      "Other semesters and app preferences stay",
    ],
  }[mode];
  const go = () => {
    if (!ready) return;
    if (mode === "new") {
      router.replace({
        pathname: "/semester-setup",
        params: { mode: "new", semesterId: sem.id },
      });
      return;
    }
    void action.run(async () => {
      if (mode === "clear") {
        const result = clearSemesterAttendance(
          sem.id,
          JSON.stringify(snapshot),
          "RESET",
        );
        requestAnimationFrame(() => router.back());
        return {
          message: `${result.removed} attendance ${result.removed === 1 ? "mark" : "marks"} cleared`,
          undo: result.undo,
        };
      }
      const failures = await resetSemesterWithFiles(
        sem.id,
        JSON.stringify(snapshot),
        "RESET",
      );
      setCleanup(failures);
      setCompleted(true);
      setConfirmation("");
      return {
        message: failures.length
          ? "Semester deleted; some attachment cleanup needs retry"
          : "Semester deleted",
      };
    }, "Done");
  };
  const num = (n: number, done: boolean) => (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: done ? colors.present : colors.surfaceRaised,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {done ? (
        <Icon name={icons.check} size={13} color={colors.onAccent} />
      ) : (
        <Text style={{ fontSize: 13, fontWeight: "600" }}>{n}</Text>
      )}
    </View>
  );
  return (
    <PageScreen title="Reset semester">
      {completed ? (
        <Card gap={12}>
          <Text style={{ fontSize: 17, fontWeight: "600" }}>
            {sem.name} was deleted
          </Text>
          {cleanup.length > 0 && (
            <>
              <Text secondary>
                {cleanup.length} local files could not be removed. Retry cleanup
                before continuing.
              </Text>
              <ActionButton
                label="Retry file cleanup"
                variant="tonal"
                onPress={() =>
                  void action.run(async () => {
                    setCleanup(await semesterCleanup.recover());
                    return {};
                  }, "File cleanup retried")
                }
              />
            </>
          )}
          <ActionButton
            label="Set up a semester"
            disabled={cleanup.length > 0 || action.busy}
            onPress={() =>
              router.replace({ pathname: "/semester-setup", params: { mode: "new" } })
            }
          />
        </Card>
      ) : (
        <>
          <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
            <RadioCard
              title="Clear attendance only"
              subtitle={`Start counting ${sem.name} from zero`}
              selected={mode === "clear"}
              onPress={() => setMode("clear")}
            />
            <RadioCard
              title="Start a new semester"
              subtitle={`Archive ${sem.name} as read-only history`}
              selected={mode === "new"}
              onPress={() => setMode("new")}
            />
            <RadioCard
              title="Delete this semester"
              subtitle="Remove it and everything in it"
              selected={mode === "delete"}
              onPress={() => setMode("delete")}
            />
          </View>
          <Card gap={10} style={{ paddingVertical: 14 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Icon
                name={mode === "new" ? icons.archive : icons.minusCircle}
                size={18}
                color={mode === "new" ? colors.warning : colors.absent}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  lineHeight: 21,
                  fontWeight: "600",
                  color: mode === "new" ? colors.warning : colors.absent,
                }}
              >
                {impact[0]}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Icon name={icons.check} size={18} color={colors.present} />
              <Text style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>{impact[1]}</Text>
            </View>
          </Card>
          <Card gap={12}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              {num(1, step1)}
              <Text style={{ fontSize: 16, fontWeight: "600" }}>Save a backup first</Text>
            </View>
            <ActionButton
              label={
                backupPath
                  ? `Saved · ${backupPath.split("/").pop()}`
                  : "Save a complete backup"
              }
              icon={backupPath ? icons.check : icons.backup}
              variant={backupPath ? "success" : "tonal"}
              loading={action.busy && !backupPath && !match}
              disabled={!!backupPath}
              onPress={() =>
                void action.run(async () => {
                  const path = await exportSemesterBackup(
                    sem.id,
                    JSON.stringify(snapshot),
                  );
                  setBackupPath(path);
                  return {};
                }, "Backup saved. Share it from Backup & restore to keep a copy off this phone.")
              }
            />
            {!backupPath && (
              <Checkbox
                label="I don’t need a backup"
                checked={skip}
                onPress={() => setSkip(!skip)}
              />
            )}
          </Card>
          <Card gap={12} style={{ opacity: step1 ? 1 : 0.5 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              {num(2, step1 && match)}
              <Text style={{ fontSize: 16, fontWeight: "600" }}>Type RESET to confirm</Text>
            </View>
            <TextInput
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              accessibilityLabel="Type RESET to confirm"
              value={confirmation}
              onChangeText={setConfirmation}
              editable={step1 && !action.busy}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              placeholder="RESET"
              placeholderTextColor={colors.textSecondary}
              style={{
                height: 50,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: match ? colors.absent : colors.separator,
                backgroundColor: colors.background,
                paddingHorizontal: 14,
                fontSize: 17,
                fontWeight: "600",
                letterSpacing: 2,
                color: colors.textPrimary,
              }}
            />
          </Card>
          <ErrorText message={action.error} />
          <ActionButton
            label={
              mode === "clear"
                ? "Reset attendance"
                : mode === "new"
                  ? "Archive and start new semester"
                  : "Delete semester"
            }
            variant="danger"
            disabled={!ready}
            loading={action.busy && match}
            style={{ minHeight: 54 }}
            onPress={go}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={{ alignSelf: "center", minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.accent }}>
              Cancel
            </Text>
          </Pressable>
        </>
      )}
    </PageScreen>
  );
}
