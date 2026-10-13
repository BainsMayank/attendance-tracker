import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { SubjectFilesBrowser } from "@/features/files/browser";
import {
  ActionButton,
  Card,
  EmptyState,
  GradientBackground,
  Icon,
  Pill,
  SegmentedControl,
  Skeleton,
  StatGrid,
  TargetRing,
  Text,
  contentStyle,
  icons,
  statusTone,
  toneColors,
  useTheme,
  HeaderActions,
} from "@/ui";
import { ErrorText } from "@/features/timetable/form-controls";
import { dateInTimezone } from "@/features/timetable/hooks";
import { neutralCount } from "@/db/repositories/subject-attendance";
import { nextClasses, subjectModels, type SubjectModel } from "@/lib/subjects";
import { attendanceStatus } from "@/lib/attendance";
import { selectVersion } from "@/lib/timetable";
import { useSubjects } from "./hooks";
import { SubjectActions, useSubjectActions } from "./subject-actions";
import { useSubjectContent } from "./content-hooks";
import { TopicsSection } from "./topics-section";
import { StudySection } from "./study-section";
import { SubjectHistory } from "./history-section";
import { percentNumber, subjectStatus } from "./status";

const sections = ["Topics", "Files", "Study"] as const;
type Section = (typeof sections)[number];
// Older links (notifications, history) used one section per tool.
const legacy: Record<string, Section> = {
  Notes: "Study",
  Deadlines: "Study",
  Marks: "Study",
  Links: "Study",
  Timer: "Study",
};

