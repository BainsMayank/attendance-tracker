import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { MenuView } from "@expo/ui/community/menu";
import { router } from "expo-router";
import {
  ActionButton,
  Card,
  EmptyState,
  Eyebrow,
  GradientBackground,
  Group,
  Icon,
  ListRow,
  SectionHeader,
  Skeleton,
  Text,
  contentStyle,
  haptic,
  icons,
  toneColors,
  useTheme,
  useToast,
  type Tone,
  HeaderActions,
} from "@/ui";
import { addDays, mondayAnchor, weekday } from "@/lib/attendance";
import { DAY_NAMES, formatTime, selectVersion } from "@/lib/timetable";
import { semestersRepository } from "@/db/repositories";
import {
  ensureClassTypes,
  type SlotRow,
  type TimetableData,
} from "@/db/repositories/timetable-commands";
import { ErrorText } from "./form-controls";
import {
  dateInTimezone,
  errorMessage,
  invalidateTimetable,
  useClock,
  useTimetable,
} from "./hooks";
import { shareTimetable } from "./export";
import { slotLabel } from "./slot-label";
import { shortDate } from "@/features/subjects/status";
import { useChromeInsets, useHeaderScrollEdge } from "@/features/shell/chrome";

export function typeTone(name: string | undefined): Tone {
  const key = (name ?? "").toLowerCase();
  if (key.includes("lab") || key.includes("practical")) return "ok";
  if (key.includes("tut")) return "neutral";
  if (key.includes("lec")) return "accent";
  return "warn";
}
const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
};

