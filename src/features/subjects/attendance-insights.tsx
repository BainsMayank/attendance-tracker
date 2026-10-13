import { Host, Slider } from "@expo/ui";
import { useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { Button, GlassCard, Text, useTheme } from "@/ui";
import { formatPercentage, dayNumber } from "@/lib/attendance";
import {
  attendanceTrend,
  planClasses,
  upcomingClasses,
} from "@/lib/attendance/insights";
import type { LogData } from "@/lib/daily-log";
import { dateInTimezone } from "@/features/timetable/hooks";

export function WhatIfPlanner({
  data,
  now,
  attended,
  held,
  subjectId,
}: {
  data: LogData;
  now: Date;
  attended: number;
  held: number;
  subjectId?: string;
}) {
  const { scheme, colors } = useTheme();
  const [skip, setSkip] = useState(0),
    [attend, setAttend] = useState(0);
  const local = dateInTimezone(now, data.semester.timezone);
  const upcoming = useMemo(
    () =>
      upcomingClasses(
        { ...data.semester, ...data },
        local.date,
        local.minute,
        subjectId,
      ).filter((c) => {
        // Today's later classes may already be logged. Frozen source lineage prevents counting them twice.
        return !data.records.some(
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
        );
      }),
    [data, local.date, local.minute, subjectId],
  );
  const target = subjectId
    ? (data.subjects.find((s) => s.id === subjectId)?.targetBps ??
      data.semester.targetBps)
    : data.semester.targetBps;
  return (
    <GlassCard solid>
      <Text variant="heading">What if?</Text>
      <Text secondary variant="secondary">
        Target {target / 100}% · {upcoming.length} upcoming classes
      </Text>
      {(
        [
          { mode: "skip", value: skip, set: setSkip, label: "Skip" },
          { mode: "attend", value: attend, set: setAttend, label: "Attend" },
        ] as const
      ).map((item) => {
        const count = Math.min(item.value, upcoming.length),
          result = planClasses(attended, held, upcoming, count, item.mode);
        return (
          <View key={item.mode} style={{ gap: 8 }}>
            <Text>
              {item.label} next {count} {count === 1 ? "class" : "classes"}
            </Text>
            <View accessibilityLabel={`${item.label} next classes`}>
              <Host
                matchContents={{ vertical: true }}
                colorScheme={scheme}
                seedColor={colors.accent}
                style={{ width: "100%", minHeight: 48 }}
              >
                <Slider
                  testID={`${item.mode}-classes`}
                  value={count}
                  min={0}
                  max={Math.max(1, upcoming.length)}
                  step={1}
                  disabled={!upcoming.length}
                  onValueChange={(v) => item.set(Math.round(v))}
                />
              </Host>
            </View>
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <Button
                label="−1 class"
                accessibilityLabel={`${item.label} one fewer class`}
                variant="secondary"
                disabled={count === 0}
                onPress={() => item.set(count - 1)}
              />
              <Button
                label="+1 class"
                accessibilityLabel={`${item.label} one more class`}
                variant="secondary"
                disabled={count === upcoming.length}
                onPress={() => item.set(count + 1)}
              />
            </View>
            <Text selectable accessibilityLiveRegion="polite">
              {formatPercentage(result.attended, result.held)} · {result.units}{" "}
              attendance units
              {result.nth
                ? ` · class ${count}: ${result.nth.date}`
                : " · current attendance"}
            </Text>
          </View>
        );
      })}
      {!upcoming.length && (
        <Text secondary>
          No remaining scheduled classes. Add or update your timetable to plan
          ahead.
        </Text>
      )}
      <Text secondary variant="caption">
        These are separate scenarios using saved attendance. Past unmarked
        classes are excluded. Dates without a timetable cannot be forecast.
        Holidays and cancelled classes are excluded; eligible extras are
        included.
      </Text>
    </GlassCard>
  );
}

export function AttendanceTrend({
  records,
  through,
  startsOn,
  endsOn,
  target,
}: {
  records: LogData["records"];
  through: string;
  startsOn: string;
  endsOn: string;
  target: number;
}) {
  const { colors } = useTheme();
  const [showValues, setShowValues] = useState(false);
  const points = useMemo(
    () => attendanceTrend(records, through),
    [records, through],
  );
  const valid = points.filter((p) => p.percentage !== null);
  const x = (date: string) =>
    16 +
    (288 * (dayNumber(date) - dayNumber(startsOn))) /
      Math.max(1, dayNumber(endsOn) - dayNumber(startsOn));
  const y = (p: number) => 116 - p;
  // Undefined denominator breaks the line; it never creates a fictional 0% point.
  const segments: string[][] = [[]];
  for (const p of points) {
    if (p.percentage === null) segments.push([]);
    else segments[segments.length - 1].push(`${x(p.date)},${y(p.percentage)}`);
  }
  return (
    <GlassCard solid>
      <Text variant="heading">Attendance trend</Text>
      <Text secondary variant="caption">
        Cumulative percentage · target {target / 100}% · 0–100% scale
      </Text>
      {valid.length ? (
        <>
          <View
            accessible
            accessibilityLabel={`Attendance trend. ${valid.length} dated values. Latest ${formatPercentage(valid[valid.length - 1].attended, valid[valid.length - 1].held)}. Use Show dated values for details.`}
          >
            <Svg width="100%" height={140} viewBox="0 0 320 140">
              {[0, 50, 100].map((p) => (
                <Line
                  key={p}
                  x1={16}
                  x2={304}
                  y1={y(p)}
                  y2={y(p)}
                  stroke={colors.separator}
                />
              ))}
              <Line
                x1={16}
                x2={304}
                y1={y(target / 100)}
                y2={y(target / 100)}
                stroke={colors.neutral}
                strokeDasharray="4 4"
              />
              {segments
                .filter((s) => s.length > 1)
                .map((s, i) => (
                  <Polyline
                    key={i}
                    points={s.join(" ")}
                    fill="none"
                    stroke={colors.accent}
                    strokeWidth={2.5}
                  />
                ))}
              {valid.map((p) => (
                <Circle
                  key={p.date}
                  cx={x(p.date)}
                  cy={y(p.percentage!)}
                  r={2.5}
                  fill={colors.accent}
                />
              ))}
            </Svg>
          </View>
          <Text secondary variant="caption">
            {startsOn} — {endsOn}
          </Text>
          <Button
            label={showValues ? "Hide dated values" : "Show dated values"}
            variant="secondary"
            onPress={() => setShowValues(!showValues)}
          />
          {showValues &&
            points.map((p) => (
              <Text key={p.date} selectable variant="secondary">
                {p.date} · {formatPercentage(p.attended, p.held)} · {p.attended}
                /{p.held} units
              </Text>
            ))}
        </>
      ) : (
        <Text secondary>
          No counted attendance yet. Your first mark starts the trend.
        </Text>
      )}
      <Text secondary variant="caption">
        Includes balance adjustments. Neutral classes add no units.
      </Text>
    </GlassCard>
  );
}
