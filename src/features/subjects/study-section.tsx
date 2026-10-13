import { Host, Slider } from "@expo/ui";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, AppState, Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { MenuView } from "@expo/ui/community/menu";
import {
  ActionButton,
  Card,
  FilterChip,
  GradientBackground,
  Group,
  Icon,
  SectionHeader,
  SegmentedControl,
  Text,
  contentStyle,
  icons,
  toneColors,
  useTheme,
  type Tone,
} from "@/ui";
import {
  saveContent,
  type ContentData,
  type SubjectScope,
} from "@/db/repositories/subject-content";
import {
  startStudy,
  studyData,
  updateStudy,
  type StudyAction,
} from "@/db/repositories/study-timer";
import type { SlotRow } from "@/db/repositories/timetable-commands";
import { useLogMutation } from "@/features/daily-log/hooks";
import { ErrorText } from "@/features/timetable/form-controls";
import {
  dateInTimezone,
  errorMessage,
  subscribeTimetable,
} from "@/features/timetable/hooks";
import {
  calendarDaysBetween,
  canSkip,
  classesNeeded,
  meetsTarget,
  mondayAnchor,
} from "@/lib/attendance";
import { planClasses, upcomingClasses } from "@/lib/attendance/insights";
import type { LogData } from "@/lib/daily-log";
import type { SubjectModel } from "@/lib/subjects";
import { DAY_NAMES, formatTime } from "@/lib/timetable";
import {
  deadlineType,
  linkKind,
  localParts,
  plainNote,
  timerSnapshot,
  validatedURL,
} from "./content-model";
import { percentNumber, relativeClassTime } from "./status";

const EXAMS = ["quiz", "mid-sem", "end-sem", "exam"];