export function TimetableScreen({ setup = false }: { setup?: boolean } = {}) {
  const [semesterId, setSemesterId] = useState<string>();
  const { data, loading, error, reload } = useTimetable(semesterId);
  const [day, setDay] = useState<number>();
  const [exporting, setExporting] = useState(false),
    [history, setHistory] = useState(false);
  const now = useClock(),
    { colors } = useTheme(),
    toast = useToast();
  const chrome = useChromeInsets();
  const scrollEdge = useHeaderScrollEdge();
  if (loading)
    return (
      <GradientBackground>
        <View style={[contentStyle, { paddingTop: 140 }]}>
          <Skeleton height={80} />
          <Skeleton height={300} />
        </View>
      </GradientBackground>
    );
  if (error)
    return (
      <GradientBackground>
        <View style={[contentStyle, { paddingTop: 140 }]}>
          <ErrorText message={error} />
          <ActionButton label="Retry" onPress={reload} />
        </View>
      </GradientBackground>
    );
  const ai = () =>
    router.push({
      pathname: "/timetable-import",
      params: {
        semesterId: data?.semester.id,
        onboarding: setup ? "1" : undefined,
      },
    });
  const importBanner = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Import from a photo. Let ChatGPT or Gemini read your timetable, then paste the result here."
      onPress={ai}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
      })}
    >
      <Icon name={icons.sparkles} size={20} color={colors.textSecondary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>
          Import from a photo
        </Text>
        <Text variant="caption" secondary style={{ fontWeight: "400" }}>
          Let ChatGPT or Gemini read your timetable, then paste the result
          here.
        </Text>
      </View>
      <Icon name={icons.chevronRight} size={14} color={colors.textMuted} />
    </Pressable>
  );
  if (!data)
    return (
      <GradientBackground>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[contentStyle, chrome]}
          onScroll={scrollEdge}
          scrollEventThrottle={16}
        >
          <EmptyState
            title="Make room for your week"
            message="Set up a semester, then add your subjects and classes. Your timetable works offline."
            icon={{ ios: "calendar", android: "calendar_month", web: "calendar_month" }}
          />
          {importBanner}
          <ActionButton
            label="Add manually"
            variant="secondary"
            onPress={() => router.push("/timetable-semester")}
          />
        </ScrollView>
      </GradientBackground>
    );
  const clock = dateInTimezone(now, data.semester.timezone);
  const reference =
    clock.date < data.semester.startsOn
      ? data.semester.startsOn
      : clock.date > data.semester.endsOn
        ? data.semester.endsOn
        : clock.date;
  const monday = mondayAnchor(reference);
  const editable = data.semester.archivedAt === null;
  const version = selectVersion(data.versions, reference);
  const template = data.slots
    .filter((s) => s.versionId === version?.id)
    .sort((a, b) => a.startMinute - b.startMinute);
  const sunday = template.some((s) => s.weekday === 7);
  const days = Array.from({ length: sunday ? 7 : 6 }, (_, i) => i + 1);
  const todayDay = weekday(reference);
  const selected = day ?? (days.includes(todayDay) ? todayDay : 1);
  const list = template.filter((s) => s.weekday === selected);
  const dateFor = (d: number) => addDays(monday, d - 1);
  const subject = (s: SlotRow) => data.subjects.find((x) => x.id === s.subjectId);
  const typeName = (s: SlotRow) =>
    data.types.find((t) => t.id === s.classTypeId)?.name ?? "Class";
  const defaults = () => {
    const result = ensureClassTypes(data.semester.id);
    if (result.created) {
      invalidateTimetable();
      void haptic("light");
      toast({
        message: "Default class types added",
        undo: () => {
          result.undo();
          invalidateTimetable();
        },
      });
    }
  };
  const openSlot = (date: string, slot?: SlotRow, start = 540) => {
    if (!editable) {
      toast({ message: "This semester is archived." });
      return;
    }
    if (!slot && !data.subjects.some((s) => s.archivedAt === null)) {
      router.push({
        pathname: "/timetable-subjects",
        params: { semesterId: data.semester.id },
      });
      return;
    }
    try {
      defaults();
    } catch (e) {
      toast({ message: errorMessage(e) });
      return;
    }
    router.push({
      pathname: "/timetable-slot",
      params: {
        semesterId: data.semester.id,
        date,
        ...(slot
          ? { slotId: slot.id }
          : { weekday: String(weekday(date)), start: String(start) }),
      },
    });
  };
  const nextStart = list.length
    ? Math.min(list[list.length - 1].endMinute, 1380)
    : 540;
  const weekly = template.filter((s) => s.parity === "all").length;
  const alternating = template.length - weekly;
  const sems = semestersRepository.list();
  const total = list.reduce((n, s) => n + s.endMinute - s.startMinute, 0);
  return (
    <GradientBackground>
      {!setup && process.env.EXPO_OS !== "web" && editable && (
        <HeaderActions
          right={[
            {
              label: "Add a class",
              icon: icons.plus,
              accent: true,
              onPress: () => openSlot(dateFor(selected), undefined, nextStart),
            },
          ]}
        />
      )}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[contentStyle, chrome]}
        onScroll={scrollEdge}
        scrollEventThrottle={16}
      >
        <Eyebrow>
          {data.semester.name}
          {data.semester.archivedAt !== null ? " · Archived" : ""} ·{" "}
          {weekly} {weekly === 1 ? "class" : "classes"} a week
          {alternating ? ` + ${alternating} alternating` : ""}
        </Eyebrow>
        {editable && importBanner}
        {setup && (
          <ActionButton
            label="Add a class"
            icon={icons.plus}
            onPress={() => openSlot(dateFor(selected), undefined, nextStart)}
          />
        )}
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Day of week"
          style={{ flexDirection: "row", gap: 6 }}
        >
          {days.map((d) => {
            const on = d === selected;
            const n = template.filter((s) => s.weekday === d).length;
            return (
              <Pressable
                key={d}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${DAY_NAMES[d - 1]}, ${n} ${n === 1 ? "class" : "classes"}`}
                onPress={() => setDay(d)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 56,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  borderCurve: "continuous",
                  backgroundColor: on ? colors.surface : "transparent",
                  borderWidth: 1,
                  borderColor: on ? colors.controlBorder : colors.separator,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: on ? "600" : "500",
                    color: on ? colors.textPrimary : colors.textSecondary,
                  }}
                >
                  {DAY_NAMES[d - 1].slice(0, 3)}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "400",
                    color: colors.textMuted,
                  }}
                >
                  {n ? `${n} cls` : "—"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingHorizontal: 4,
            gap: 8,
          }}
        >
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "600" }}>
            {DAY_NAMES[selected - 1]}
          </Text>
          {list.length > 0 && (
            <Text variant="caption" secondary style={{ flexShrink: 1, textAlign: "right" }}>
              {list.length} {list.length === 1 ? "class" : "classes"} ·{" "}
              {formatTime(list[0].startMinute)}–
              {formatTime(Math.max(...list.map((s) => s.endMinute)))} ·{" "}
              {(total / 60).toFixed(1)} h
            </Text>
          )}
        </View>
        {!version ? (
          <Card padding={24} gap={6} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 17, fontWeight: "600" }}>No timetable yet</Text>
            <Text variant="caption" secondary style={{ textAlign: "center" }}>
              Import it from a photo above, or add classes one by one.
            </Text>
            {editable && (
              <ActionButton
                label="Add a class"
                variant="tonal"
                onPress={() => openSlot(dateFor(selected))}
              />
            )}
          </Card>
        ) : !list.length ? (
          <Card padding={28} gap={6} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 17, fontWeight: "600" }}>
              No classes on {DAY_NAMES[selected - 1]}
            </Text>
            <Text variant="caption" secondary style={{ textAlign: "center" }}>
              Add one if you have a weekend lab or an extra slot.
            </Text>
            {editable && (
              <Pressable
                accessibilityRole="button"
                onPress={() => openSlot(dateFor(selected))}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ fontWeight: "600", color: colors.accent }}>
                  Add a class
                </Text>
              </Pressable>
            )}
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {list.map((s, i) => {
              const gap = i > 0 ? s.startMinute - list[i - 1].endMinute : 0;
              const tone = typeTone(typeName(s));
              const c = toneColors(colors, tone);
              const sub = subject(s);
              return (
                <View key={s.id} style={{ gap: 8 }}>
                  {gap >= 30 && (
                    <View
                      accessible
                      accessibilityLabel={`Free for ${duration(gap)}`}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8 }}
                    >
                      <View style={{ flex: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.separator }} />
                      <Text variant="caption" secondary>
                        Free · {duration(gap)}
                      </Text>
                      <View style={{ flex: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.separator }} />
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${slotLabel(data, s)}`}
                    onPress={() => openSlot(dateFor(selected), s)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "stretch",
                      gap: 12,
                      paddingVertical: 12,
                      paddingLeft: 12,
                      paddingRight: 6,
                      borderRadius: 12,
                      borderCurve: "continuous",
                      backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
                    })}
                  >
                    <View style={{ width: 3, borderRadius: 1.5, backgroundColor: c.fg }} />
                    <View style={{ width: 50, justifyContent: "center" }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                        {formatTime(s.startMinute)}
                      </Text>
                      <Text variant="caption" secondary style={{ fontVariant: ["tabular-nums"] }}>
                        {formatTime(s.endMinute)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 4, justifyContent: "center" }}>
                      <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "600" }}>
                        {sub?.name ?? "Subject"}
                        {sub?.archivedAt ? " · Archived" : ""}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        <Tag label={typeName(s)} tone="neutral" />
                        {s.parity !== "all" && (
                          <Tag label={s.parity === "odd" ? "Odd wks" : "Even wks"} tone="warn" />
                        )}
                        {s.countsAs > 1 && <Tag label={`×${s.countsAs}`} tone="neutral" />}
                        {!!s.room && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <Icon name={icons.pin} size={12} color={colors.textSecondary} />
                            <Text variant="caption" secondary>
                              {s.room}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={{ width: 44, alignItems: "center", justifyContent: "center" }}>
                      <Icon name={icons.chevronRight} size={14} color={colors.textSecondary} />
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <SectionHeader title="Manage" />
        <Group>
          <ListRow
            title="Subjects"
            value={String(data.subjects.filter((s) => s.archivedAt === null).length)}
            onPress={() =>
              router.push({
                pathname: "/timetable-subjects",
                params: { semesterId: data.semester.id },
              })
            }
          />
          <ListRow
            title="Class types"
            value={
              data.types
                .filter((t) => t.archivedAt === null)
                .map((t) => t.name)
                .join(", ") || "None yet"
            }
            onPress={() => {
              try {
                if (editable) defaults();
                router.push({
                  pathname: "/class-types",
                  params: { semesterId: data.semester.id },
                });
              } catch (e) {
                toast({ message: errorMessage(e) });
              }
            }}
          />
          <ListRow
            title="Semester dates"
            value={`${shortDate(data.semester.startsOn)} – ${shortDate(data.semester.endsOn)}`}
            onPress={() => router.push("/semester")}
          />
          <ListRow
            title={exporting ? "Exporting…" : "Export as JSON"}
            disabled={exporting || !template.length}
            onPress={async () => {
              setExporting(true);
              try {
                await shareTimetable(data);
              } catch (e) {
                if (!(e instanceof Error && e.name === "AbortError"))
                  toast({ message: errorMessage(e) });
              } finally {
                setExporting(false);
              }
            }}
          />
          {data.versions.length > 1 && (
            <ListRow
              title="Timetable versions"
              value={String(data.versions.length)}
              chevron={false}
              accessory={
                <View style={{ transform: [{ rotate: history ? "90deg" : "0deg" }] }}>
                  <Icon name={icons.chevronRight} size={14} color={colors.textSecondary} />
                </View>
              }
              onPress={() => setHistory(!history)}
            />
          )}
          {sems.length > 1 && (
            <SemesterSwitch
              data={data}
              semesters={sems}
              onChange={(id) => {
                setSemesterId(id);
                setDay(undefined);
              }}
            />
          )}
        </Group>
        {history && <Versions data={data} />}
        <Text variant="caption" secondary style={{ paddingHorizontal: 4 }}>
          Logged attendance keeps its original class details when your
          timetable changes.
        </Text>
      </ScrollView>
    </GradientBackground>
  );
}

