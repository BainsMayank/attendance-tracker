import { useRef, useState, type ReactNode } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { router } from "expo-router";
import {
  ActionButton,
  Card,
  CheckSquare,
  EmptyState,
  FilterChip,
  GradientBackground,
  Icon,
  Pill,
  ProgressLine,
  RoundButton,
  Text,
  contentStyle,
  haptic,
  icons,
  useTheme,
  type Tone,
} from "@/ui";
import {
  orderFingerprint,
  reorderContent,
  saveContent,
  type ContentData,
  type SubjectScope,
} from "@/db/repositories/subject-content";
import { useLogMutation } from "@/features/daily-log/hooks";
import { ErrorText } from "@/features/timetable/form-controls";
import { DragRow } from "./drag-row";
import { localParts } from "./content-model";
import { shortDate } from "./status";

type Filter = "all" | "important" | "pending";
type Unit = ContentData["units"][number];
type Topic = ContentData["topics"][number];
const EXAMS = ["quiz", "mid-sem", "end-sem", "exam"];

export function TopicsSection({
  data,
  scope,
  header,
  readOnly,
  now,
  timezone,
}: {
  data: ContentData;
  scope: SubjectScope;
  header: ReactNode;
  readOnly: boolean;
  now: number;
  timezone: string;
}) {
  const { colors, scheme } = useTheme();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Set<string>>(() => {
    const first = data.units.find((u) =>
      data.topics.some((t) => t.unitId === u.id && t.completedAt === null),
    );
    return new Set(first ? [first.id] : []);
  });
  const [reorder, setReorder] = useState<"units" | string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const heights = useRef(new Map<string, number>());
  const mutation = useLogMutation();
  const edit = (kind: "unit" | "topic", id?: string, unitId?: string) =>
    router.push({
      pathname: "/subject-content-editor",
      params: { ...scope, kind, id, unitId },
    });
  const done = data.topics.filter((t) => t.completedAt !== null).length;
  const total = data.topics.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const importantLeft = data.topics.filter(
    (t) => t.important && t.completedAt === null,
  ).length;
  const exam = data.deadlines
    .filter(
      (d) =>
        d.completedAt === null && d.dueAt >= now && EXAMS.includes(d.category),
    )
    .sort((a, b) => a.dueAt - b.dueAt)[0];
  const matches = (t: Topic) =>
    filter === "important"
      ? t.important
      : filter === "pending"
        ? t.completedAt === null
        : true;
  const units =
    filter === "all"
      ? data.units
      : data.units.filter((u) =>
          data.topics.some((t) => t.unitId === u.id && matches(t)),
        );
  const toggle = (topic: Topic, field: "done" | "important") =>
    void mutation.run(
      () =>
        saveContent(
          scope,
          "topic",
          field === "done"
            ? {
                ...topic,
                completedAt: topic.completedAt === null ? Date.now() : null,
              }
            : { ...topic, important: !topic.important },
          topic.id,
          topic.revision,
        ),
      field === "done"
        ? topic.completedAt === null
          ? "Topic done"
          : "Topic reopened"
        : topic.important
          ? "Star removed"
          : "Marked important",
    );
  const addTopic = (unit: Unit) => {
    const title = drafts[unit.id]?.trim();
    if (!title) return;
    void mutation
      .run(
        () =>
          saveContent(scope, "topic", {
            title,
            unitId: unit.id,
            important: false,
            completedAt: null,
          }),
        "Topic added",
      )
      .then((ok) => ok && setDrafts((d) => ({ ...d, [unit.id]: "" })));
  };
  function move(
    kind: "unit" | "topic",
    id: string,
    direction?: number,
    distance?: number,
    unitId?: string,
  ) {
    const siblings =
      kind === "unit"
        ? data.units
        : data.topics.filter((t) => t.unitId === unitId);
    const index = siblings.findIndex((r) => r.id === id);
    let target = Math.max(
      0,
      Math.min(siblings.length - 1, index + (direction ?? 0)),
    );
    if (distance !== undefined) {
      let remaining = Math.abs(distance),
        i = index;
      const step = distance > 0 ? 1 : -1;
      while (i + step >= 0 && i + step < siblings.length) {
        const height = (heights.current.get(siblings[i + step].id) ?? 120) + 12;
        if (remaining < height / 2) break;
        remaining -= height;
        i += step;
      }
      target = i;
    }
    if (target === index || index < 0) return;
    const ids = siblings.map((r) => r.id);
    ids.splice(target, 0, ids.splice(index, 1)[0]);
    void mutation.run(
      () =>
        reorderContent(scope, kind, ids, orderFingerprint(siblings), unitId),
      "Order saved",
    );
  }
  const unitTone = (d: number, n: number): Tone =>
    n > 0 && d === n ? "ok" : d === 0 ? "neutral" : "warn";
  const listHeader = (
    <View style={{ gap: 16, marginBottom: 16 }}>
      {header}
      <Card
        gap={10}
        accessible
        accessibilityLabel={`${done} of ${total} topics done, ${pct} percent`}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "600" }}>
            {total ? `${done} of ${total} topics done` : "No topics yet"}
          </Text>
          {total > 0 && (
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: colors.accent,
                fontVariant: ["tabular-nums"],
              }}
            >
              {pct}%
            </Text>
          )}
        </View>
        <ProgressLine value={total ? done / total : 0} />
        <Text variant="caption" secondary>
          {!total
            ? "Add a unit, then list the topics you need to cover."
            : done === total
              ? "Every topic is done."
              : `${importantLeft ? `${importantLeft} important ${importantLeft === 1 ? "topic" : "topics"}` : `${total - done} ${total - done === 1 ? "topic" : "topics"}`} left${exam ? ` before the ${exam.title} on ${shortDate(localParts(exam.dueAt, timezone).date)}` : ""}`}
        </Text>
      </Card>
      {reorder ? (
        <ActionButton
          label={
            reorder === "units"
              ? "Done reordering units"
              : "Done reordering topics"
          }
          variant="tonal"
          onPress={() => setReorder(null)}
        />
      ) : (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {(
            [
              ["all", "All"],
              ["important", "Important"],
              ["pending", "Pending"],
            ] as const
          ).map(([key, label]) => (
            <FilterChip
              key={key}
              label={label}
              selected={filter === key}
              onPress={() => setFilter(key)}
            />
          ))}
          <View style={{ flex: 1 }} />
          {!readOnly && (
            <RoundButton
              icon={icons.plus}
              label="Add unit"
              size={36}
              disabled={mutation.busy}
              onPress={() => edit("unit")}
            />
          )}
        </View>
      )}
      {filter === "important" && !importantLeft && !units.length && (
        <Text secondary>Star a topic to keep it here.</Text>
      )}
      <ErrorText message={mutation.error} />
    </View>
  );
  const topicRow = (topic: Topic, first: boolean) => {
    const isDone = topic.completedAt !== null;
    return (
      <View
        key={topic.id}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          minHeight: 48,
          paddingLeft: 8,
          paddingRight: 6,
          borderTopWidth: first ? 0.5 : 0.5,
          borderTopColor: colors.separator,
        }}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={topic.title}
          accessibilityState={{
            checked: isDone,
            disabled: readOnly || mutation.busy,
          }}
          disabled={readOnly || mutation.busy}
          onPress={() => {
            void haptic("selection");
            toggle(topic, "done");
          }}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckSquare checked={isDone} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${topic.title}`}
          disabled={readOnly}
          onPress={() => edit("topic", topic.id, topic.unitId)}
          style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
        >
          <Text
            style={{
              fontSize: 16,
              lineHeight: 21,
              color: isDone ? colors.textSecondary : colors.textPrimary,
              textDecorationLine: isDone ? "line-through" : "none",
            }}
          >
            {topic.title}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Important"
          accessibilityState={{
            selected: topic.important,
            disabled: readOnly || mutation.busy,
          }}
          disabled={readOnly || mutation.busy}
          onPress={() => toggle(topic, "important")}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={topic.important ? icons.starFill : icons.star}
            size={20}
            color={topic.important ? colors.warning : colors.textSecondary}
          />
        </Pressable>
      </View>
    );
  };
  return (
    <GradientBackground>
      <FlatList
        data={units}
        keyExtractor={(u) => u.id}
        scrollEnabled={!dragging}
        removeClippedSubviews={false}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={contentStyle}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          filter === "all" ? (
            <EmptyState
              title="Build your syllabus"
              message="Add a unit, then fill it with the topics you want to study."
              action={
                readOnly
                  ? undefined
                  : { label: "Add unit", onPress: () => edit("unit") }
              }
            />
          ) : (
            <Card padding={28} style={{ alignItems: "center" }}>
              <Text secondary style={{ textAlign: "center" }}>
                {filter === "important"
                  ? "No important topics. Tap a star to add one."
                  : "Nothing pending. Every topic is done."}
              </Text>
            </Card>
          )
        }
        renderItem={({ item: unit, index }) => {
          const topics = data.topics.filter((t) => t.unitId === unit.id);
          const shown = topics.filter(matches);
          const d = topics.filter((t) => t.completedAt !== null).length;
          const expanded =
            reorder === unit.id ||
            (reorder !== "units" && (filter !== "all" || open.has(unit.id)));
          const menu: MenuAction[] = readOnly
            ? []
            : [
                { id: "rename", title: "Rename unit", image: "pencil" as const },
                { id: "topic", title: "Add topic", image: "plus" as const },
                ...(topics.length > 1
                  ? [
                      {
                        id: "reorderTopics",
                        title: "Reorder topics",
                        image: "arrow.up.arrow.down" as const,
                      },
                    ]
                  : []),
                ...(data.units.length > 1
                  ? [
                      {
                        id: "reorderUnits",
                        title: "Reorder units",
                        image: "list.number" as const,
                      },
                    ]
                  : []),
              ];
          const head = (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`Unit ${index + 1}, ${unit.title}, ${d} of ${topics.length} done`}
              accessibilityHint={
                menu.length ? "Long press for unit options" : undefined
              }
              disabled={!!reorder}
              onPress={() => {
                setFilter("all");
                setOpen((old) => {
                  const next = new Set(old);
                  if (expanded) next.delete(unit.id);
                  else next.add(unit.id);
                  return next;
                });
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 64,
                paddingVertical: 12,
                paddingLeft: 16,
                paddingRight: 12,
                backgroundColor: pressed ? colors.surfaceRaised : "transparent",
              })}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="caption" secondary>
                  Unit {data.units.indexOf(unit) + 1}
                </Text>
                <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: "600" }}>
                  {unit.title}
                </Text>
              </View>
              <Pill label={`${d}/${topics.length}`} tone={unitTone(d, topics.length)} />
              <View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
                <Icon
                  name={icons.chevronRight}
                  size={14}
                  color={colors.textSecondary}
                />
              </View>
            </Pressable>
          );
          const card = (
            <Card padding={0} gap={0} style={{ overflow: "hidden" }}>
              {menu.length ? (
                <MenuView
                  shouldOpenOnLongPress
                  title={unit.title}
                  colorScheme={scheme}
                  actions={menu}
                  onPressAction={({ nativeEvent }) => {
                    const e = nativeEvent.event;
                    if (e === "rename") edit("unit", unit.id);
                    else if (e === "topic") edit("topic", undefined, unit.id);
                    else if (e === "reorderTopics") {
                      setFilter("all");
                      setReorder(unit.id);
                    } else if (e === "reorderUnits") {
                      setFilter("all");
                      setReorder("units");
                    }
                  }}
                >
                  {head}
                </MenuView>
              ) : (
                head
              )}
              {expanded && reorder !== unit.id && (
                <>
                  {shown.map((t, i) => topicRow(t, i === 0))}
                  {!topics.length && (
                    <Text
                      secondary
                      style={{ paddingHorizontal: 16, paddingBottom: 12 }}
                    >
                      No topics in this unit yet.
                    </Text>
                  )}
                  {!readOnly && filter === "all" && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        minHeight: 48,
                        paddingLeft: 18,
                        paddingRight: 12,
                        borderTopWidth: 0.5,
                        borderTopColor: colors.separator,
                      }}
                    >
                      <Icon name={icons.plus} size={18} color={colors.accent} />
                      <TextInput
                        selectionColor={colors.accent}
                        cursorColor={colors.accent}
                        accessibilityLabel={`New topic in ${unit.title}`}
                        placeholder="Add a topic"
                        placeholderTextColor={colors.accent}
                        value={drafts[unit.id] ?? ""}
                        onChangeText={(text) =>
                          setDrafts((old) => ({ ...old, [unit.id]: text }))
                        }
                        onSubmitEditing={() => addTopic(unit)}
                        returnKeyType="done"
                        submitBehavior="submit"
                        editable={!mutation.busy}
                        maxLength={200}
                        style={{
                          flex: 1,
                          minHeight: 44,
                          fontSize: 16,
                          color: colors.textPrimary,
                        }}
                      />
                    </View>
                  )}
                </>
              )}
              {reorder === unit.id && (
                <View style={{ padding: 12, gap: 12 }}>
                  {topics.map((topic, i) => (
                    <DragRow
                      key={topic.id}
                      label={topic.title}
                      first={i === 0}
                      last={i === topics.length - 1}
                      onDragging={setDragging}
                      onHeight={(h) => heights.current.set(topic.id, h)}
                      onMove={(dir) =>
                        move("topic", topic.id, dir, undefined, unit.id)
                      }
                      onDrop={(dist) =>
                        move("topic", topic.id, undefined, dist, unit.id)
                      }
                    >
                      <Text>{topic.title}</Text>
                    </DragRow>
                  ))}
                </View>
              )}
            </Card>
          );
          if (reorder !== "units" || readOnly) return card;
          const i = data.units.indexOf(unit);
          return (
            <DragRow
              label={unit.title}
              first={i === 0}
              last={i === data.units.length - 1}
              onDragging={setDragging}
              onHeight={(h) => heights.current.set(unit.id, h)}
              onMove={(dir) => move("unit", unit.id, dir)}
              onDrop={(dist) => move("unit", unit.id, undefined, dist)}
            >
              <Text style={{ fontWeight: "600" }}>{unit.title}</Text>
            </DragRow>
          );
        }}
      />
    </GradientBackground>
  );
}
