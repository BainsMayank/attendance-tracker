import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import {
  addDays,
  calendarDaysBetween,
  dayNumber,
  weekday,
} from "@/lib/attendance";
import { monthBounds, resolveDay, type LogData } from "@/lib/daily-log";
import { localToday } from "@/db/validation";
import {
  ActionButton,
  Card,
  RoundButton,
  Skeleton,
  Text,
  icons,
  useTheme,
  HeaderActions,
} from "@/ui";
import { ErrorText } from "@/features/timetable/form-controls";
import { useLogData } from "./hooks";
import { dateTitle } from "./daily-log-screen";

type Mark = "P" | "M" | "A" | "H" | "U" | null;
function summarize(data: LogData, date: string, today: string, subjectId?: string) {
  const day = resolveDay(data, date);
  const classes = subjectId
    ? day.classes.filter((c) => c.subjectId === subjectId)
    : day.classes;
  const holiday = data.holidays.find(
    (h) => h.subjectId === null && h.startsOn <= date && date <= h.endsOn,
  );
  const present = classes.filter((c) => c.status === "present" && !c.holiday).length;
  const absent = classes.filter((c) => c.status === "absent").length;
  const pending = classes.filter((c) => c.status === null).length;
  const n = classes.length;
  const plural = `${n} ${n === 1 ? "class" : "classes"}`;
  let mark: Mark = null,
    info: string;
  if (day.outside) info = "Outside this semester";
  else if (day.holiday && classes.every((c) => c.holiday)) {
    mark = "H";
    info = `Holiday${holiday?.title ? ` · ${holiday.title}` : ""}`;
  } else if (!n) info = "No classes";
  else if (date > today) info = `Upcoming · ${plural}`;
  else if (pending === n) {
    mark = "U";
    info = `${date === today ? "Today · " : ""}${plural} · not logged yet`;
  } else if (pending) {
    mark = "M";
    info = `${date === today ? "Today · " : ""}${plural} · ${n - pending} marked, ${pending} to go`;
  } else if (absent && present) {
    mark = "M";
    info = `${plural} · ${present} present, ${absent} absent`;
  } else if (absent) {
    mark = "A";
    info = `${plural} · all absent`;
  } else if (present) {
    mark = "P";
    info = `${plural} · all present`;
  } else info = `${plural} · not counted`;
  return { mark, info, present, absent, holiday: mark === "H", outside: day.outside, empty: !n };
}
function Marker({ mark, inverse }: { mark: Mark; inverse?: boolean }) {
  const { colors } = useTheme();
  const base = { width: 7, height: 7 };
  if (mark === "P")
    return <View style={{ ...base, borderRadius: 4, backgroundColor: inverse ? colors.onAccent : colors.present }} />;
  if (mark === "M")
    return <View style={{ ...base, borderRadius: 4, borderWidth: 2, borderColor: inverse ? colors.onAccent : colors.warning }} />;
  if (mark === "A")
    return <View style={{ width: 10, height: 3, marginVertical: 2, borderRadius: 2, backgroundColor: inverse ? colors.onAccent : colors.absent }} />;
  if (mark === "H")
    return <View style={{ ...base, borderRadius: 2, borderWidth: 2, borderColor: inverse ? colors.onAccent : colors.neutral }} />;
  if (mark === "U")
    return <View style={{ ...base, borderRadius: 4, borderWidth: 1, borderColor: inverse ? colors.onAccent : colors.textSecondary }} />;
  return <View style={base} />;
}

