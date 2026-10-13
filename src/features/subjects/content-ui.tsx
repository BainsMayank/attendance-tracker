import { useEffect, useRef, type PropsWithChildren } from "react";
import { Pressable, View } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Text, useTheme } from "@/ui";
import { completion, type NoteLine } from "./content-model";

export function ProgressBar({
  rows,
  label,
}: {
  rows: { completedAt: number | null }[];
  label: string;
}) {
  const { colors } = useTheme(),
    value = completion(rows);
  return (
    <View
      style={{ gap: 8 }}
      accessible
      accessibilityLabel={`${label}: ${value.done} of ${value.total} topics done${value.percent === null ? "" : `, ${Math.round(value.percent)} percent`}`}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text variant="secondary" secondary>
          {label}
        </Text>
        <Text
          variant="secondary"
          selectable
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {value.percent === null
            ? "No topics"
            : `${Math.round(value.percent)}% · ${value.done}/${value.total}`}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          backgroundColor: colors.surfaceRaised,
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${value.percent ?? 0}%`,
            borderRadius: 3,
            backgroundColor: colors.accent,
          }}
        />
      </View>
    </View>
  );
}
export function ToolIcon({
  kind,
  filled = false,
}: {
  kind: "check" | "star" | "grip" | "youtube" | "drive" | "pdf" | "web";
  filled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.accent}
      strokeWidth={1.8}
      accessible={false}
    >
      {kind === "check" ? (
        <>
          <Rect
            x={3}
            y={3}
            width={18}
            height={18}
            rx={5}
            fill={filled ? colors.accent : colors.surface}
          />
          {filled && (
            <Path
              d="m7 12 3 3 7-7"
              stroke={colors.onAccent}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </>
      ) : kind === "star" ? (
        <Path
          d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"
          fill={filled ? colors.accent : "none"}
          strokeLinejoin="round"
        />
      ) : kind === "grip" ? (
        <Path d="M7 7h10M7 12h10M7 17h10" strokeLinecap="round" />
      ) : kind === "youtube" ? (
        <>
          <Rect x={2} y={5} width={20} height={14} rx={4} />
          <Path d="m10 9 5 3-5 3Z" fill={colors.accent} />
        </>
      ) : kind === "drive" ? (
        <>
          <Path d="m9 3 6 0 8 14-3 4H4l-3-4Z" strokeLinejoin="round" />
          <Path d="m9 3 8 14H1m14-14L5 21" />
        </>
      ) : kind === "pdf" ? (
        <>
          <Path d="M5 2h9l5 5v15H5ZM14 2v6h5" />
          <Path d="M8 12h8M8 16h6" />
        </>
      ) : (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z" />
        </>
      )}
    </Svg>
  );
}
export function CompletionCheck({
  checked,
  label,
  onPress,
  disabled,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { reduceMotion } = useTheme();
  const scale = useSharedValue(1);
  const previous = useRef(checked);
  useEffect(() => {
    if (checked && !previous.current && !reduceMotion)
      scale.set(
        withSequence(
          withTiming(1.18, {
            duration: 100,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
          withTiming(1, {
            duration: 150,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
        ),
      );
    else scale.set(1);
    previous.current = checked;
  }, [checked, reduceMotion, scale]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minWidth: 48,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View style={style}>
        <ToolIcon kind="check" filled={checked} />
      </Animated.View>
    </Pressable>
  );
}
export function InlineBold({ children }: { children: string }) {
  return (
    <Text selectable>
      {children.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <Text key={index} style={{ fontWeight: "600" }}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
export function NoteBodyLine({
  line,
  onToggle,
  disabled = false,
}: {
  line: NoteLine;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
      {line.type === "check" ? (
        <CompletionCheck
          checked={line.checked}
          label={line.text.replace(/\*\*/g, "")}
          disabled={disabled || !onToggle}
          onPress={() => onToggle?.()}
        />
      ) : line.type === "bullet" ? (
        <Text style={{ paddingTop: 2 }}>•</Text>
      ) : null}
      <View
        style={{
          flex: 1,
          paddingTop: line.type === "check" ? 12 : 0,
        }}
      >
        <InlineBold>{line.text || " "}</InlineBold>
      </View>
    </View>
  );
}
export function RowActions({ children }: PropsWithChildren) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {children}
    </View>
  );
}
