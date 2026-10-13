import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { addDays, attendanceStatus, dayNumber } from "@/lib/attendance";
import { resolveDay, type LogClass, type Status } from "@/lib/daily-log";
import { localToday } from "@/db/validation";
import {
  dayFingerprint,
  markAllPresent,
  markClass,
  toggleDayHoliday,
} from "@/db/repositories/daily-log";
import {
  ActionButton,
  Banner,
  Card,
  EmptyState,
  Eyebrow,
  GradientBackground,
  HeaderActions,
  Pill,
  ProgressLine,
  RoundButton,
  Skeleton,
  Text,
  contentStyle,
  icons,
  statusTone,
} from "@/ui";
import { useClock } from "@/features/timetable/hooks";
import { ErrorText } from "@/features/timetable/form-controls";
import { percentNumber, semesterCaption } from "@/features/subjects/status";
import { adjacentClassDay, useLogData, useLogMutation } from "./hooks";
import { ClassRow, type ClassStanding } from "./class-row";
import { useChromeInsets, useHeaderScrollEdge } from "@/features/shell/chrome";

export function dateTitle(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  },
) {
  return new Intl.DateTimeFormat(undefined, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export default function DailyLogScreen() {
  const params = useLocalSearchParams<{
    date?: string;
    semesterId?: string;
    subjectId?: string;
  }>();
  const [date, setDate] = useState(() =>
    localToday(Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  const { data, totals, error, loading, reload } = useLogData(
    date,
    params.semesterId,
  );
  const mutation = useLogMutation();
  const chrome = useChromeInsets();
  const scrollEdge = useHeaderScrollEdge();
  const initialized = useRef(false);
  const now = useClock();
  const today = data ? localToday(data.semester.timezone) : date;
  useEffect(() => {
    if (data && !initialized.current) {
      initialized.current = true;
      if (params.date) return;
      // The semester's timezone decides which day is "today".
      const frame = requestAnimationFrame(() =>
        setDate(localToday(data.semester.timezone)),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [data, params.date]);
  useEffect(() => {
    const routeDate = params.date;
    if (routeDate) {
      try {
        dayNumber(routeDate);
        const frame = requestAnimationFrame(() => {
          setDate(routeDate);
          initialized.current = true;
        });
        return () => cancelAnimationFrame(frame);
      } catch {
        /* Invalid deep-link dates leave the current day selected. */
      }
    }
  }, [params.date]);
  // The clock refreshes today/read-only state after midnight and app foreground.
  void now;
  const day = useMemo(
    () => (data ? resolveDay(data, date) : undefined),
    [data, date],
  );
  const subjects = useMemo(
    () => new Map(data?.subjects.map((s) => [s.id, s])),
    [data],
  );
  const totalsBySubject = useMemo(
    () => new Map(totals?.map((t) => [t.subjectId, t])),
    [totals],
  );
  const dayInput = useCallback(
    (onDate: string) => ({
      semesterId: data!.semester.id,
      date: onDate,
      expected: dayFingerprint(data!, onDate),
    }),
    [data],
  );
  const onMark = useCallback(
    (row: LogClass, status: Status | null) => {
      void mutation.run(
        () => markClass({ ...dayInput(date), key: row.key, status }),
        status ? `Marked ${status}` : "Mark cleared",
      );
    },
    [mutation, dayInput, date],
  );
  const onNote = useCallback(
    (row: LogClass) =>
      router.push({
        pathname: "/daily-log-note",
        params: { date, key: row.key, semesterId: data!.semester.id },
      }),
    [date, data],
  );
  const go = (next: string) => {
    if (!mutation.busy) {
      setDate(next);
      router.setParams({ date: next });
    }
  };
  const calendarButton = data && process.env.EXPO_OS !== "web" && (
    <HeaderActions
      right={[
        {
          label: "Jump to a date",
          icon: icons.calendar,
          accent: true,
          onPress: () =>
            router.push({
              pathname: "/daily-log-calendar",
              params: {
                date,
                semesterId: data.semester.id,
                subjectId: params.subjectId,
                returnTo: params.semesterId ? "detail" : "tab",
              },
            }),
        },
      ]}
    />
  );
  if (loading)
    return (
      <GradientBackground>
        <View style={[contentStyle, { paddingTop: 140 }]}>
          <Skeleton height={80} />
          <Skeleton height={200} />
        </View>
      </GradientBackground>
    );
  if (error || !data || !day)
    return (
      <GradientBackground>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[contentStyle, chrome]}
          onScroll={scrollEdge}
          scrollEventThrottle={16}
        >
          {error ? (
            <>
              <ErrorText message={error} />
              <ActionButton label="Retry" onPress={reload} />
            </>
          ) : (
            <EmptyState
              title="Start your semester"
              message="Create a semester and timetable to log your classes."
              action={{
                label: "Set up timetable",
                onPress: () => router.navigate("/timetable"),
              }}
            />
          )}
        </ScrollView>
      </GradientBackground>
    );
  const archived = data.semester.archivedAt !== null;
  const readOnly = day.outside || day.date > today || archived;
  const classes = params.subjectId
    ? day.classes.filter((c) => c.subjectId === params.subjectId)
    : day.classes;
  const eligible = classes.filter((c) => !c.holiday && !c.cancelled);
  const present = classes.filter((c) => c.status === "present").length;
  const absent = classes.filter((c) => c.status === "absent").length;
  const badge =
    day.date === today
      ? "Today"
      : day.date === addDays(today, 1)
        ? "Tomorrow"
        : day.date === addDays(today, -1)
          ? "Yesterday"
          : "";
  const standing = (row: LogClass): ClassStanding => {
    const subject = subjects.get(row.subjectId);
    const total = totalsBySubject.get(row.subjectId) ?? { attended: 0, held: 0 };
    const target = subject?.targetBps ?? data.semester.targetBps;
    const record = row.record;
    // Totals run through today, so they already include this day's saved marks.
    const counted = record && day.date <= today;
    const before = counted
      ? {
          attended: total.attended - record.attendedDelta,
          held: total.held - record.heldDelta,
        }
      : total;
    const tone = statusTone(
      attendanceStatus(total.attended, total.held, target),
    );
    if (row.holiday || row.cancelled)
      return {
        percent: percentNumber(total.attended, total.held),
        tone,
        delta: row.cancelled ? "Cancelled" : "Holiday",
      };
    if (!row.status)
      return {
        percent: percentNumber(total.attended, total.held),
        tone,
        delta: readOnly ? "" : "Not marked",
      };
    if (row.status === "neutral")
      return {
        percent: percentNumber(total.attended, total.held),
        tone,
        delta: "Not counted",
      };
    if (!before.held)
      return {
        percent: percentNumber(total.attended, total.held),
        tone,
        delta: "First class",
        deltaTone: row.status === "present" ? "ok" : "bad",
      };
    const diff =
      (total.attended / total.held - before.attended / before.held) * 100;
    return {
      percent: percentNumber(total.attended, total.held),
      tone,
      delta: `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)}`,
      deltaTone: diff >= 0 ? "ok" : "bad",
    };
  };
  const allPresent = () => {
    const overwrites = eligible.filter(
      (c) => c.status && c.status !== "present",
    ).length;
    const run = () =>
      void mutation.run(() => markAllPresent(dayInput(day.date)), "Day marked present");
    if (!overwrites) run();
    else
      Alert.alert(
        "Mark every class present?",
        `${overwrites} ${overwrites === 1 ? "class is" : "classes are"} already marked absent or neutral and will change to present.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Mark present", onPress: run },
        ],
      );
  };
  const holiday = () =>
    void mutation.run(
      () => toggleDayHoliday(dayInput(day.date)),
      day.holiday ? "Holiday removed" : "Marked as holiday",
    );
  const notice = day.outside
    ? `Outside ${data.semester.name} (${dateTitle(data.semester.startsOn)} – ${dateTitle(data.semester.endsOn)}). Nothing to log.`
    : archived
      ? "Archived semester · view only."
      : day.date > today
        ? "Upcoming day · you can mark it once it arrives."
        : !day.configured && !classes.length
          ? "No timetable for this date. Extra classes still appear here."
          : "";
  return (
    <GradientBackground>
      {calendarButton}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[contentStyle, chrome]}
        onScroll={scrollEdge}
        scrollEventThrottle={16}
      >
        <Eyebrow>
          {params.subjectId
            ? `${subjects.get(params.subjectId)?.name ?? "Subject"} only`
            : semesterCaption(data.semester, today)}
        </Eyebrow>
        <Card
          padding={10}
          gap={8}
          radius={12}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <RoundButton
            icon={icons.chevronLeft}
            label="Previous class day"
            variant="plain"
            disabled={mutation.busy}
            onPress={() =>
              go(adjacentClassDay(data.semester.id, day.date, -1))
            }
          />
          <View
            accessible
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${dateTitle(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${badge ? `, ${badge}` : ""}`}
            style={{ flex: 1, alignItems: "center" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: "600" }}>
                {dateTitle(day.date, { weekday: "long" })}
              </Text>
              {!!badge && <Pill label={badge} tone="accent" compact />}
            </View>
            <Text variant="caption" secondary>
              {dateTitle(day.date, { day: "numeric", month: "long", year: "numeric" })}
            </Text>
          </View>
          <RoundButton
            icon={icons.chevronRight}
            label="Next class day"
            variant="plain"
            disabled={mutation.busy}
            onPress={() => go(adjacentClassDay(data.semester.id, day.date, 1))}
          />
        </Card>
        {day.date !== today && !day.outside && (
          <View style={{ alignItems: "center", marginTop: -6 }}>
            <ActionButton
              label="Back to today"
              variant="tonal"
              style={{ minHeight: 36, paddingVertical: 6, borderRadius: 18 }}
              onPress={() => go(today)}
            />
          </View>
        )}
        {classes.length > 0 && (
          <View
            accessible
            accessibilityLabel={
              day.holiday
                ? "Holiday, nothing counted"
                : `${day.marked} of ${classes.length} marked, ${present} present, ${absent} absent`
            }
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 }}
          >
            <View style={{ flex: 1 }}>
              <ProgressLine
                height={6}
                value={
                  day.holiday
                    ? 1
                    : classes.filter((c) => c.status !== null).length / classes.length
                }
              />
            </View>
            <Text variant="caption" secondary>
              {day.holiday
                ? "Holiday · nothing counted"
                : `${classes.filter((c) => c.status !== null).length} of ${classes.length} marked · ${present} present · ${absent} absent`}
            </Text>
          </View>
        )}
        {!readOnly && !params.subjectId && classes.length > 0 && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <ActionButton
              label="Mark all present"
              icon={icons.check}
              style={{ flex: 1 }}
              disabled={mutation.busy || !eligible.length || day.holiday}
              onPress={allPresent}
            />
            <ActionButton
              label={day.holiday ? "Holiday" : "Mark holiday"}
              icon={icons.umbrella}
              variant={day.holiday ? "warning" : "secondary"}
              accessibilityState={{ selected: day.holiday }}
              style={{ flex: 1 }}
              disabled={mutation.busy}
              onPress={holiday}
            />
          </View>
        )}
        {day.holiday && (
          <Banner
            tone="warn"
            icon={icons.umbrella}
            action={
              readOnly || params.subjectId
                ? undefined
                : { label: "Undo", onPress: holiday, disabled: mutation.busy }
            }
          >
            Holiday. None of these classes count toward attendance.
          </Banner>
        )}
        {!!notice && (
          <Text variant="secondary" secondary style={{ paddingHorizontal: 4 }}>
            {notice}
          </Text>
        )}
        <ErrorText message={mutation.error} />
        {classes.map((row) => (
          <ClassRow
            key={row.key}
            row={row}
            name={subjects.get(row.subjectId)?.name ?? "Subject"}
            standing={standing(row)}
            disabled={readOnly}
            busy={mutation.busy}
            onMark={onMark}
            onNote={onNote}
          />
        ))}
        {!classes.length && (
          <Card padding={28} gap={6} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 17, fontWeight: "600" }}>
              {day.outside ? "Outside semester" : day.holiday ? "Day off" : "No classes"}
            </Text>
            <Text variant="caption" secondary style={{ textAlign: "center" }}>
              {day.outside
                ? "Use the arrows or calendar to return to your semester."
                : "Nothing is scheduled for this day."}
            </Text>
          </Card>
        )}
        {classes.length > 0 && (
          <Text variant="caption" secondary style={{ paddingHorizontal: 4 }}>
            Neutral is for cancelled classes, free periods or anything you
            don’t want counted.
          </Text>
        )}
        {!readOnly && (
          <ActionButton
            label="Extra class"
            icon={icons.plus}
            variant="secondary"
            disabled={
              mutation.busy ||
              !data.subjects.some((s) => s.archivedAt === null) ||
              !data.types.some((t) => t.archivedAt === null)
            }
            onPress={() =>
              router.push({
                pathname: "/daily-log-extra",
                params: { date: day.date, semesterId: data.semester.id },
              })
            }
          />
        )}
      </ScrollView>
    </GradientBackground>
  );
}
