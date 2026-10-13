import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from "react-native-svg";
import { eq } from "drizzle-orm";
import {
  ActionButton,
  Banner,
  Card,
  FilterChip,
  GradientBackground,
  Group,
  GroupLabel,
  Skeleton,
  Text,
  icons,
  statusTone,
  toneColors,
  useTheme,
} from "@/ui";
import { getDatabase } from "@/db/client";
import * as s from "@/db/schema";
import { semestersRepository } from "@/db/repositories";
import { logRange } from "@/db/repositories/daily-log";
import { localToday } from "@/db/validation";
import {
  addDays,
  attendanceStatus,
  ledgerTotals,
  weekIndex,
} from "@/lib/attendance";
import { resolveDay } from "@/lib/daily-log";
import { ErrorText } from "@/features/timetable/form-controls";
import { errorMessage, subscribeTimetable } from "@/features/timetable/hooks";
import { percentNumber, shortDate } from "@/features/subjects/status";
import { dateTitle } from "@/features/daily-log/daily-log-screen";

type Semester = ReturnType<typeof semestersRepository.list>[number];

function load(semester: Semester) {
  const db = getDatabase();
  const records = db
    .select()
    .from(s.attendanceRecords)
    .where(eq(s.attendanceRecords.semesterId, semester.id))
    .all();
  const subjects = db
    .select()
    .from(s.subjects)
    .where(eq(s.subjects.semesterId, semester.id))
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const today = localToday(semester.timezone);
  const through = today < semester.endsOn ? today : semester.endsOn;
  const archived = semester.archivedAt !== null;
  const total = ledgerTotals(records, through);
  // One cumulative point per semester week, ending at the latest logged day.
  const weeks =
    through < semester.weekAnchor
      ? 0
      : weekIndex(semester.weekAnchor, through);
  const series: (number | null)[] = [];
  for (let w = 1; w <= weeks; w++) {
    const end = addDays(semester.weekAnchor, w * 7 - 1);
    const t = ledgerTotals(records, end < through ? end : through);
    series.push(t.held ? (t.attended / t.held) * 100 : null);
  }
  const before = addDays(through, -14);
  const bySubject = subjects
    .filter((x) => !x.archivedAt || records.some((r) => r.subjectId === x.id))
    .map((subject) => {
      const rows = records.filter((r) => r.subjectId === subject.id);
      const now = ledgerTotals(rows, through);
      const then = ledgerTotals(rows, before);
      const target = subject.targetBps ?? semester.targetBps;
      return {
        subject,
        now,
        tone: statusTone(attendanceStatus(now.attended, now.held, target)),
        trend:
          now.held && then.held
            ? (now.attended / now.held - then.attended / then.held) * 100
            : null,
      };
    });
  let recent: { date: string; marks: (string | null)[]; text: string }[] = [];
  if (!archived) {
    const data = logRange(semester.id, addDays(through, -27), through);
    for (let d = through; d >= addDays(through, -27) && recent.length < 5; d = addDays(d, -1)) {
      const day = resolveDay(data, d);
      if (!day.classes.length || day.outside) continue;
      const marks = day.classes.map((c) => (c.holiday ? "holiday" : c.status));
      const p = marks.filter((m) => m === "present").length,
        a = marks.filter((m) => m === "absent").length,
        u = marks.filter((m) => m === null).length;
      const text = day.holiday
        ? "Holiday"
        : u === marks.length
          ? "Not logged"
          : u
            ? `${marks.length - u} of ${marks.length} marked`
            : a === 0 && p
              ? "All present"
              : p === 0 && a
                ? "All absent"
                : `${p} present · ${a} absent`;
      recent.push({ date: d, marks, text });
    }
  } else recent = [];
  return { total, series, weeks, bySubject, recent, through, archived };
}

