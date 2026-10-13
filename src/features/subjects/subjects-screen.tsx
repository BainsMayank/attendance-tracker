import { useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import {
  ActionButton,
  Card,
  EmptyState,
  Eyebrow,
  FilterChip,
  GradientBackground,
  HeaderActions,
  Icon,
  ProgressLine,
  Skeleton,
  Stat,
  Text,
  contentStyle,
  icons,
  statusTone,
  toneColors,
  useTheme,
} from "@/ui";
import { adjustSubject } from "@/db/repositories/subject-attendance";
import { useLogMutation } from "@/features/daily-log/hooks";
import { ErrorText } from "@/features/timetable/form-controls";
import { overallSummary, sortSubjects } from "@/lib/subjects";
import { resolveDay } from "@/lib/daily-log";
import { attendanceStatus } from "@/lib/attendance";
import { dateInTimezone } from "@/features/timetable/hooks";
import { useSubjects } from "./hooks";
import { SubjectCard } from "./subject-card";
import { SubjectActions, useSubjectActions } from "./subject-actions";
import { percentNumber, semesterCaption, subjectStatus } from "./status";
import { useChromeInsets, useHeaderScrollEdge } from "@/features/shell/chrome";

type Filter = "all" | "bad" | "warn" | "ok";
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bad", label: "At risk" },
  { key: "warn", label: "On the line" },
  { key: "ok", label: "Safe" },
];