export function StudySection({
  model,
  logData,
  content,
  scope,
  slots,
  header,
  readOnly,
  now,
}: {
  model: SubjectModel;
  logData: LogData;
  content: ContentData;
  scope: SubjectScope;
  slots: SlotRow[];
  header: ReactNode;
  readOnly: boolean;
  now: Date;
}) {
  const timezone = logData.semester.timezone;
  const { colors } = useTheme();
  const mutation = useLogMutation();
  const [linkError, setLinkError] = useState("");
  const edit = (
    kind: "deadline" | "note" | "link" | "mark",
    id?: string,
  ) =>
    router.push({
      pathname: "/subject-content-editor",
      params: { ...scope, kind, id },
    });
  const today = localParts(now.getTime(), timezone).date;
  const open = content.deadlines.filter((d) => d.completedAt === null);
  const doneCount = content.deadlines.length - open.length;
  return (
    <GradientBackground>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={contentStyle}
      >
        {header}
        <ErrorText message={mutation.error || linkError} />

        <SectionHeader
          title="Exams & deadlines"
          action={
            readOnly ? undefined : { label: "Add", onPress: () => edit("deadline") }
          }
        />
        {open.length ? (
          <Group>
            {open.map((d) => {
              const due = localParts(d.dueAt, timezone);
              const days = calendarDaysBetween(today, due.date);
              const late = d.dueAt < now.getTime();
              const tone: Tone = late
                ? "bad"
                : EXAMS.includes(d.category)
                  ? days <= 3
                    ? "bad"
                    : "accent"
                  : days <= 7
                    ? "warn"
                    : "neutral";
              return (
                <MenuView
                  key={d.id}
                  shouldOpenOnLongPress
                  title={d.title}
                  actions={
                    readOnly
                      ? []
                      : [
                          { id: "done", title: "Mark done", image: "checkmark.circle" },
                          { id: "edit", title: "Edit", image: "pencil" },
                        ]
                  }
                  onPressAction={({ nativeEvent }) =>
                    nativeEvent.event === "done"
                      ? void mutation.run(
                          () =>
                            saveContent(
                              scope,
                              "deadline",
                              { ...d, completedAt: Date.now() },
                              d.id,
                              d.revision,
                            ),
                          "Marked done",
                        )
                      : edit("deadline", d.id)
                  }
                >
                  <Row
                    onPress={readOnly ? undefined : () => edit("deadline", d.id)}
                    label={`${d.title}, ${late ? "overdue" : days === 0 ? "due today" : `in ${days} days`}`}
                    leading={
                      <CountdownBadge
                        tone={tone}
                        value={late ? "!" : String(days)}
                        unit={late ? "LATE" : days === 0 ? "TODAY" : days === 1 ? "DAY" : "DAYS"}
                      />
                    }
                    title={d.title}
                    subtitle={[
                      new Intl.DateTimeFormat(undefined, {
                        timeZone: timezone,
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        hourCycle: "h23",
                      }).format(d.dueAt),
                      deadlineType(d.category),
                      d.description,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                </MenuView>
              );
            })}
          </Group>
        ) : (
          <EmptyCard
            text={
              doneCount
                ? `All caught up · ${doneCount} done`
                : "No exams or deadlines yet."
            }
          />
        )}

        {!readOnly && model.target > 0 && (
          <>
            <SectionHeader title="Bunk planner" />
            <BunkPlanner model={model} data={logData} now={now} />
          </>
        )}

        <SectionHeader title="Focus timer" />
        <FocusTimer scope={scope} readOnly={readOnly} timezone={timezone} subject={model.subject.name} />

        <SectionHeader
          title="Notes"
          action={
            readOnly ? undefined : { label: "New note", onPress: () => edit("note") }
          }
        />
        {content.notes.length ? (
          <Group inset={48}>
            {content.notes.map((n) => (
              <Row
                key={n.id}
                onPress={() =>
                  router.push({
                    pathname: "/subject-note",
                    params: { ...scope, id: n.id },
                  })
                }
                leading={
                  <Icon
                    name={n.pinned ? { ios: "pin.fill", android: "push_pin" } : icons.note}
                    size={20}
                    color={colors.accent}
                  />
                }
                title={n.title}
                subtitle={plainNote(n.body).replace(/\s+/g, " ").trim() || "Empty note"}
                lines={2}
              />
            ))}
          </Group>
        ) : (
          <EmptyCard text="Jot down exam patterns, formulas or anything to remember." />
        )}

        <SectionHeader
          title="Links"
          action={
            readOnly ? undefined : { label: "Add link", onPress: () => edit("link") }
          }
        />
        {content.links.length ? (
          <Group inset={70}>
            {content.links.map((l) => {
              const kind = linkKind(l.url);
              const badge = {
                youtube: ["VIDEO", "bad"],
                drive: ["DRIVE", "ok"],
                pdf: ["PDF", "warn"],
                web: ["WEB", "accent"],
              }[kind] as [string, Tone];
              let host = "";
              try {
                host = new URL(l.url).hostname.replace(/^www\./, "");
              } catch {
                host = l.url;
              }
              return (
                <Row
                  key={l.id}
                  label={`Open ${l.title}`}
                  onPress={() => {
                    setLinkError("");
                    void Promise.resolve()
                      .then(() => openBrowserAsync(validatedURL(l.url)))
                      .catch((e) => setLinkError(errorMessage(e)));
                  }}
                  onLongPress={readOnly ? undefined : () => edit("link", l.id)}
                  leading={<LabelBadge text={badge[0]} tone={badge[1]} />}
                  title={l.title}
                  subtitle={l.label ? `${l.label} · ${host}` : host}
                  trailing={icons.link}
                />
              );
            })}
          </Group>
        ) : (
          <EmptyCard text="Save lecture playlists, shared folders and reference sites." />
        )}

        <SectionHeader
          title="Marks"
          action={
            readOnly ? undefined : { label: "Add", onPress: () => edit("mark") }
          }
        />
        {content.marks.length ? (
          <MarksList content={content} onEdit={readOnly ? undefined : (id) => edit("mark", id)} />
        ) : (
          <EmptyCard text="Record quiz and exam scores to see a running total." />
        )}

        <SectionHeader
          title="When & where"
          action={{
            label: "Edit",
            onPress: () => router.navigate("/timetable"),
          }}
        />
        {slots.length ? (
          <Group>
            {slots.map((s) => (
              <View
                key={s.id}
                accessible
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 52,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ width: 44, fontSize: 15, fontWeight: "600" }}>
                  {DAY_NAMES[s.weekday - 1].slice(0, 3)}
                </Text>
                <Text style={{ flex: 1, fontSize: 15, fontVariant: ["tabular-nums"] }}>
                  {formatTime(s.startMinute)} – {formatTime(s.endMinute)}
                  {s.parity !== "all" ? ` · ${s.parity} wks` : ""}
                </Text>
                <Text variant="caption" secondary numberOfLines={1} style={{ maxWidth: "45%" }}>
                  {[s.room, logData.types.find((t) => t.id === s.classTypeId)?.name]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            ))}
          </Group>
        ) : (
          <EmptyCard text="No weekly classes. Add them from the Timetable tab." />
        )}
        {model.subject.teacher && (
          <Text variant="caption" secondary style={{ marginHorizontal: 4 }}>
            Taught by {model.subject.teacher}
          </Text>
        )}
      </ScrollView>
    </GradientBackground>
  );
}
function Row({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  onLongPress,
  label,
  lines = 1,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: { ios: string; android: string };
  onPress?: () => void;
  onLongPress?: () => void;
  label?: string;
  lines?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label ?? [title, subtitle].filter(Boolean).join(", ")}
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: lines > 1 ? "flex-start" : "center",
        gap: 12,
        minHeight: 60,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "600" }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" secondary numberOfLines={lines}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing && <Icon name={trailing} size={16} color={colors.textSecondary} />}
    </Pressable>
  );
}
function CountdownBadge({ value, unit, tone }: { value: string; unit: string; tone: Tone }) {
  const { colors } = useTheme();
  const c = toneColors(colors, tone);
  return (
    <View
      style={{
        width: 52,
        borderRadius: 12,
        paddingVertical: 6,
        backgroundColor: c.bg,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 20, lineHeight: 24, fontWeight: "600", color: c.fg, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: "600", color: c.fg }}>{unit}</Text>
    </View>
  );
}
function LabelBadge({ text, tone }: { text: string; tone: Tone }) {
  const { colors } = useTheme();
  const c = toneColors(colors, tone);
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: c.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: "600", letterSpacing: 0.3, color: c.fg }}>
        {text}
      </Text>
    </View>
  );
}
function EmptyCard({ text }: { text: string }) {
  return (
    <Card padding={18}>
      <Text variant="secondary" secondary>
        {text}
      </Text>
    </Card>
  );
}