/** Inline metadata: tone-colored text only, no filled badge. */
function Tag({ label, tone }: { label: string; tone: Tone }) {
  const { colors } = useTheme();
  const fg =
    tone === "accent" || tone === "neutral"
      ? colors.textSecondary
      : toneColors(colors, tone).fg;
  return (
    <Text variant="caption" style={{ fontWeight: "500", color: fg }}>
      {label}
    </Text>
  );
}
function SemesterSwitch({
  data,
  semesters,
  onChange,
}: {
  data: TimetableData;
  semesters: ReturnType<typeof semestersRepository.list>;
  onChange: (id: string) => void;
}) {
  const { scheme } = useTheme();
  return (
    <MenuView
      title="Show semester"
      colorScheme={scheme}
      actions={semesters.map((s) => ({
        id: s.id,
        title: `${s.name}${s.archivedAt ? " · Archived" : ""}`,
        state: s.id === data.semester.id ? "on" : "off",
      }))}
      onPressAction={({ nativeEvent }) => onChange(nativeEvent.event)}
    >
      <ListRow title="Showing semester" value={data.semester.name} chevron />
    </MenuView>
  );
}
function Versions({ data }: { data: TimetableData }) {
  return (
    <Group>
      {data.versions
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((v) => (
          <ListRow
            key={v.id}
            title={`${v.label}${v.supersededAt !== null ? " · Superseded" : ""}`}
            subtitle={`${shortDate(v.effectiveFrom)} – ${v.effectiveUntil ? `before ${shortDate(v.effectiveUntil)}` : shortDate(data.semester.endsOn)}`}
          />
        ))}
    </Group>
  );
}
