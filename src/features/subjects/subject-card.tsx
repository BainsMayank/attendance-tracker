import { Link } from "expo-router";
import { Pressable, View } from "react-native";
import {
  Card,
  Icon,
  Pill,
  TargetRing,
  Text,
  icons,
  toneColors,
  useTheme,
} from "@/ui";
import type { SubjectModel } from "@/lib/subjects";
import { relativeClassTime, subjectStatus } from "./status";

export type SubjectAction = "actions" | "color" | "edit" | "archive";

/** Neutral count stepper: the count lives here, so the card needs no stat grid. */
export function Stepper({
  label,
  count,
  disabled,
  canDecrease,
  subject,
  onChange,
}: {
  label: "Attended" | "Missed";
  count: number;
  disabled: boolean;
  canDecrease: boolean;
  subject: string;
  onChange: (direction: 1 | -1) => void;
}) {
  const { colors } = useTheme();
  const noun = label === "Attended" ? "attended" : "missed";
  const button = (direction: 1 | -1) => {
    const off = disabled || (direction === -1 && !canDecrease);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${direction === 1 ? "Add" : "Remove"} one ${noun} class for ${subject}`}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => onChange(direction)}
        hitSlop={4}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 6,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.surfaceRaised : "transparent",
          opacity: off ? 0.35 : 1,
        })}
      >
        <Icon
          name={direction === 1 ? icons.plus : icons.minus}
          size={15}
          color={colors.textSecondary}
        />
      </Pressable>
    );
  };
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        height: 48,
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.separator,
        paddingHorizontal: 2,
      }}
    >
      {button(-1)}
      <View
        accessible
        accessibilityLabel={`${count} ${noun}`}
        style={{ flex: 1, alignItems: "center" }}
      >
        <Text
          style={{
            fontSize: 16,
            lineHeight: 20,
            fontWeight: "600",
            fontVariant: ["tabular-nums"],
          }}
        >
          {count}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontSize: 11, lineHeight: 14, color: colors.textSecondary }}
        >
          {label}
        </Text>
      </View>
      {button(1)}
    </View>
  );
}

export function SubjectCard({
  model,
  today,
  busy,
  readOnly,
  adjustmentsDisabled,
  onAction,
  onAdjust,
}: {
  model: SubjectModel;
  today: string;
  busy: boolean;
  readOnly: boolean;
  adjustmentsDisabled?: boolean;
  onAction: (action: SubjectAction) => void;
  onAdjust: (field: "attended" | "missed", direction: 1 | -1) => void;
}) {
  const { colors } = useTheme();
  const status = subjectStatus(model);
  const ink = toneColors(colors, status.tone).fg;
  const pct =
    model.held === 0 ? "—" : `${Math.round((model.attended / model.held) * 100)}%`;
  const meta = [
    model.subject.code,
    model.next
      ? `${relativeClassTime(model.next.date, model.next.startMinute, today)}${model.next.room ? `, ${model.next.room}` : ""}`
      : "No upcoming classes",
  ]
    .filter(Boolean)
    .join(" · ");
  const header = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${model.subject.name}, ${pct === "—" ? "no counted classes" : `${pct} attendance`}, target ${model.target / 100} percent. ${status.label}. ${meta}`}
      accessibilityHint="Opens subject details. Long press for subject actions."
      onLongPress={
        process.env.EXPO_OS !== "ios" ? () => onAction("actions") : undefined
      }
      style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
    >
      <TargetRing progress={model.progress} color={ink}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontSize: 13,
            fontWeight: "600",
            maxWidth: 40,
            fontVariant: ["tabular-nums"],
          }}
        >
          {pct}
        </Text>
      </TargetRing>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: "600" }}>
          {model.subject.name}
        </Text>
        <Text variant="caption" secondary numberOfLines={2}>
          {meta}
        </Text>
        <Pill label={status.label} tone={status.tone} />
      </View>
      <Icon name={icons.chevronRight} size={14} color={colors.textSecondary} />
    </Pressable>
  );
  const locked = readOnly || !!adjustmentsDisabled || busy;
  return (
    <Card gap={14}>
      <Link
        href={{
          pathname: "/subjects/[subjectId]",
          params: {
            subjectId: model.subject.id,
            semesterId: model.subject.semesterId,
          },
        }}
        asChild
      >
        <Link.Trigger>{header}</Link.Trigger>
        {process.env.EXPO_OS === "ios" && (
          <Link.Menu>
            <Link.MenuAction
              title="Edit subject"
              icon="pencil"
              disabled={readOnly || busy}
              onPress={() => onAction("edit")}
            />
            <Link.MenuAction
              title="Change color"
              icon="paintpalette"
              disabled={readOnly || busy}
              onPress={() => onAction("color")}
            />
            <Link.MenuAction
              title="Archive"
              icon="archivebox"
              disabled={readOnly || busy}
              onPress={() => onAction("archive")}
            />
          </Link.Menu>
        )}
      </Link>
      {!readOnly && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stepper
            label="Attended"
            count={model.attended}
            subject={model.subject.name}
            disabled={locked}
            canDecrease={model.attended > 0}
            onChange={(d) => onAdjust("attended", d)}
          />
          <Stepper
            label="Missed"
            count={model.missed}
            subject={model.subject.name}
            disabled={locked}
            canDecrease={model.missed > 0}
            onChange={(d) => onAdjust("missed", d)}
          />
        </View>
      )}
    </Card>
  );
}
