import {
  Children,
  Fragment,
  isValidElement,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  Switch as NativeSwitch,
  View,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Host, Switch as UISwitch } from "@expo/ui";
import Svg, { Circle } from "react-native-svg";
import { Text } from "./text";
import { useTheme } from "./theme-provider";
import type { Palette } from "./tokens";

/** Status tones shared by every attendance surface. Colors never appear without a text label. */
export type Tone = "ok" | "warn" | "bad" | "neutral" | "accent";
export function toneColors(colors: Palette, tone: Tone) {
  return {
    ok: { fg: colors.present, bg: colors.presentSubtle },
    warn: { fg: colors.warning, bg: colors.warningSubtle },
    bad: { fg: colors.absent, bg: colors.absentSubtle },
    neutral: { fg: colors.neutral, bg: colors.neutralSubtle },
    accent: { fg: colors.accent, bg: colors.accentSubtle },
  }[tone];
}
export function statusTone(
  status: "safe" | "warning" | "below" | "noData",
): Tone {
  return { safe: "ok", warning: "warn", below: "bad", noData: "neutral" }[
    status
  ] as Tone;
}

export type IconName = { ios: string; android: string };
export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={
        {
          ios: name.ios,
          android: name.android,
          web: name.android,
        } as SymbolViewProps["name"]
      }
      size={size}
      tintColor={color ?? colors.textPrimary}
      accessible={false}
    />
  );
}
export const icons = {
  plus: { ios: "plus", android: "add" },
  minus: { ios: "minus", android: "remove" },
  chevronRight: { ios: "chevron.right", android: "chevron_right" },
  chevronLeft: { ios: "chevron.left", android: "chevron_left" },
  calendar: { ios: "calendar", android: "calendar_month" },
  calendarCheck: { ios: "calendar.badge.checkmark", android: "event_available" },
  check: { ios: "checkmark", android: "check" },
  checkCircle: { ios: "checkmark.circle.fill", android: "check_circle" },
  xmark: { ios: "xmark", android: "close" },
  minusCircle: { ios: "minus.circle", android: "do_not_disturb_on" },
  pencil: { ios: "pencil", android: "edit" },
  star: { ios: "star", android: "star_outline" },
  starFill: { ios: "star.fill", android: "star" },
  folder: { ios: "folder", android: "folder" },
  folderAdd: { ios: "folder.badge.plus", android: "create_new_folder" },
  doc: { ios: "doc", android: "description" },
  photo: { ios: "photo.on.rectangle", android: "photo_library" },
  camera: { ios: "camera", android: "photo_camera" },
  search: { ios: "magnifyingglass", android: "search" },
  ellipsis: { ios: "ellipsis", android: "more_horiz" },
  pin: { ios: "mappin", android: "location_on" },
  sun: { ios: "sun.max", android: "light_mode" },
  note: { ios: "note.text", android: "sticky_note_2" },
  noteAdd: { ios: "square.and.pencil", android: "edit_note" },
  link: { ios: "arrow.up.right", android: "open_in_new" },
  copy: { ios: "doc.on.doc", android: "content_copy" },
  paste: { ios: "doc.on.clipboard", android: "content_paste" },
  sparkles: { ios: "camera.viewfinder", android: "document_scanner" },
  lock: { ios: "lock.shield", android: "shield_lock" },
  warning: { ios: "exclamationmark.triangle", android: "warning" },
  archive: { ios: "archivebox", android: "inventory_2" },
  export: { ios: "square.and.arrow.up", android: "ios_share" },
  iphone: { ios: "iphone", android: "smartphone" },
  bell: { ios: "bell.badge", android: "notifications" },
  target: { ios: "scope", android: "track_changes" },
  umbrella: { ios: "beach.umbrella", android: "beach_access" },
  chart: { ios: "chart.line.uptrend.xyaxis", android: "show_chart" },
  clock: { ios: "clock.arrow.circlepath", android: "history" },
  backup: { ios: "externaldrive.badge.checkmark", android: "backup" },
  restore: { ios: "arrow.counterclockwise", android: "settings_backup_restore" },
  palette: { ios: "paintpalette", android: "palette" },
  moon: { ios: "circle.lefthalf.filled", android: "contrast" },
  haptics: { ios: "iphone.radiowaves.left.and.right", android: "vibration" },
  hand: { ios: "hand.raised", android: "pan_tool" },
  feedback: { ios: "envelope", android: "mail" },
  info: { ios: "info.circle", android: "info" },
  reset: { ios: "arrow.uturn.backward.circle", android: "restart_alt" },
  timer: { ios: "timer", android: "timer" },
  book: { ios: "book.closed", android: "menu_book" },
  plusCircle: { ios: "plus.circle", android: "add_circle" },
} satisfies Record<string, IconName>;