export default function CalendarScreen() {
  const params = useLocalSearchParams<{
    date?: string;
    semesterId?: string;
    subjectId?: string;
    returnTo?: string;
  }>();
  const [selected, setSelected] = useState(() => {
    try {
      if (params.date) {
        dayNumber(params.date);
        return params.date;
      }
    } catch {}
    return localToday(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
  const [month, setMonth] = useState(monthBounds(selected).start);
  const { data, loading, error, reload } = useLogData(month, params.semesterId);
  const { colors } = useTheme();
  const bounds = monthBounds(month);
  const today = data ? localToday(data.semester.timezone) : selected;
  const lead = weekday(bounds.start) - 1;
  const days = calendarDaysBetween(bounds.start, bounds.end) + 1;
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => addDays(bounds.start, i)),
  ];
  while (cells.length % 7) cells.push(null);
  const open = (date: string) =>
    router.dismissTo({
      pathname: params.returnTo === "detail" ? "/attendance-day" : "/daily-log",
      params: { date, semesterId: params.semesterId, subjectId: params.subjectId },
    });
  const goToday = () => {
    setSelected(today);
    setMonth(monthBounds(today).start);
  };
  const summaries =
    data && cells.map((d) => (d ? summarize(data, d, today, params.subjectId) : null));
  const chosen =
    data && selected.slice(0, 7) === month.slice(0, 7)
      ? summarize(data, selected, today, params.subjectId)
      : null;
  const totals = summaries
    ? cells.reduce(
        (acc, d, i) => {
          const s = summaries[i];
          if (!d || !s || d > today) return acc;
          acc.present += s.present;
          acc.absent += s.absent;
          acc.holiday += s.holiday ? 1 : 0;
          return acc;
        },
        { present: 0, absent: 0, holiday: 0 },
      )
    : null;
  const monthName = dateTitle(month, { month: "long" });
  return (
    <>
      <Stack.Screen options={{ title: "Jump to date", headerLargeTitleEnabled: false }} />
      {process.env.EXPO_OS !== "web" && (
        <HeaderActions
          left={[{ label: "Today", prominent: true, onPress: goToday }]}
          right={[{ label: "Close", icon: icons.xmark, onPress: () => router.back() }]}
        />
      )}
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
      >
        <Card radius={12} padding={10} gap={6} style={{ paddingTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <RoundButton
              icon={icons.chevronLeft}
              label="Previous month"
              variant="plain"
              onPress={() => setMonth(bounds.previous)}
            />
            <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "600" }}>
              {dateTitle(month, { month: "long", year: "numeric" })}
            </Text>
            <RoundButton
              icon={icons.chevronRight}
              label="Next month"
              variant="plain"
              onPress={() => setMonth(bounds.next)}
            />
          </View>
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={{ flexDirection: "row", paddingBottom: 4 }}
          >
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
              <Text
                key={d}
                style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600", color: colors.textSecondary }}
              >
                {d}
              </Text>
            ))}
          </View>
          {loading ? (
            <Skeleton height={280} />
          ) : error ? (
            <View style={{ gap: 12, padding: 8 }}>
              <ErrorText message={error} />
              <ActionButton label="Retry" onPress={reload} />
            </View>
          ) : !data ? (
            <Text secondary style={{ padding: 8 }}>
              Create a semester to view its calendar.
            </Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {cells.map((date, i) => {
                if (!date)
                  return <View key={`blank-${i}`} style={{ width: "14.2857%", height: 50 }} />;
                const s = summaries![i]!;
                const isSel = date === selected,
                  isToday = date === today;
                const muted = s.outside || s.empty;
                return (
                  <View key={date} style={{ width: "14.2857%", padding: 2 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${dateTitle(date, { weekday: "long", day: "numeric", month: "long" })}, ${s.info}`}
                      accessibilityState={{ selected: isSel }}
                      onPress={() => setSelected(date)}
                      style={({ pressed }) => ({
                        height: 50,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        backgroundColor: isSel ? colors.accent : "transparent",
                        borderWidth: isToday && !isSel ? 2 : 0,
                        borderColor: colors.accent,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: muted && !isToday ? "400" : "600",
                          color: isSel
                            ? colors.onAccent
                            : isToday
                              ? colors.accent
                              : muted
                                ? colors.textSecondary
                                : colors.textPrimary,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {Number(date.slice(-2))}
                      </Text>
                      <Marker mark={s.mark} inverse={isSel} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 8, paddingHorizontal: 6 }}>
          {(
            [
              ["P", "All present"],
              ["M", "Mixed or partly logged"],
              ["A", "Absent"],
              ["H", "Holiday"],
              ["U", "Not logged"],
            ] as [Mark, string][]
          ).map(([mark, label]) => (
            <View key={label} style={{ width: "50%", flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Marker mark={mark} />
              <Text variant="caption" secondary>
                {label}
              </Text>
            </View>
          ))}
        </View>
        {chosen && (
          <Card radius={12} gap={12}>
            <View>
              <Text style={{ fontSize: 17, fontWeight: "600" }}>
                {dateTitle(selected, { weekday: "long", day: "numeric", month: "long" })}
              </Text>
              <Text secondary variant="secondary">
                {chosen.info}
              </Text>
            </View>
            <ActionButton
              label="Open this day"
              disabled={chosen.outside}
              onPress={() => open(selected)}
            />
          </Card>
        )}
        {totals && (
          <Text variant="caption" secondary style={{ textAlign: "center" }}>
            {monthName} {month <= today && today <= bounds.end ? "so far" : ""} ·{" "}
            {totals.present} present · {totals.absent} absent · {totals.holiday}{" "}
            {totals.holiday === 1 ? "holiday" : "holidays"}
          </Text>
        )}
      </ScrollView>
    </>
  );
}