export default function SubjectsScreen() {
  const state = useSubjects();
  const { data, models, totals = [], now, sort } = state;
  const [filter, setFilter] = useState<Filter>("all");
  const mutation = useLogMutation();
  const actions = useSubjectActions();
  const { colors } = useTheme();
  const chrome = useChromeInsets();
  const scrollEdge = useHeaderScrollEdge();
  const toolbar = (semesterId?: string, disabled = false) =>
    process.env.EXPO_OS !== "web" && semesterId ? (
      <HeaderActions
        right={[
          {
            label: "Add subject",
            icon: icons.plus,
            accent: true,
            disabled,
            onPress: () =>
              router.push({ pathname: "/subject-editor", params: { semesterId } }),
          },
        ]}
      />
    ) : null;
  if (state.loading)
    return (
      <GradientBackground>
        <View style={[contentStyle, { paddingTop: 120 }]}>
          <Skeleton height={240} />
          <Skeleton height={200} />
        </View>
      </GradientBackground>
    );
  if (state.error)
    return (
      <GradientBackground>
        <View style={[contentStyle, { paddingTop: 140 }]}>
          <ErrorText message={state.error} />
          <ActionButton label="Retry" onPress={state.reload} />
        </View>
      </GradientBackground>
    );
  if (!data)
    return (
      <GradientBackground>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[contentStyle, chrome]}
        >
          <EmptyState
            title="Your subjects"
            message="Set up a semester, then add your subjects to start tracking attendance."
            action={{
              label: "Set up semester",
              onPress: () => router.push("/timetable-semester"),
            }}
          />
        </ScrollView>
      </GradientBackground>
    );
  const semester = data.semester;
  const local = dateInTimezone(now, semester.timezone);
  const readOnly = semester.archivedAt !== null;
  const beforeStart = local.date < semester.startsOn;
  const busy = mutation.busy || actions.mutation.busy;
  const summary = overallSummary(totals, models);
  const T = semester.targetBps;
  const overallTone = statusTone(
    attendanceStatus(summary.attended, summary.held, T),
  );
  const ink = toneColors(colors, overallTone).fg;
  const inSemester = !beforeStart && local.date <= semester.endsOn;
  const day = inSemester
    ? resolveDay({ ...data, records: state.loggedToday ?? [] }, local.date)
    : null;
  const tones = models.map((m) => ({ m, tone: subjectStatus(m).tone }));
  const visible = sortSubjects(
    tones
      .filter(({ tone }) => filter === "all" || tone === filter)
      .map(({ m }) => m),
    sort,
  );
  const header = (
    <View style={{ gap: 16 }}>
      <Eyebrow>{semesterCaption(semester, local.date)}</Eyebrow>
      <Card
        radius={14}
        padding={20}
        gap={14}
        accessibilityLabel="Overall attendance"
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <View>
            <Text variant="caption" secondary>
              Overall attendance
            </Text>
            <Text
              selectable
              accessibilityLabel={
                summary.held
                  ? `${percentNumber(summary.attended, summary.held)} percent`
                  : "No counted classes yet"
              }
              style={{
                fontSize: 44,
                lineHeight: 52,
                fontWeight: "600",
                letterSpacing: -0.5,
                fontVariant: ["tabular-nums"],
              }}
            >
              {percentNumber(summary.attended, summary.held)}
              {summary.held > 0 && (
                <Text
                  style={{
                    fontSize: 24,
                    letterSpacing: 0,
                    color: colors.textSecondary,
                  }}
                >
                  %
                </Text>
              )}
            </Text>
          </View>
          <View style={{ marginTop: 4 }}>
            <Text variant="caption" secondary style={{ fontWeight: "400" }}>
              Target {T / 100}%
            </Text>
          </View>
        </View>
        <ProgressLine
          value={summary.held ? summary.attended / summary.held : 0}
          color={ink}
        />
        <View style={{ flexDirection: "row" }}>
          <Stat value={summary.attended} label="Attended" />
          <Stat value={summary.held - summary.attended} label="Missed" />
          <Stat value={summary.held} label="Total" />
        </View>
        {day && !readOnly && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              day.classes.length
                ? `Today, ${day.classes.length} classes, ${day.marked} logged. Log today`
                : "No classes today. Open Daily Log"
            }
            onPress={() => router.navigate("/daily-log")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 48,
              paddingTop: 14,
              marginTop: -2,
              borderTopWidth: 0.5,
              borderTopColor: colors.separator,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name={icons.calendarCheck} size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" secondary>
                Today
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "500" }}>
                {day.classes.length
                  ? `${day.classes.length} ${day.classes.length === 1 ? "class" : "classes"} · ${day.marked} logged`
                  : "No classes"}
              </Text>
            </View>
            <Text
              style={{ fontSize: 15, fontWeight: "500", color: colors.accent }}
            >
              {day.classes.length && day.marked < day.classes.length
                ? "Log today"
                : "Open log"}
            </Text>
            <Icon name={icons.chevronRight} size={14} color={colors.accent} />
          </Pressable>
        )}
      </Card>
      {models.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Filter subjects"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          style={{ marginHorizontal: -16 }}
        >
          {filters.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              count={
                f.key === "all"
                  ? models.length
                  : tones.filter((t) => t.tone === f.key).length
              }
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      )}
      {beforeStart && !readOnly && (
        <Text variant="caption" secondary>
          Attendance adjustments open when {semester.name} starts.
        </Text>
      )}
      {readOnly && (
        <Text variant="caption" secondary>
          Archived semester · read-only.
        </Text>
      )}
      <ErrorText message={mutation.error || actions.mutation.error} />
    </View>
  );
  return (
    <GradientBackground>
      {toolbar(semester.id, readOnly)}
      <FlatList
        data={visible}
        keyExtractor={(m) => m.subject.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[contentStyle, chrome, { flexGrow: 1 }]}
        onScroll={scrollEdge}
        scrollEventThrottle={16}
        ListHeaderComponent={header}
        ListEmptyComponent={
          models.length ? (
            <Card padding={32} style={{ alignItems: "center" }}>
              <Text secondary style={{ textAlign: "center" }}>
                No subjects in this group right now.
              </Text>
            </Card>
          ) : (
            <EmptyState
              title="Add your first subject"
              message="Add subjects here, or import your whole timetable from a photo in the Timetable tab."
              action={
                readOnly
                  ? undefined
                  : {
                      label: "Add subject",
                      onPress: () =>
                        router.push({
                          pathname: "/subject-editor",
                          params: { semesterId: semester.id },
                        }),
                    }
              }
            />
          )
        }
        renderItem={({ item }) => (
          <SubjectCard
            model={item}
            today={local.date}
            busy={busy}
            readOnly={readOnly}
            adjustmentsDisabled={beforeStart}
            onAction={(action) => actions.action(item, action)}
            onAdjust={(field, direction) =>
              void mutation.run(
                () =>
                  adjustSubject({
                    semesterId: semester.id,
                    subjectId: item.subject.id,
                    subjectRevision: item.subject.revision,
                    expected: { attended: item.attended, held: item.held },
                    field,
                    direction,
                  }),
                `${item.subject.name}: ${field === "attended" ? "attended" : "missed"} ${direction === 1 ? "+1" : "−1"}`,
              )
            }
          />
        )}
      />
      <SubjectActions controller={actions} readOnly={readOnly} />
    </GradientBackground>
  );
}
