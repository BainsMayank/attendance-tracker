import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/features/shell/screen";
import {
  Group,
  GroupLabel,
  Icon,
  RadioCard,
  SegmentedControl,
  Skeleton,
  Text,
  icons,
  useTheme,
} from "@/ui";
import {
  saveTimetable,
  scheduleFingerprint,
  type SlotDraft,
  type TimetableData,
} from "@/db/repositories/timetable-commands";
import {
  DAY_NAMES,
  formatTime,
  selectVersion,
  slotsOverlap,
  validateSlots,
  type WeekPattern,
} from "@/lib/timetable";
import { localToday } from "@/db/validation";
import { errorMessage, useTimetable } from "./hooks";
import {
  Editor,
  ErrorText,
  FormRow,
  InputRow,
  PickerRow,
  TimeRow,
  useSave,
} from "./form-controls";
export function SlotEditorScreen() {
  const params = useLocalSearchParams<{
    semesterId: string;
    date?: string;
    slotId?: string;
    weekday?: string;
    start?: string;
  }>();
  const { data, loading, error } = useTimetable(params.semesterId);
  if (loading)
    return (
      <Screen>
        <Skeleton height={200} />
      </Screen>
    );
  if (error || !data)
    return (
      <Screen>
        <ErrorText message={error || "Semester unavailable."} />
      </Screen>
    );
  if (params.slotId && !data.slots.some((s) => s.id === params.slotId))
    return (
      <Screen>
        <ErrorText message="This class is unavailable. Return to your timetable." />
      </Screen>
    );
  if (
    !params.slotId &&
    (!data.subjects.some((s) => s.archivedAt === null) ||
      !data.types.some((t) => t.archivedAt === null))
  )
    return (
      <Screen>
        <ErrorText message="Add an active subject and class type before adding a class." />
      </Screen>
    );
  return <SlotForm data={data} params={params} />;
}
function SlotForm({
  data: loaded,
  params,
}: {
  data: TimetableData;
  params: { date?: string; slotId?: string; weekday?: string; start?: string };
}) {
  const [data] = useState(loaded);
  const [version] = useState(() =>
    selectVersion(
      data.versions,
      params.date ?? localToday(data.semester.timezone),
    ),
  );
  const [original] = useState(() =>
    data.slots.find(
      (s) => s.id === params.slotId && s.versionId === version?.id,
    ),
  );
  const [subject, setSubject] = useState(
    original?.subjectId ??
      data.subjects.find((s) => s.archivedAt === null)?.id ??
      "",
  );
  const [type, setType] = useState(
    original?.classTypeId ??
      (
        data.types.find(
          (t) => t.archivedAt === null && t.normalizedName === "lecture",
        ) ?? data.types.find((t) => t.archivedAt === null)
      )?.id ??
      "",
  );
  const [day, setDay] = useState(
    original?.weekday ?? Number(params.weekday || 1),
  );
  const [parity, setParity] = useState<WeekPattern>(original?.parity ?? "all");
  const [start, setStart] = useState(
    original?.startMinute ?? Number(params.start || 540),
  );
  const [end, setEnd] = useState(
    original?.endMinute ?? Math.min(start + 60, 1440),
  );
  const [room, setRoom] = useState(original?.room ?? ""),
    [teacher, setTeacher] = useState(
      original?.teacher ??
        data.subjects.find((s) => s.id === subject)?.teacher ??
        "",
    );
  const [countsAs, setCountsAs] = useState(
    original?.countsAs ??
      data.types.find((t) => t.id === type)?.defaultCountsAs ??
      1,
  );
  const [initial] = useState(
    JSON.stringify([
      subject,
      type,
      day,
      parity,
      start,
      end,
      room,
      teacher,
      countsAs,
    ]),
  );
  const [scope, setScope] = useState<"today" | "semester">("today");
  const form = useSave();
  const { colors } = useTheme();
  const draft: SlotDraft = {
    ...(original ? { id: original.id } : {}),
    subjectId: subject,
    classTypeId: type,
    weekday: day,
    parity,
    startMinute: start,
    endMinute: end,
    room: room.trim() || null,
    teacher: teacher.trim() || null,
    countsAs,
  };
  const dirty =
    JSON.stringify([
      subject,
      type,
      day,
      parity,
      start,
      end,
      room,
      teacher,
      countsAs,
    ]) !== initial;
  const others = data.slots.filter(
    (s) => s.versionId === version?.id && s.id !== original?.id,
  );
  const badTime = end <= start;
  const hit = badTime ? undefined : others.find((o) => slotsOverlap(o, draft));
  const clash = badTime || !!hit;
  const name = (id: string) =>
    data.subjects.find((x) => x.id === id)?.name ?? "another class";
  const history = data.records.length > 0;
  const save = (remove = false) => {
    if (form.busy) return;
    const slots: SlotDraft[] = [...others];
    if (!remove) slots.push(draft);
    try {
      validateSlots(slots);
    } catch (e) {
      form.setError(errorMessage(e));
      return;
    }
    void form.save(
      () =>
        saveTimetable({
          semesterId: data.semester.id,
          expectedFingerprint: scheduleFingerprint(data),
          sourceVersionId: version?.id,
          slots,
          scope: history ? scope : undefined,
        }),
      remove ? "Class removed" : "Timetable saved",
    );
  };
  const types = data.types.filter(
    (t) => t.archivedAt === null || t.id === original?.classTypeId,
  );
  const archived = data.semester.archivedAt !== null;
  return (
    <Editor
      title={original ? "Edit class" : "Add class"}
      dirty={!form.done && dirty}
      busy={form.busy}
      primaryAction={{
        label: "Save",
        loading: form.busy,
        disabled: archived || clash || (!!original && !dirty),
        onPress: () => save(),
      }}
    >
      <View style={{ gap: 16, marginTop: -8 }}>
        <GroupLabel>Class</GroupLabel>
        <Group inset={16}>
          <PickerRow
            label="Subject"
            value={subject}
            options={data.subjects
              .filter((s) => s.archivedAt === null || s.id === original?.subjectId)
              .map((s) => ({ label: s.name, value: s.id }))}
            onChange={(id) => {
              setSubject(id);
              setTeacher(data.subjects.find((s) => s.id === id)?.teacher ?? "");
            }}
          />
          {types.length <= 3 ? (
            <FormRow label="Type">
              <View style={{ alignSelf: "stretch" }}>
                <SegmentedControl
                  values={types.map((t) => t.name)}
                  value={types.find((t) => t.id === type)?.name ?? types[0]?.name ?? ""}
                  onChange={(label) => {
                    const t = types.find((x) => x.name === label)!;
                    setType(t.id);
                    setCountsAs(t.defaultCountsAs);
                  }}
                />
              </View>
            </FormRow>
          ) : (
            <PickerRow
              label="Type"
              value={type}
              options={types.map((t) => ({ label: t.name, value: t.id }))}
              onChange={(id) => {
                setType(id);
                setCountsAs(data.types.find((t) => t.id === id)!.defaultCountsAs);
              }}
            />
          )}
          <FormRow label="Counts as">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                {countsAs} {countsAs === 1 ? "class" : "classes"}
              </Text>
              {(
                [
                  [-1, icons.minus, "Count as fewer classes"],
                  [1, icons.plus, "Count as more classes"],
                ] as const
              ).map(([step, icon, label]) => (
                <Pressable
                  key={step}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  disabled={step === -1 ? countsAs <= 1 : countsAs >= 100}
                  onPress={() => setCountsAs(countsAs + step)}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.surfaceRaised,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: (step === -1 ? countsAs <= 1 : countsAs >= 100) ? 0.4 : pressed ? 0.6 : 1,
                  })}
                >
                  <Icon name={icon} size={16} color={colors.textPrimary} />
                </Pressable>
              ))}
            </View>
          </FormRow>
        </Group>
        <Text variant="caption" secondary style={{ marginHorizontal: 16, marginTop: -8 }}>
          Some colleges count a 3-hour lab as 3 classes. Leave it at 1 if yours
          doesn’t.
        </Text>

        <GroupLabel>When</GroupLabel>
        <Group inset={16}>
          <FormRow label="Day" stacked>
            <View
              accessibilityRole="radiogroup"
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              {DAY_NAMES.map((full, i) => {
                const on = day === i + 1;
                return (
                  <Pressable
                    key={full}
                    accessibilityRole="radio"
                    accessibilityLabel={full}
                    accessibilityState={{ checked: on }}
                    onPress={() => setDay(i + 1)}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: on ? colors.accent : colors.separator,
                      backgroundColor: on ? colors.accent : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: on ? colors.onAccent : colors.textPrimary }}>
                      {full[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FormRow>
          <TimeRow label="Starts" value={start} onChange={setStart} />
          <TimeRow
            label="Ends"
            value={end === 1440 ? 0 : end}
            onChange={(v) => setEnd(v === 0 ? 1440 : v)}
          />
          <FormRow label="Repeats">
            <View style={{ alignSelf: "stretch" }}>
              <SegmentedControl
                values={["Weekly", "Odd wks", "Even wks"] as const}
                value={parity === "all" ? "Weekly" : parity === "odd" ? "Odd wks" : "Even wks"}
                onChange={(v) => setParity(v === "Weekly" ? "all" : v === "Odd wks" ? "odd" : "even")}
              />
            </View>
          </FormRow>
        </Group>
        <View
          accessibilityRole="summary"
          accessibilityLiveRegion="polite"
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginTop: -6 }}
        >
          <Icon
            name={clash ? icons.warning : icons.check}
            size={16}
            color={clash ? colors.absent : colors.present}
          />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: clash ? colors.absent : colors.present }}>
            {badTime
              ? "End time must be after the start time"
              : hit
                ? `Overlaps ${name(hit.subjectId)} (${formatTime(hit.startMinute)}–${formatTime(hit.endMinute)}) on ${DAY_NAMES[day - 1]}`
                : `No overlap with other ${DAY_NAMES[day - 1]} classes`}
          </Text>
        </View>
        {parity !== "all" && (
          <Text variant="caption" secondary style={{ marginHorizontal: 16, marginTop: -8 }}>
            Odd and even weeks count from the start of the semester.
          </Text>
        )}

        <GroupLabel>Where</GroupLabel>
        <Group inset={16}>
          <InputRow
            label="Venue"
            placeholder="Room or building"
            value={room}
            onChangeText={setRoom}
            editable={!form.busy}
          />
          <InputRow
            label="Teacher"
            placeholder="Optional"
            value={teacher}
            onChangeText={setTeacher}
            editable={!form.busy}
          />
        </Group>

        {history && (
          <>
            <GroupLabel>Apply changes</GroupLabel>
            <Group inset={16}>
              <RadioCard
                bare
                title="From today onward"
                subtitle="Past attendance stays exactly as logged"
                selected={scope === "today"}
                onPress={() => setScope("today")}
              />
              <RadioCard
                bare
                title="Whole semester"
                subtitle="Rewrites past days too · marks are kept"
                selected={scope === "semester"}
                onPress={() => setScope("semester")}
              />
            </Group>
          </>
        )}
        <ErrorText message={form.error} />
        {original && (
          <Pressable
            accessibilityRole="button"
            disabled={form.busy || archived}
            onPress={() =>
              Alert.alert(
                "Delete this class?",
                history
                  ? `It’s removed ${scope === "today" ? "from today onward" : "for the whole semester"}. Logged attendance is kept.`
                  : "It’s removed from your timetable.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => save(true) },
                ],
              )
            }
            style={({ pressed }) => ({
              minHeight: 52,
              marginTop: 8,
              borderRadius: 12,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              opacity: form.busy || archived ? 0.45 : pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: colors.absent }}>
              Delete this class
            </Text>
          </Pressable>
        )}
      </View>
    </Editor>
  );
}