export function AttendanceHistoryScreen() {
  const params = useLocalSearchParams<{ view?: string; semesterId?: string }>();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const { colors } = useTheme();
  const reload = useCallback(() => {
    try {
      const list = semestersRepository
        .list()
        .sort(
          (a, b) =>
            Number(a.archivedAt !== null) - Number(b.archivedAt !== null) ||
            b.startsOn.localeCompare(a.startsOn),
        );
      setSemesters(list);
      setSelected(
        (current) =>
          (current && list.some((x) => x.id === current) ? current : undefined) ??
          params.semesterId ??
          (params.view === "archived"
            ? list.find((x) => x.archivedAt !== null)?.id
            : undefined) ??
          list[0]?.id,
      );
      setRevision((n) => n + 1);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [params.semesterId, params.view]);
  useFocusEffect(reload);
  useEffect(() => subscribeTimetable(reload), [reload]);
  const semester = semesters.find((x) => x.id === selected);
  const model = useMemo(() => {
    void revision;
    try {
      return semester ? load(semester) : null;
    } catch {
      return null;
    }
  }, [semester, revision]);
  return (
    <>
      <Stack.Screen options={{ title: "", headerLargeTitleEnabled: false }} />
      <GradientBackground>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
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
            style={{ marginHorizontal: 4, fontSize: 30, lineHeight: 36, fontWeight: "600", letterSpacing: -0.3 }}
          >
            Attendance history
          </Text>
          <ErrorText message={error} />
          {semesters.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityRole="radiogroup"
              contentContainerStyle={{ gap: 8 }}
            >
              {semesters.map((x) => (
                <FilterChip
                  key={x.id}
                  label={`${x.name}${x.archivedAt ? " · archived" : ""}`}
                  selected={x.id === selected}
                  onPress={() => setSelected(x.id)}
                />
              ))}
            </ScrollView>
          )}
          {!semesters.length && !error && (
            <Card padding={24}>
              <Text secondary>
                No semesters yet. Your history appears here once you start logging.
              </Text>
            </Card>
          )}
          {semester && !model && <Skeleton height={260} />}
          {semester && model && (
            <>
              {model.archived && (
                <Banner tone="neutral" icon={icons.archive}>
                  Archived semester · read-only
                </Banner>
              )}
              <Card padding={16} gap={14} style={{ paddingVertical: 18 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <View>
                    <Text variant="caption" secondary>
                      {shortDate(semester.startsOn)}
                      {semester.startsOn.slice(0, 4) !== semester.endsOn.slice(0, 4)
                        ? ` ${semester.startsOn.slice(0, 4)}`
                        : ""}{" "}
                      – {shortDate(semester.endsOn)} {semester.endsOn.slice(0, 4)}
                      {model.archived
                        ? " · final"
                        : model.weeks
                          ? ` · week ${model.weeks}`
                          : " · not started"}
                    </Text>
                    <Text
                      selectable
                      style={{ fontSize: 44, lineHeight: 50, fontWeight: "600", letterSpacing: -1, fontVariant: ["tabular-nums"] }}
                    >
                      {percentNumber(model.total.attended, model.total.held)}
                      {model.total.held > 0 && <Text style={{ fontSize: 22 }}>%</Text>}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                      {model.total.attended} of {model.total.held}
                    </Text>
                    <Text variant="caption" secondary>
                      classes attended
                    </Text>
                  </View>
                </View>
                <TrendChart series={model.series} target={semester.targetBps / 100} />
              </Card>

              <GroupLabel>By subject</GroupLabel>
              <Group>
                {model.bySubject.map((row) => {
                  const ink = toneColors(colors, row.tone).fg;
                  return (
                    <Pressable
                      key={row.subject.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${row.subject.name}, ${percentNumber(row.now.attended, row.now.held)} percent${row.trend !== null && !model.archived ? `, ${row.trend >= 0 ? "up" : "down"} ${Math.abs(row.trend).toFixed(1)} points in 2 weeks` : ""}`}
                      onPress={() =>
                        router.push({
                          pathname: "/subjects/[subjectId]",
                          params: { subjectId: row.subject.id, semesterId: semester.id },
                        })
                      }
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        minHeight: 50,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
                      })}
                    >
                      <Text style={{ flex: 1, fontSize: 15 }}>{row.subject.name}</Text>
                      <Text style={{ width: 60, textAlign: "right", fontWeight: "600", color: ink, fontVariant: ["tabular-nums"] }}>
                        {percentNumber(row.now.attended, row.now.held)}
                        {row.now.held ? "%" : ""}
                      </Text>
                      <Text
                        variant="caption"
                        style={{
                          width: 64,
                          textAlign: "right",
                          fontVariant: ["tabular-nums"],
                          color:
                            model.archived || row.trend === null || Math.abs(row.trend) < 0.05
                              ? colors.textSecondary
                              : row.trend > 0
                                ? colors.present
                                : colors.absent,
                        }}
                      >
                        {model.archived
                          ? "Final"
                          : row.trend === null
                            ? "—"
                            : Math.abs(row.trend) < 0.05
                              ? "— 2 wks"
                              : `${row.trend > 0 ? "▲" : "▼"} ${Math.abs(row.trend).toFixed(1)}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </Group>
              {!model.archived && (
                <Text variant="caption" secondary style={{ marginHorizontal: 16, marginTop: -8 }}>
                  Arrows show the change over the last two weeks.
                </Text>
              )}

              {model.recent.length > 0 && (
                <>
                  <GroupLabel>Recent days</GroupLabel>
                  <Group>
                    {model.recent.map((d) => (
                      <Pressable
                        key={d.date}
                        accessibilityRole="button"
                        accessibilityLabel={`${dateTitle(d.date, { weekday: "long", day: "numeric", month: "long" })}, ${d.text}`}
                        onPress={() =>
                          router.navigate({ pathname: "/daily-log", params: { date: d.date } })
                        }
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          minHeight: 50,
                          paddingVertical: 8,
                          paddingHorizontal: 14,
                          backgroundColor: pressed ? colors.surfaceRaised : "transparent",
                        })}
                      >
                        <Text style={{ width: 92, fontSize: 15, fontWeight: "600" }}>
                          {dateTitle(d.date, { weekday: "short", day: "numeric", month: "short" })}
                        </Text>
                        <View style={{ flex: 1, flexDirection: "row", gap: 3, flexWrap: "wrap" }}>
                          {d.marks.map((m, i) => (
                            <View
                              key={i}
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 4,
                                backgroundColor:
                                  m === "present"
                                    ? colors.present
                                    : m === "absent"
                                      ? colors.absent
                                      : m === "neutral" || m === "holiday"
                                        ? colors.neutralSubtle
                                        : "transparent",
                                borderWidth: m === null || m === "neutral" || m === "holiday" ? 1.5 : 0,
                                borderColor: m === null ? colors.separator : colors.neutral,
                              }}
                            />
                          ))}
                        </View>
                        <Text variant="caption" secondary>
                          {d.text}
                        </Text>
                      </Pressable>
                    ))}
                  </Group>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/daily-log-calendar",
                        params: { semesterId: semester.id, date: model.through },
                      })
                    }
                    style={{ alignSelf: "center", minHeight: 44, justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.accent }}>
                      Open full calendar
                    </Text>
                  </Pressable>
                </>
              )}
              <ActionButton
                label="Export as CSV or PDF"
                icon={icons.export}
                variant="secondary"
                onPress={() => router.push("/settings-export")}
              />
            </>
          )}
        </ScrollView>
      </GradientBackground>
    </>
  );
}