export default function SubjectDetailScreen() {
  const params = useLocalSearchParams<{
    subjectId: string;
    semesterId?: string;
    section?: string;
  }>();
  const state = useSubjects(params.semesterId);
  const history = params.section === "History";
  const [section, setSection] = useState<Section>(() =>
    sections.includes(params.section as Section)
      ? (params.section as Section)
      : (legacy[params.section ?? ""] ?? "Topics"),
  );
  const actions = useSubjectActions();
  const { colors } = useTheme();
  const { data, totals = [], now } = state;
  const model = useMemo(() => {
    if (!data) return undefined;
    const local = dateInTimezone(now, data.semester.timezone);
    return subjectModels(
      data,
      totals,
      nextClasses(data, local.date, local.minute),
      true,
    ).find((m) => m.subject.id === params.subjectId);
  }, [data, totals, now, params.subjectId]);
  const scope = {
    semesterId: data?.semester.id ?? params.semesterId ?? "",
    subjectId: params.subjectId,
  };
  const content = useSubjectContent(scope);
  if (state.loading)
    return (
      <GradientBackground>
        <View style={[contentStyle, { paddingTop: 120 }]}>
          <Skeleton height={260} />
          <Skeleton height={200} />
        </View>
      </GradientBackground>
    );
  if (state.error)
    return (
      <GradientBackground>
        <View style={[contentStyle, { paddingTop: 120 }]}>
          <ErrorText message={state.error} />
          <ActionButton label="Retry" onPress={state.reload} />
        </View>
      </GradientBackground>
    );
  if (!data || !model)
    return (
      <GradientBackground>
        <View style={[contentStyle, { paddingTop: 120 }]}>
          <EmptyState
            title="Subject unavailable"
            message="This subject is not available in the selected semester."
            action={{
              label: "Back to subjects",
              onPress: () => router.replace("/"),
            }}
          />
        </View>
      </GradientBackground>
    );
  const local = dateInTimezone(now, data.semester.timezone);
  const readOnly =
    data.semester.archivedAt !== null || model.subject.archivedAt !== null;
  if (history)
    return (
      <>
        <Stack.Screen
          options={{ title: "Attendance log", headerLargeTitleEnabled: false }}
        />
        <SubjectHistory
          semesterId={data.semester.id}
          subjectId={model.subject.id}
          today={local.date}
          header={
            <View style={{ gap: 4 }}>
              <Text variant="caption" secondary>
                {model.subject.code || "Subject"}
              </Text>
              <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: "600" }}>
                {model.subject.name}
              </Text>
            </View>
          }
        />
      </>
    );
  const date =
    local.date < data.semester.startsOn
      ? data.semester.startsOn
      : local.date > data.semester.endsOn
        ? data.semester.endsOn
        : local.date;
  const version = selectVersion(data.versions, date);
  const slots = data.slots
    .filter(
      (s) => s.subjectId === model.subject.id && s.versionId === version?.id,
    )
    .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  const typeNames = [
    ...new Set(
      slots.map((s) => data.types.find((t) => t.id === s.classTypeId)?.name),
    ),
  ].filter(Boolean);
  const switcher = (
    <SegmentedControl values={sections} value={section} onChange={setSection} />
  );
  const tone = statusTone(model.status);
  const full = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Text variant="caption" secondary>
          {[
            model.subject.code,
            typeNames.join(" + "),
            slots.length
              ? `${slots.length} ${slots.length === 1 ? "class" : "classes"} a week`
              : "No weekly classes",
            readOnly ? "Archived" : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Text
          accessibilityRole="header"
          selectable
          style={{
            fontSize: 28,
            lineHeight: 34,
            fontWeight: "600",
            letterSpacing: -0.3,
          }}
        >
          {model.subject.name}
        </Text>
      </View>
      <AttendanceCard
        model={model}
        neutral={neutralCount(data.semester.id, model.subject.id)}
        onLog={() =>
          router.push({
            pathname: "/subjects/[subjectId]",
            params: {
              subjectId: model.subject.id,
              semesterId: data.semester.id,
              section: "History",
            },
          })
        }
      />
      {switcher}
    </View>
  );
  const compact = (
    <View style={{ gap: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" secondary>
            {model.subject.code || "Subject"}
            {readOnly ? " · Archived" : ""}
          </Text>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 24, lineHeight: 30, fontWeight: "600" }}
          >
            {model.subject.name}
          </Text>
        </View>
        <View style={{ marginBottom: 4 }}>
          <Pill
            label={
              model.held
                ? `${percentNumber(model.attended, model.held)}%`
                : "No data"
            }
            tone={tone}
          />
        </View>
      </View>
      {switcher}
    </View>
  );
  const editMenu = process.env.EXPO_OS === "android" && !readOnly ? (
    <HeaderActions
      right={[
        {
          label: "Edit subject",
          icon: icons.pencil,
          accent: true,
          onPress: () => actions.action(model, "actions"),
        },
      ]}
    />
  ) : process.env.EXPO_OS === "ios" && !readOnly && (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu
        icon="pencil"
        accessibilityLabel="Edit subject"
        tintColor={colors.accent}
      >
        <Stack.Toolbar.MenuAction
          icon="pencil"
          onPress={() => actions.action(model, "edit")}
        >
          Edit details
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon="paintpalette"
          onPress={() => actions.action(model, "color")}
        >
          Change color
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon="archivebox"
          destructive
          onPress={() => actions.action(model, "archive")}
        >
          Archive subject
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
  return (
    <>
      <Stack.Screen options={{ title: "", headerLargeTitleEnabled: false }} />
      {editMenu}
      {section === "Files" ? (
        <SubjectFilesBrowser
          key={model.subject.id}
          scope={{ semesterId: data.semester.id, subjectId: model.subject.id }}
          subjectName={model.subject.name}
          readOnly={readOnly}
          header={compact}
        />
      ) : content.error || !content.data ? (
        <GradientBackground>
          <View style={[contentStyle, { paddingTop: 120 }]}>
            {section === "Topics" ? full : compact}
            {content.loading ? (
              <Skeleton height={200} />
            ) : (
              <>
                <ErrorText
                  message={content.error || "Subject content unavailable."}
                />
                <ActionButton label="Retry" onPress={content.reload} />
              </>
            )}
          </View>
        </GradientBackground>
      ) : section === "Topics" ? (
        <TopicsSection
          data={content.data}
          scope={scope}
          header={full}
          readOnly={readOnly}
          now={now.getTime()}
          timezone={data.semester.timezone}
        />
      ) : (
        <StudySection
          key={model.subject.id}
          model={model}
          logData={{ ...data, records: state.loggedToday ?? [] }}
          content={content.data}
          scope={scope}
          slots={slots}
          header={compact}
          readOnly={readOnly}
          now={now}
        />
      )}
      <SubjectActions controller={actions} readOnly={readOnly} />
    </>
  );
}
function AttendanceCard({
  model,
  neutral,
  onLog,
}: {
  model: SubjectModel;
  neutral: number;
  onLog: () => void;
}) {
  const { colors } = useTheme();
  const status = subjectStatus(model);
  const ink = toneColors(colors, status.tone).fg;
  const weight = model.next?.countsAs ?? 1;
  const zone = {
    safe: "Safe",
    warning: "On the line",
    below: "At risk",
    noData: "No data yet",
  }[model.status];
  const scenario = (present: boolean) => {
    const a = model.attended + (present ? weight : 0),
      h = model.held + weight;
    return {
      value: percentNumber(a, h),
      tone: statusTone(attendanceStatus(a, h, model.target)),
    };
  };
  const attend = scenario(true),
    skip = scenario(false);
  return (
    <Card padding={20} gap={18} accessibilityLabel="Attendance">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
        <View
          accessible
          accessibilityLabel={
            model.held
              ? `${percentNumber(model.attended, model.held)} percent of ${model.target / 100} percent target`
              : "No counted classes yet"
          }
        >
          <TargetRing
            progress={model.progress}
            size={96}
            stroke={6}
            color={ink}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                fontSize: 21,
                lineHeight: 26,
                fontWeight: "600",
                maxWidth: 70,
                fontVariant: ["tabular-nums"],
              }}
            >
              {model.held ? `${percentNumber(model.attended, model.held)}%` : "—"}
            </Text>
            <Text variant="caption" secondary style={{ fontSize: 12 }}>
              of {model.target / 100}%
            </Text>
          </TargetRing>
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Pill label={zone} tone={status.tone} />
          <Text style={{ fontSize: 16, lineHeight: 22 }}>
            {status.sentence}
          </Text>
        </View>
      </View>
      <StatGrid
        items={[
          { value: model.attended, label: "Attended" },
          { value: model.missed, label: "Missed" },
          { value: neutral, label: "Neutral" },
          { value: model.held, label: "Counted" },
        ]}
      />
      {model.target > 0 && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(
            [
              ["Attend next class", attend],
              ["Skip next class", skip],
            ] as const
          ).map(([label, result]) => {
            const c = toneColors(colors, result.tone);
            return (
              <View
                key={label}
                accessible
                accessibilityLabel={`${label}: ${result.value} percent`}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: colors.separator,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ fontSize: 12, color: colors.textSecondary }}
                >
                  {label}
                </Text>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    color: c.fg,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {result.value}%
                  {weight > 1 && (
                    <Text style={{ fontSize: 12, fontWeight: "400", color: colors.textSecondary }}>
                      {`  ${weight} units`}
                    </Text>
                  )}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open attendance log"
        onPress={onLog}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          minHeight: 44,
          marginVertical: -8,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: "600",
            color: colors.accent,
          }}
        >
          Attendance log
        </Text>
        <Icon name={icons.chevronRight} size={14} color={colors.accent} />
      </Pressable>
    </Card>
  );
}