function MarksList({
  content,
  onEdit,
}: {
  content: ContentData;
  onEdit?: (id: string) => void;
}) {
  const graded = content.marks.filter((m) => m.earned !== null);
  const earned = graded.reduce((n, m) => n + m.earned!, 0),
    max = graded.reduce((n, m) => n + m.maximum, 0);
  return (
    <>
      <Group>
        {content.marks.map((m) => (
          <Row
            key={m.id}
            onPress={onEdit ? () => onEdit(m.id) : undefined}
            title={m.title}
            subtitle={[
              m.earned === null
                ? "Not graded"
                : `${m.earned} / ${m.maximum} · ${((m.earned / m.maximum) * 100).toFixed(1)}%`,
              m.onDate,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
      </Group>
      <Text variant="caption" secondary style={{ marginHorizontal: 4 }}>
        {graded.length
          ? `Running total ${Number(earned.toFixed(2))} / ${Number(max.toFixed(2))} · ${((earned / max) * 100).toFixed(1)}% · ${graded.length} of ${content.marks.length} graded`
          : "No graded assessments yet."}
      </Text>
    </>
  );
}

function BunkPlanner({
  model,
  data,
  now,
}: {
  model: SubjectModel;
  data: LogData;
  now: Date;
}) {
  const { colors, scheme } = useTheme();
  const [mode, setMode] = useState<"If I skip" | "If I attend">("If I skip");
  const [n, setN] = useState(1);
  const local = dateInTimezone(now, data.semester.timezone);
  const upcoming = useMemo(
    () =>
      upcomingClasses(
        { ...data.semester, ...data },
        local.date,
        local.minute,
        model.subject.id,
      ).filter(
        // Today's later classes may already be logged; skip them so nothing counts twice.
        (c) =>
          !data.records.some(
            (r) =>
              r.kind === "occurrence" &&
              r.onDate === c.date &&
              (r.occurrenceKey === c.key ||
                (r.slotId &&
                  c.key.startsWith("slot:") &&
                  (data.slots.find((s) => s.id === r.slotId)?.lineageId ??
                    r.slotId) ===
                    (data.slots.find((s) => s.id === c.key.split(":")[1])
                      ?.lineageId ?? c.key.split(":")[1]))),
          ),
      ),
    [data, local.date, local.minute, model.subject.id],
  );
  const max = Math.min(upcoming.length, 20);
  const count = Math.min(n, max);
  const skip = mode === "If I skip";
  const T = model.target;
  const result = planClasses(
    model.attended,
    model.held,
    upcoming,
    count,
    skip ? "skip" : "attend",
  );
  const ok = meetsTarget(result.attended, result.held, T) !== false;
  const after = canSkip(result.attended, result.held, T);
  const need = classesNeeded(result.attended, result.held, T);
  const t = `${T / 100}%`;
  const room = after.kind === "finite" ? after.units : 0;
  const verdict = !upcoming.length
    ? "No upcoming classes to plan."
    : !result.held
      ? "No counted classes yet."
      : skip
        ? count === 0
          ? "Move the slider to plan ahead."
          : ok
            ? room === 0
              ? result.attended * 10000 === T * result.held
                ? `Exactly at ${t}. No more skips after this.`
                : `Still above ${t}. No more skips after this.`
              : `Still above ${t}. ${room} more ${room === 1 ? "skip" : "skips"} left.`
            : `Below ${t}. Attend ${need.kind === "finite" ? need.units : "every class"} in a row after.`
        : count === 0
          ? "Move the slider to plan ahead."
          : ok
            ? `Builds ${room} ${room === 1 ? "skip" : "skips"} of cushion.`
            : `Still below ${t}. ${need.kind === "finite" ? need.units : "More"} more to go.`;
  const c = toneColors(colors, ok ? "ok" : "bad");
  const when = !upcoming.length
    ? "Add classes in Timetable to forecast."
    : count === 0
      ? `Next class: ${relativeClassTime(upcoming[0].date, upcoming[0].startMinute, local.date)}.`
      : result.nth
        ? `Covers classes through ${relativeClassTime(result.nth.date, result.nth.startMinute, local.date)}${result.units !== count ? ` · ${result.units} units` : ""}.`
        : "";
  return (
    <Card gap={14} accessibilityLabel="Bunk planner">
      <SegmentedControl
        values={["If I skip", "If I attend"] as const}
        value={mode}
        onChange={setMode}
      />
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 16, fontWeight: "600" }}>Next classes</Text>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.accent, fontVariant: ["tabular-nums"] }}>
            {count}
          </Text>
        </View>
        <Host
          matchContents={{ vertical: true }}
          colorScheme={scheme}
          seedColor={colors.accent}
          style={{ width: "100%", minHeight: 40 }}
        >
          <Slider
            value={count}
            min={0}
            max={Math.max(1, max)}
            step={1}
            disabled={!max}
            onValueChange={(v) => setN(Math.round(v))}
          />
        </Host>
      </View>
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Attendance would be ${percentNumber(result.attended, result.held)} percent. ${verdict}`}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: 14,
          borderRadius: 10,
          backgroundColor: c.bg,
        }}
      >
        <View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: c.fg }}>
            Attendance would be
          </Text>
          <Text style={{ fontSize: 30, lineHeight: 36, fontWeight: "600", color: c.fg, fontVariant: ["tabular-nums"] }}>
            {percentNumber(result.attended, result.held)}%
          </Text>
        </View>
        <Text style={{ flex: 1, maxWidth: 170, textAlign: "right", fontSize: 14, fontWeight: "600", color: c.fg }}>
          {verdict}
        </Text>
      </View>
      {!!when && (
        <Text variant="caption" secondary>
          {when}
        </Text>
      )}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <FilterChip
          label="−1"
          accessibilityLabel="One class fewer"
          selected={false}
          disabled={count === 0}
          onPress={() => setN(Math.max(0, count - 1))}
        />
        <FilterChip
          label="+1"
          accessibilityLabel="One class more"
          selected={false}
          disabled={count >= max}
          onPress={() => setN(Math.min(max, count + 1))}
        />
        <Text variant="caption" secondary style={{ flex: 1 }}>
          Neutral (cancelled) classes don’t count.
        </Text>
      </View>
    </Card>
  );
}

const presets = [25, 45, 60];
function FocusTimer({
  scope,
  readOnly,
  timezone,
  subject,
}: {
  scope: SubjectScope;
  readOnly: boolean;
  timezone: string;
  subject: string;
}) {
  const { colors } = useTheme();
  const { semesterId, subjectId } = scope;
  const [data, setData] = useState<ReturnType<typeof studyData>>();
  const [error, setError] = useState("");
  const [tick, setTick] = useState(Date.now);
  const [length, setLength] = useState(25);
  const mutation = useLogMutation();
  const reload = useCallback(() => {
    try {
      setData(studyData({ semesterId, subjectId }));
      setError("");
      setTick(Date.now());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [semesterId, subjectId]);
  useFocusEffect(reload);
  useEffect(() => subscribeTimetable(reload), [reload]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") reload();
    });
    return () => sub.remove();
  }, [reload]);
  useEffect(() => {
    if (data?.active?.state !== "running") return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") setTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [data?.active?.state]);
  if (!data)
    return (
      <Card>
        <ErrorText message={error} />
        {!error && <Text secondary>Loading timer…</Text>}
      </Card>
    );
  const active = data.active;
  const own = active?.subjectId === subjectId;
  const snap = active && own ? timerSnapshot(active, tick) : null;
  const seconds = snap ? snap.remaining : length * 60;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const weekStart = mondayAnchor(localParts(tick, timezone).date);
  const week = data.sessions.filter(
    (s) =>
      s.state === "completed" &&
      localParts(s.startedAt, timezone).date >= weekStart,
  );
  const minutes = Math.round(week.reduce((n, s) => n + s.activeSeconds, 0) / 60);
  const act = (value: StudyAction) =>
    active &&
    void mutation.run(
      () => updateStudy(scope, active.id, active.revision, value),
      {
        next: "Next phase started",
        finish: "Study session saved",
        discard: "Session discarded",
        pause: "Timer paused",
        resume: "Timer resumed",
      }[value],
    );
  if (active && !own)
    return (
      <Card>
        <Text style={{ fontWeight: "600", fontSize: 16 }}>
          A timer is running for another subject
        </Text>
        <Text secondary>Finish or pause it before starting one for {subject}.</Text>
        <ActionButton
          label="Open running timer"
          variant="tonal"
          onPress={() =>
            router.push({
              pathname: "/subjects/[subjectId]",
              params: {
                subjectId: active.subjectId!,
                semesterId: active.semesterId,
                section: "Study",
              },
            })
          }
        />
      </Card>
    );
  const phaseDone = !!snap && snap.remaining === 0 && !snap.clockAnomaly;
  return (
    <Card gap={14} style={{ alignItems: "center", paddingTop: 18 }} accessibilityLabel="Focus timer">
      {active && (
        <Text variant="caption" style={{ color: colors.accent, fontWeight: "600" }}>
          {active.phase === "focus" ? "FOCUS" : "BREAK"}
          {active.state === "paused" ? " · PAUSED" : phaseDone ? " · COMPLETE" : ""}
        </Text>
      )}
      <Text
        accessibilityRole="timer"
        accessibilityLabel={`${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds${active ? " remaining" : ""}`}
        adjustsFontSizeToFit
        numberOfLines={1}
        style={{ fontSize: 56, lineHeight: 64, fontWeight: "300", letterSpacing: -1, fontVariant: ["tabular-nums"] }}
      >
        {clock}
      </Text>
      {!active && (
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>
          {presets.map((p) => (
            <FilterChip
              key={p}
              label={`${p} min`}
              selected={length === p}
              onPress={() => setLength(p)}
            />
          ))}
        </View>
      )}
      {snap?.clockAnomaly && (
        <ErrorText message="The device clock moved backwards. Pause, then resume to continue." />
      )}
      <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
        {active ? (
          <>
            <ActionButton
              label="Finish"
              variant="tonal"
              style={{ flex: 1 }}
              disabled={readOnly || mutation.busy || !!snap?.clockAnomaly}
              onPress={() => act("finish")}
            />
            <ActionButton
              label={
                phaseDone
                  ? active.phase === "focus" && active.plannedBreakSeconds > 0
                    ? "Start break"
                    : "Next focus"
                  : active.state === "paused"
                    ? "Resume"
                    : "Pause"
              }
              style={{ flex: 1 }}
              disabled={readOnly || mutation.busy}
              onPress={() =>
                act(phaseDone ? "next" : active.state === "paused" ? "resume" : "pause")
              }
            />
          </>
        ) : (
          <>
            <ActionButton
              label="Reset"
              variant="tonal"
              style={{ flex: 1 }}
              disabled={length === 25}
              onPress={() => setLength(25)}
            />
            <ActionButton
              label="Start focus"
              style={{ flex: 1 }}
              disabled={readOnly || mutation.busy}
              onPress={() =>
                void mutation.run(
                  () => startStudy(scope, length, 5, null),
                  "Focus started",
                )
              }
            />
          </>
        )}
      </View>
      {active && (
        <Pressable
          accessibilityRole="button"
          disabled={readOnly || mutation.busy}
          onPress={() =>
            Alert.alert(
              "Discard this session?",
              "Its focus time won’t count toward your totals.",
              [
                { text: "Keep going", style: "cancel" },
                { text: "Discard", style: "destructive", onPress: () => act("discard") },
              ],
            )
          }
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: colors.absent, fontWeight: "600" }}>Discard session</Text>
        </Pressable>
      )}
      <Text variant="caption" secondary style={{ textAlign: "center" }}>
        This week on {subject}: {week.length} {week.length === 1 ? "session" : "sessions"} ·{" "}
        {minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`}
      </Text>
      <ErrorText message={mutation.error || error} />
    </Card>
  );
}