function TrendChart({ series, target }: { series: (number | null)[]; target: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const valid = series.filter((v): v is number => v !== null);
  if (!valid.length)
    return (
      <Text secondary variant="secondary">
        No counted classes yet. Your first mark starts the trend.
      </Text>
    );
  const low = Math.max(0, Math.min(60, Math.floor((Math.min(...valid, target) - 5) / 10) * 10));
  const steps = [100, low + ((100 - low) * 3) / 4, low + (100 - low) / 2, low + (100 - low) / 4, low];
  const H = 150,
    left = 34,
    right = Math.max(left + 1, width - 4),
    top = 10;
  const y = (v: number) => top + ((100 - v) / (100 - low)) * (H - top);
  const n = series.length;
  const x = (i: number) => (n === 1 ? (left + right) / 2 : left + (i * (right - left)) / (n - 1));
  const points = series
    .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean) as string[];
  const firstIndex = series.findIndex((v) => v !== null);
  const lastIndex = n - 1 - [...series].reverse().findIndex((v) => v !== null);
  const last = series[lastIndex]!;
  const first = series[firstIndex]!;
  const alt = `Overall attendance started at ${first.toFixed(1)}% in week ${firstIndex + 1} and is ${last.toFixed(1)}% in week ${lastIndex + 1}, ${last >= target ? "at or above" : "below"} the ${target}% target.`;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={alt} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={H + 22}>
          {steps.map((v) => (
            <Line key={v} x1={left} x2={right} y1={y(v)} y2={y(v)} stroke={colors.separator} strokeWidth={1} />
          ))}
          {steps.map((v) => (
            <SvgText key={`t${v}`} x={0} y={y(v) + 3} fontSize={10} fontWeight="600" fill={colors.textSecondary}>
              {`${Math.round(v)}%`}
            </SvgText>
          ))}
          {target > low && target < 100 && (
            <>
              <Line x1={left} x2={right} y1={y(target)} y2={y(target)} stroke={colors.warning} strokeWidth={1.5} strokeDasharray="5 4" />
              <SvgText x={right} y={y(target) - 4} fontSize={10} fontWeight="700" fill={colors.warning} textAnchor="end">
                {`Target ${target}%`}
              </SvgText>
            </>
          )}
          {points.length > 1 && (
            <Polygon
              points={`${x(firstIndex)},${y(low)} ${points.join(" ")} ${x(lastIndex)},${y(low)}`}
              fill={colors.accentSubtle}
              opacity={0.8}
            />
          )}
          {points.length > 1 && (
            <Polyline points={points.join(" ")} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          )}
          <Circle cx={x(lastIndex)} cy={y(last)} r={4.5} fill={colors.accent} stroke={colors.surface} strokeWidth={2} />
          <SvgText x={left} y={H + 18} fontSize={10} fontWeight="600" fill={colors.textSecondary}>
            Wk 1
          </SvgText>
          <SvgText x={right} y={H + 18} fontSize={10} fontWeight="600" fill={colors.textSecondary} textAnchor="end">
            {`Wk ${n}`}
          </SvgText>
        </Svg>
      )}
      <Text variant="caption" secondary style={{ marginTop: 8 }}>
        {alt}
      </Text>
    </View>
  );
}
