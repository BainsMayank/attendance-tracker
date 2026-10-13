import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { attendanceRecords } from "@/db/schema";
import { logRange } from "@/db/repositories/daily-log";
import { addDays, calendarDaysBetween, weekday } from "@/lib/attendance";
import { monthBounds, type LogData } from "@/lib/daily-log";
import { subjectDay } from "@/lib/subject-history";
import { Button, GlassCard, Skeleton, Text, useTheme } from "@/ui";
import { ErrorText } from "@/features/timetable/form-controls";
import { subscribeTimetable, errorMessage } from "@/features/timetable/hooks";
import { AttendanceTrend } from "./attendance-insights";

export function SubjectHistory({
  semesterId,
  subjectId,
  today,
  header,
}: {
  semesterId: string;
  subjectId: string;
  today: string;
  header: ReactNode;
}) {
  const [month, setMonth] = useState("");
  const [snapshot, setSnapshot] = useState<{
    data: LogData;
    records: LogData["records"];
  }>();
  const [error, setError] = useState("");
  const { colors } = useTheme();
  const reload = useCallback(() => {
    try {
      const base = logRange(
        semesterId,
        month || today,
        month || today,
        undefined,
        false,
      );
      const selected =
        month ||
        (today < base.semester.startsOn
          ? base.semester.startsOn
          : today > base.semester.endsOn
            ? base.semester.endsOn
            : today);
      const bounds = monthBounds(selected);
      const data = logRange(semesterId, bounds.start, bounds.end);
      data.records = data.records.filter((r) => r.subjectId === subjectId);
      const records = getDatabase()
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.semesterId, semesterId),
            eq(attendanceRecords.subjectId, subjectId),
          ),
        )
        .all();
      setSnapshot({ data, records });
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [semesterId, subjectId, month, today]);
  useFocusEffect(reload);
  useEffect(() => subscribeTimetable(reload), [reload]);
  if (!snapshot)
    return (
      <View style={{ padding: 20, gap: 16 }}>
        <ErrorText message={error} />
        {error ? (
          <Button label="Retry" onPress={reload} />
        ) : (
          <Skeleton height={300} />
        )}
      </View>
    );
  const { data, records } = snapshot;
  const chosen =
    month ||
    (today < data.semester.startsOn
      ? data.semester.startsOn
      : today > data.semester.endsOn
        ? data.semester.endsOn
        : today);
  const bounds = monthBounds(chosen);
  const cells = Array.from(
    {
      length:
        Math.ceil(
          (weekday(bounds.start) -
            1 +
            calendarDaysBetween(bounds.start, bounds.end) +
            1) /
            7,
        ) * 7,
    },
    (_, i) => addDays(bounds.start, i - weekday(bounds.start) + 1),
  );
  const styles = {
    present: [colors.presentSubtle, colors.present, "P"],
    absent: [colors.absentSubtle, colors.absent, "A"],
    neutral: [colors.neutralSubtle, colors.neutral, "N"],
    holiday: [colors.neutralSubtle, colors.neutral, "H"],
    mixed: [colors.warningSubtle, colors.warning, "P/A"],
    pending: [colors.surface, colors.textSecondary, "?"],
    noClasses: [colors.surfaceRaised, colors.textMuted, "—"],
    outside: [colors.surfaceRaised, colors.textMuted, "—"],
    unconfigured: [colors.surfaceRaised, colors.textMuted, "?"],
  };
  const jump = (date: string) =>
    router.push({
      pathname: "/attendance-day",
      params: { date, semesterId, subjectId },
    });
  const rows = records
    .filter((r) => r.onDate >= bounds.start && r.onDate <= bounds.end)
    .sort(
      (a, b) =>
        b.onDate.localeCompare(a.onDate) ||
        b.createdAt - a.createdAt ||
        b.id.localeCompare(a.id),
    );
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 48,
        gap: 16,
        width: "100%",
        maxWidth: 680,
        alignSelf: "center",
      }}
      ListHeaderComponent={
        <View style={{ gap: 24 }}>
          {header}
          <ErrorText message={error} />
          <AttendanceTrend
            records={records}
            through={
              data.semester.archivedAt !== null ? data.semester.endsOn : today
            }
            startsOn={data.semester.startsOn}
            endsOn={data.semester.endsOn}
            target={
              data.subjects.find((s) => s.id === subjectId)?.targetBps ??
              data.semester.targetBps
            }
          />
          <GlassCard solid>
            <Text variant="heading">Attendance history</Text>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <Button
                label="Previous month"
                variant="secondary"
                disabled={
                  bounds.start <= data.semester.startsOn.slice(0, 7) + "-01"
                }
                onPress={() => setMonth(bounds.previous)}
              />
              <Text>{bounds.start.slice(0, 7)}</Text>
              <Button
                label="Next month"
                variant="secondary"
                disabled={
                  bounds.start >= data.semester.endsOn.slice(0, 7) + "-01"
                }
                onPress={() => setMonth(bounds.next)}
              />
            </View>
            <View style={{ marginHorizontal: -12 }}>
              <View style={{ flexDirection: "row" }}>
                {["M", "T", "W", "T", "F", "S", "S"].map((v, i) => (
                  <Text
                    key={i}
                    secondary
                    variant="caption"
                    style={{ width: "14.285714%", textAlign: "center" }}
                  >
                    {v}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {cells.map((date) => {
                  const day = subjectDay(data, date, subjectId),
                    [backgroundColor, color, symbol] = styles[day.state];
                  const disabled =
                    date.slice(0, 7) !== bounds.start.slice(0, 7) ||
                    day.state === "outside";
                  return (
                    <Pressable
                      key={date}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityLabel={`${date}, ${day.state}, ${day.present} present, ${day.absent} absent, ${day.pending} unmarked${date > today || data.semester.archivedAt !== null ? ", read-only" : ", open Daily Log to edit"}`}
                      style={({ pressed }) => ({
                        width: "14.285714%",
                        minHeight: 60,
                        padding: 3,
                        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
                      })}
                      onPress={() => jump(date)}
                    >
                      <View
                        style={{
                          backgroundColor,
                          borderRadius: 8,
                          minHeight: 54,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: date === today ? 1 : 0,
                          borderColor: colors.accent,
                        }}
                      >
                        <Text variant="secondary" style={{ color }}>
                          {Number(date.slice(-2))}
                        </Text>
                        <Text variant="caption" style={{ color }}>
                          {symbol}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Text secondary variant="caption">
              P present · A absent · N neutral · H holiday · P/A mixed · ?
              pending or no timetable · — no class. Tap a day for Daily Log.
            </Text>
          </GlassCard>
          <Text variant="heading">This month’s records</Text>
        </View>
      }
      ListEmptyComponent={
        <Text secondary>No attendance records in this month.</Text>
      }
      renderItem={({ item }) => (
        <GlassCard solid>
          <Text selectable>
            {item.onDate} ·{" "}
            {item.kind === "adjustment" ? "Balance adjustment" : item.status}
          </Text>
          <Text secondary>
            {item.kind === "adjustment"
              ? `${item.attendedDelta >= 0 ? "+" : ""}${item.attendedDelta} attended / ${item.heldDelta >= 0 ? "+" : ""}${item.heldDelta} total · ${item.reason}`
              : `${item.classTypeName} · ${item.countsAs} units`}
          </Text>
          <Button
            label="Open day in Daily Log"
            variant="secondary"
            onPress={() => jump(item.onDate)}
          />
        </GlassCard>
      )}
    />
  );
}
