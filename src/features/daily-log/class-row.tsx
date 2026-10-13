import { memo } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Card, Icon, Text, haptic, icons, toneColors, useTheme } from "@/ui";
import type { IconName, Tone } from "@/ui";
import type { LogClass, Status } from "@/lib/daily-log";
import { formatTime } from "@/lib/timetable";

export type ClassStanding = {
  /** Subject percentage with this class's saved mark applied. */
  percent: string;
  tone: Tone;
  /** Change caused by this mark, e.g. "▲ 0.8"; or a state label. */
  delta: string;
  deltaTone?: Tone;
};
const options: { status: Status; label: string; icon: IconName; tone: Tone }[] = [
  { status: "present", label: "Present", icon: icons.check, tone: "ok" },
  { status: "absent", label: "Absent", icon: icons.xmark, tone: "bad" },
  { status: "neutral", label: "Neutral", icon: icons.minusCircle, tone: "neutral" },
];

export const ClassRow = memo(function ClassRow({
  row,
  name,
  standing,
  disabled,
  busy,
  onMark,
  onNote,
}: {
  row: LogClass;
  name: string;
  standing: ClassStanding;
  disabled: boolean;
  busy: boolean;
  onMark: (row: LogClass, status: Status | null) => void;
  onNote: (row: LogClass) => void;
}) {
  const { colors } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const stacked = fontScale > 1.5 || width < 340;
  const locked = disabled || busy || row.holiday || row.cancelled;
  const ink = toneColors(colors, standing.tone).fg;
  const meta = [
    row.room,
    row.typeName,
    row.extraClassId ? "Extra" : "",
    row.countsAs > 1 ? `${row.countsAs} units` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card
      padding={14}
      gap={12}
      accessibilityLabel={`${name}, ${formatTime(row.startMinute)}`}
      style={{ opacity: row.holiday || row.cancelled ? 0.55 : 1 }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View style={{ width: 48 }}>
          <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
            {formatTime(row.startMinute)}
          </Text>
          <Text variant="caption" secondary style={{ fontVariant: ["tabular-nums"] }}>
            {formatTime(row.endMinute)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "600" }}>{name}</Text>
          {!!meta && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              {row.room && <Icon name={icons.pin} size={12} color={colors.textSecondary} />}
              <Text variant="caption" secondary style={{ flexShrink: 1 }}>
                {meta}
              </Text>
            </View>
          )}
        </View>
        <View
          accessible
          accessibilityLabel={`${name} at ${standing.percent} percent. ${standing.delta}`}
          style={{ alignItems: "flex-end" }}
        >
          <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "600", color: ink, fontVariant: ["tabular-nums"] }}>
            {standing.percent}
            {standing.percent !== "—" ? "%" : ""}
          </Text>
          <Text
            variant="caption"
            style={{
              color: standing.deltaTone
                ? toneColors(colors, standing.deltaTone).fg
                : colors.textSecondary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {standing.delta}
          </Text>
        </View>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={`Attendance for ${name}`}
        style={{ flexDirection: stacked ? "column" : "row", gap: 6 }}
      >
        {options.map((o) => {
          const on = row.status === o.status;
          const c = toneColors(colors, o.tone);
          return (
            <Pressable
              key={o.status}
              accessibilityRole="radio"
              accessibilityLabel={`${o.label}${on ? ". Tap again to clear" : ""}`}
              accessibilityState={{ checked: on, disabled: locked }}
              disabled={locked}
              onPress={() => {
                void haptic("light");
                onMark(row, on ? null : o.status);
              }}
              style={({ pressed }) => ({
                flex: stacked ? undefined : 1,
                minHeight: 44,
                borderRadius: 8,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: on ? c.fg : colors.separator,
                backgroundColor: on ? c.bg : colors.surface,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name={o.icon} size={14} color={on ? c.fg : colors.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: on ? "600" : "500", color: on ? c.fg : colors.textSecondary }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
        {!disabled && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={row.note ? `Edit note for ${name}` : `Add note for ${name}`}
            disabled={busy}
            onPress={() => onNote(row)}
            style={({ pressed }) => ({
              width: stacked ? undefined : 44,
              minHeight: 44,
              borderRadius: 8,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: row.note ? colors.accent : colors.separator,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name={icons.noteAdd} size={17} color={row.note ? colors.accent : colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {row.note && (
        <Text selectable variant="caption" secondary numberOfLines={3}>
          {row.note.body}
        </Text>
      )}
    </Card>
  );
});