export function Card({
  children,
  style,
  padding = 16,
  gap = 12,
  radius = 12,
  ...props
}: ViewProps & { padding?: number; gap?: number; radius?: number }) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius,
          borderCurve: "continuous",
          padding,
          gap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Quiet status label: a small tone dot and tone-colored text, no fill. */
export function Pill({
  label,
  tone,
  compact = false,
}: {
  label: string;
  tone: Tone;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const c = toneColors(colors, tone);
  return (
    <View
      style={{
        alignSelf: compact ? "center" : "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      {!compact && (
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }}
        />
      )}
      <Text
        style={{
          color: c.fg,
          fontSize: 13,
          lineHeight: 18,
          fontWeight: "500",
          fontVariant: ["tabular-nums"],
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Filter chips invert when selected; choice chips use the accent. */
export function FilterChip({
  label,
  count,
  selected,
  onPress,
  variant = "filter",
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
  variant?: "filter" | "choice";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const on =
    variant === "filter"
      ? { bg: colors.surfaceRaised, fg: colors.textPrimary, border: colors.surfaceRaised }
      : { bg: colors.accentSubtle, fg: colors.accent, border: colors.accent };
  return (
    <Pressable
      accessibilityRole={variant === "filter" ? "button" : "radio"}
      accessibilityState={
        variant === "filter"
          ? { selected, disabled }
          : { checked: selected, disabled }
      }
      accessibilityLabel={
        accessibilityLabel ??
        (count === undefined ? label : `${label}, ${count}`)
      }
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => ({
        minHeight: 34,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: selected ? on.border : colors.separator,
        backgroundColor: selected ? on.bg : "transparent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        numberOfLines={1}
        textBreakStrategy="simple"
        style={{
          fontSize: 14,
          lineHeight: 18,
          fontWeight: selected ? "600" : "500",
          color: selected ? on.fg : colors.textSecondary,
        }}
      >
        {label}
      </Text>
      {count !== undefined && (
        <Text
          style={{
            fontSize: 14,
            lineHeight: 18,
            fontWeight: "500",
            opacity: 0.6,
            color: selected ? on.fg : colors.textSecondary,
            fontVariant: ["tabular-nums"],
          }}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}

export function StatGrid({
  items,
}: {
  items: { value: string | number; label: string; color?: string }[];
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.background,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 4,
      }}
    >
      {items.map((item) => (
        <Stat key={item.label} {...item} />
      ))}
    </View>
  );
}
export function Stat({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{ flex: 1, alignItems: "center", gap: 1 }}
    >
      <Text
        selectable
        style={{
          fontSize: 17,
          lineHeight: 22,
          fontWeight: "600",
          color: color ?? colors.textPrimary,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          fontSize: 12,
          lineHeight: 16,
          fontWeight: "500",
          color: colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function RoundButton({
  icon,
  label,
  onPress,
  disabled = false,
  variant = "surface",
  size = 44,
  iconSize,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "surface" | "raised" | "plain";
  size?: number;
  iconSize?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={size < 44 ? (44 - size) / 2 : undefined}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: 8,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor:
          variant === "surface"
            ? colors.surface
            : variant === "raised"
              ? colors.surfaceRaised
              : "transparent",
        borderWidth: variant === "surface" ? 0.5 : 0,
        borderColor: colors.separator,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon
        name={icon}
        size={iconSize ?? Math.round(size * 0.45)}
        color={variant === "raised" ? colors.textPrimary : colors.accent}
      />
    </Pressable>
  );
}

export type ActionVariant =
  | "primary"
  | "secondary"
  | "tonal"
  | "dashed"
  | "inverted"
  | "danger"
  | "success"
  | "warning";
export function ActionButton({
  label,
  icon,
  variant = "primary",
  onPress,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  label: string;
  icon?: IconName;
  variant?: ActionVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const look = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: undefined },
    secondary: { bg: colors.surface, fg: colors.textPrimary, border: colors.separator },
    tonal: { bg: colors.surfaceRaised, fg: colors.textPrimary, border: undefined },
    dashed: { bg: "transparent", fg: colors.accent, border: colors.separator },
    inverted: { bg: colors.textPrimary, fg: colors.background, border: undefined },
    danger: { bg: colors.absent, fg: colors.onAccent, border: undefined },
    success: { bg: colors.presentSubtle, fg: colors.present, border: undefined },
    warning: { bg: colors.warningSubtle, fg: colors.warning, border: colors.warning },
  }[variant];
  const off = disabled && !loading;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          borderRadius: 10,
          borderCurve: "continuous",
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          backgroundColor: off && variant === "danger" ? colors.surfaceRaised : look.bg,
          borderWidth: look.border ? 1 : 0,
          borderStyle: variant === "dashed" ? "dashed" : "solid",
          borderColor: look.border,
          opacity: off && variant !== "danger" ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        icon && <Icon name={icon} size={18} color={look.fg} />
      )}
      <Text
        style={{
          fontSize: 16,
          lineHeight: 21,
          fontWeight: "600",
          textAlign: "center",
          flexShrink: 1,
          color: off && variant === "danger" ? colors.textSecondary : look.fg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Large-title caption that sits directly below the native header. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text variant="caption" secondary style={{ marginTop: -4 }}>
      {children}
    </Text>
  );
}
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 6,
        marginHorizontal: 4,
        marginBottom: -4,
        minHeight: 44,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontSize: 18, lineHeight: 24, fontWeight: "600", flexShrink: 1 }}
      >
        {title}
      </Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          disabled={action.disabled}
          onPress={action.onPress}
          hitSlop={8}
          style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: "center",
            opacity: action.disabled ? 0.4 : pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.accent }}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export function GroupLabel({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      variant="caption"
      secondary
      style={{
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.4,
        marginHorizontal: 16,
        marginTop: 6,
        marginBottom: -6,
      }}
    >
      {children}
    </Text>
  );
}

/** Grouped surface with hairline separators inset past leading icons. */
export function Group({
  children,
  inset = 14,
  style,
}: PropsWithChildren<{ inset?: number; style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderCurve: "continuous",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {i > 0 && (
            <View
              style={{
                height: 0.5,
                marginLeft: inset,
                backgroundColor: colors.separator,
              }}
            />
          )}
          {row}
        </Fragment>
      ))}
    </View>
  );
}
export function ListRow({
  title,
  subtitle,
  value,
  icon,
  iconTone = "accent",
  onPress,
  chevron = !!onPress,
  accessory,
  tone,
  disabled = false,
  accessibilityLabel,
  leading,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  iconTone?: Tone;
  onPress?: () => void;
  chevron?: boolean;
  accessory?: ReactNode;
  tone?: Tone;
  disabled?: boolean;
  accessibilityLabel?: string;
  leading?: ReactNode;
}) {
  const { colors } = useTheme();
  const glyph =
    iconTone === "accent" ? colors.textSecondary : toneColors(colors, iconTone).fg;
  const ink = tone ? toneColors(colors, tone).fg : colors.textPrimary;
  const body = (pressed: boolean) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 52,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {leading}
      {icon && (
        <View style={{ width: 30, alignItems: "center" }}>
          <Icon name={icon} size={19} color={glyph} />
        </View>
      )}
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={{
            fontSize: 16,
            lineHeight: 21,
            color: ink,
            fontWeight: tone ? "600" : "400",
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" secondary>
            {subtitle}
          </Text>
        )}
      </View>
      {value !== undefined && (
        <Text
          numberOfLines={1}
          style={{
            fontSize: 15,
            color: colors.textSecondary,
            maxWidth: "45%",
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </Text>
      )}
      {accessory}
      {chevron && (
        <Icon name={icons.chevronRight} size={14} color={colors.textSecondary} />
      )}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        [title, value, subtitle].filter(Boolean).join(", ")
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}
export function SwitchRow({
  title,
  subtitle,
  value,
  onChange,
  icon,
  disabled = false,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: IconName;
  disabled?: boolean;
}>) {
  return (
    <View>
      {process.env.EXPO_OS === "android" ? (
        <ListRow
          title={title}
          subtitle={subtitle}
          icon={icon}
          disabled={disabled}
          chevron={false}
          accessibilityLabel={`${title}, ${value ? "on" : "off"}`}
          onPress={() => onChange(!value)}
          accessory={<MaterialSwitch value={value} disabled={disabled} onChange={onChange} />}
        />
      ) : (
        <ListRow
          title={title}
          subtitle={subtitle}
          icon={icon}
          disabled={disabled}
          accessory={
            <NativeSwitch
              accessibilityLabel={title}
              value={value}
              disabled={disabled}
              onValueChange={onChange}
            />
          }
        />
      )}
      {children && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
          {children}
        </View>
      )}
    </View>
  );
}

/** Material 3 switch seeded with the app accent (Android). */
function MaterialSwitch({
  value,
  disabled,
  onChange,
}: {
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors, scheme } = useTheme();
  return (
    <View importantForAccessibility="no-hide-descendants">
      <Host matchContents colorScheme={scheme} seedColor={colors.accent}>
        <UISwitch value={value} disabled={disabled} onValueChange={onChange} />
      </Host>
    </View>
  );
}

export function RadioDot({ selected }: { selected: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? colors.accent : colors.textSecondary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {selected && (
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: colors.accent,
          }}
        />
      )}
    </View>
  );
}
export function RadioCard({
  title,
  subtitle,
  selected,
  onPress,
  disabled = false,
  bare = false,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Renders as a row inside a Group instead of a bordered card. */
  bare?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: bare ? "center" : "flex-start",
        gap: 12,
        minHeight: bare ? 60 : 44,
        paddingVertical: bare ? 8 : 12,
        paddingHorizontal: bare ? 16 : 14,
        borderRadius: bare ? 0 : 10,
        borderCurve: "continuous",
        borderWidth: bare ? 0 : 1,
        borderColor: selected ? colors.accent : colors.separator,
        backgroundColor: bare
          ? pressed
            ? colors.surfaceRaised
            : "transparent"
          : selected
            ? colors.accentSubtle
            : colors.surface,
        opacity: disabled ? 0.45 : pressed && !bare ? 0.8 : 1,
      })}
    >
      <View style={{ marginTop: bare ? 0 : 1 }}>
        <RadioDot selected={selected} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "600" }}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" secondary>
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function Checkbox({
  label,
  checked,
  onPress,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 44,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <CheckSquare checked={checked} />
      <Text style={{ fontSize: 15, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}
export function CheckSquare({ checked }: { checked: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: checked ? colors.accent : colors.textSecondary,
        backgroundColor: checked ? colors.accent : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked && <Icon name={icons.check} size={14} color={colors.onAccent} />}
    </View>
  );
}

export function Banner({
  tone,
  icon,
  children,
  action,
  outlined = false,
}: PropsWithChildren<{
  tone: Tone;
  icon?: IconName;
  action?: { label: string; onPress: () => void; disabled?: boolean };
  outlined?: boolean;
}>) {
  const { colors } = useTheme();
  const c = toneColors(colors, tone);
  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderCurve: "continuous",
        backgroundColor: outlined ? colors.surface : c.bg,
        borderWidth: outlined ? 1 : 0,
        borderColor: c.fg,
      }}
    >
      {icon && <Icon name={icon} size={20} color={c.fg} />}
      <View style={{ flex: 1 }}>
        {typeof children === "string" ? (
          <Text
            selectable
            style={{ color: c.fg, fontSize: 15, lineHeight: 20, fontWeight: "500" }}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
      {action && (
        <Pressable
          accessibilityRole="button"
          disabled={action.disabled}
          onPress={action.onPress}
          hitSlop={8}
          style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: "center",
            opacity: action.disabled ? 0.4 : pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ color: c.fg, fontWeight: "600", fontSize: 15 }}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Attendance ring. The target lives in text nearby, not as a marker. */
export function TargetRing({
  progress,
  size = 56,
  stroke = 4,
  color,
  children,
}: PropsWithChildren<{
  progress: number | null;
  size?: number;
  stroke?: number;
  color: string;
}>) {
  const { colors } = useTheme();
  const c = size / 2,
    r = c - stroke / 2,
    circumference = 2 * Math.PI * r;
  const p = progress === null ? 0 : Math.max(0, Math.min(1, progress));
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={colors.surfaceRaised}
          strokeWidth={stroke}
        />
        {p > 0 && (
          <Circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${p * circumference} ${circumference}`}
            rotation={-90}
            origin={`${c}, ${c}`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

/** Thin progress bar, optionally with a target marker. */
export function ProgressLine({
  value,
  color,
  target,
  height = 6,
}: {
  value: number;
  color?: string;
  target?: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const w = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible={false}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: colors.surfaceRaised,
        justifyContent: "center",
      }}
    >
      <View
        style={{
          height,
          borderRadius: height / 2,
          width: `${w * 100}%`,
          backgroundColor: color ?? colors.accent,
        }}
      />
      {target !== undefined && target > 0 && target < 1 && (
        <View
          style={{
            position: "absolute",
            left: `${target * 100}%`,
            marginLeft: -1,
            width: 2,
            height,
            backgroundColor: colors.surface,
          }}
        />
      )}
    </View>
  );
}

/** Screen wrapper content width used by every tab. */
export const contentStyle = {
  paddingHorizontal: 16,
  paddingTop: 8,
  paddingBottom: 120,
  gap: 16,
  width: "100%",
  maxWidth: 680,
  alignSelf: "center",
} as const;
