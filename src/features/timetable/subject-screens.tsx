import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Screen } from "@/features/shell/screen";
import {
  Button,
  EmptyState,
  SegmentedControl,
  Skeleton,
  Text,
  haptic,
  useTheme,
  useToast,
} from "@/ui";
import { subjectsRepository } from "@/db/repositories";
import { normalizeName } from "@/db/validation";
import type { TimetableData } from "@/db/repositories/timetable-commands";
import { percentToBps, subjectColors } from "@/lib/timetable";
import { errorMessage, invalidateTimetable, useTimetable } from "./hooks";
import { Choice, Editor, ErrorText, Field, useSave } from "./form-controls";

const icons: { value: string; label: string; name: SymbolViewProps["name"] }[] =
  [
    {
      value: "book",
      label: "Book",
      name: { ios: "book.closed", android: "menu_book", web: "menu_book" },
    },
    {
      value: "science",
      label: "Science",
      name: { ios: "flask", android: "science", web: "science" },
    },
    {
      value: "math",
      label: "Mathematics",
      name: { ios: "function", android: "calculate", web: "calculate" },
    },
    {
      value: "code",
      label: "Computing",
      name: {
        ios: "chevron.left.forwardslash.chevron.right",
        android: "code",
        web: "code",
      },
    },
    {
      value: "language",
      label: "Language",
      name: { ios: "globe", android: "language", web: "language" },
    },
    {
      value: "art",
      label: "Art",
      name: { ios: "paintpalette", android: "palette", web: "palette" },
    },
  ];
function SubjectIcon({
  value,
  color,
}: {
  value: string | null;
  color: string;
}) {
  return (
    <SymbolView
      name={(icons.find((i) => i.value === value) ?? icons[0]).name}
      tintColor={color}
      size={24}
    />
  );
}
export function SubjectsManagerScreen() {
  const params = useLocalSearchParams<{ semesterId: string }>();
  const { data, loading, error, reload } = useTimetable(params.semesterId);
  const [filter, setFilter] = useState("Active"),
    [search, setSearch] = useState("");
  const { colors } = useTheme(),
    toast = useToast();
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
        <Button label="Retry" onPress={reload} />
      </Screen>
    );
  const subjects = data.subjects.filter(
    (s) =>
      (filter === "Archived" ? s.archivedAt !== null : s.archivedAt === null) &&
      `${s.name} ${s.code ?? ""}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <Screen>
      <Text secondary>
        Subjects, teachers, and attendance targets for {data.semester.name}.
      </Text>
      <Button
        label="Add subject"
        disabled={data.semester.archivedAt !== null}
        onPress={() =>
          router.push({
            pathname: "/subject-editor",
            params: { semesterId: data.semester.id },
          })
        }
      />
      <Field
        label="Search subjects"
        placeholder="Name or short code"
        value={search}
        onChangeText={setSearch}
      />
      <SegmentedControl
        values={["Active", "Archived"]}
        value={filter}
        onChange={setFilter}
      />
      {subjects.length ? (
        subjects.map((subject) => (
          <View
            key={subject.id}
            style={{
              padding: 16,
              backgroundColor: colors.surface,
              borderRadius: 12,
              gap: 12,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${subject.name}`}
              disabled={data.semester.archivedAt !== null}
              onPress={() =>
                router.push({
                  pathname: "/subject-editor",
                  params: {
                    semesterId: data.semester.id,
                    subjectId: subject.id,
                  },
                })
              }
              style={{ gap: 8, minHeight: 48 }}
            >
              <View
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
              >
                <SubjectIcon value={subject.icon} color={subject.color} />
                <Text variant="title" style={{ flex: 1 }}>
                  {subject.name}
                  {subject.code ? ` · ${subject.code}` : ""}
                </Text>
              </View>
              <Text secondary>
                {subject.teacher || "No teacher"} · Target{" "}
                {subject.targetBps === null
                  ? `${data.semester.targetBps / 100}% (semester default)`
                  : `${subject.targetBps / 100}%`}
              </Text>
            </Pressable>
            <Button
              label={
                subject.archivedAt === null ? "Archive" : "Restore subject"
              }
              variant="secondary"
              disabled={data.semester.archivedAt !== null}
              onPress={() => {
                const act = () => {
                  try {
                    const saved = subjectsRepository.update(
                      subject.id,
                      subject.revision,
                      {
                        archivedAt:
                          subject.archivedAt === null ? Date.now() : null,
                      },
                    );
                    invalidateTimetable();
                    void haptic("light");
                    toast({
                      message:
                        saved.archivedAt === null
                          ? "Subject restored"
                          : "Subject archived",
                      undo: () => {
                        subjectsRepository.update(saved.id, saved.revision, {
                          archivedAt: subject.archivedAt,
                        });
                        invalidateTimetable();
                      },
                    });
                  } catch (e) {
                    toast({ message: errorMessage(e) });
                    void haptic("error");
                  }
                };
                if (subject.archivedAt === null)
                  Alert.alert(
                    `Archive ${subject.name}?`,
                    "Existing timetable classes and attendance are kept. You can restore this subject later.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Archive", onPress: act },
                    ],
                  );
                else act();
              }}
            />
          </View>
        ))
      ) : (
        <EmptyState
          title={
            search
              ? "No matching subjects"
              : filter === "Archived"
                ? "No archived subjects"
                : "Add your first subject"
          }
          message={
            search
              ? "Try a different name or short code."
              : "Subjects give each class its name, color, and attendance target."
          }
        />
      )}
    </Screen>
  );
}
export function SubjectEditorScreen() {
  const params = useLocalSearchParams<{
    semesterId: string;
    subjectId?: string;
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
  if (params.subjectId && !data.subjects.some((s) => s.id === params.subjectId))
    return (
      <Screen>
        <ErrorText message="Subject unavailable." />
      </Screen>
    );
  return <SubjectForm data={data} subjectId={params.subjectId} />;
}
function SubjectForm({
  data,
  subjectId,
}: {
  data: TimetableData;
  subjectId?: string;
}) {
  const [original] = useState(() =>
    data.subjects.find((s) => s.id === subjectId),
  );
  const [name, setName] = useState(original?.name ?? ""),
    [code, setCode] = useState(original?.code ?? ""),
    [teacher, setTeacher] = useState(original?.teacher ?? "");
  const [color, setColor] = useState(original?.color ?? subjectColors[0]),
    [icon, setIcon] = useState(original?.icon ?? "book"),
    [target, setTarget] = useState(
      original?.targetBps == null ? "" : String(original.targetBps / 100),
    );
  const [initial] = useState(() =>
    JSON.stringify([name, code, teacher, color, icon, target]),
  );
  const form = useSave(),
    { colors } = useTheme();
  const dirty =
    initial !== JSON.stringify([name, code, teacher, color, icon, target]);
  const colorsOptions = ["Indigo", "Green", "Amber", "Rose", "Teal", "Violet"];
  const submit = () =>
    void form.save(() => {
      const normalizedName = normalizeName(name);
      if (
        data.subjects.some(
          (s) => s.id !== original?.id && s.normalizedName === normalizedName,
        )
      )
        throw new Error(
          "A subject with that name already exists, including archived subjects.",
        );
      const patch = {
        name: name.trim(),
        normalizedName,
        code: code.trim() || null,
        teacher: teacher.trim() || null,
        color,
        icon,
        targetBps: percentToBps(target),
      };
      const saved = original
        ? subjectsRepository.update(original.id, original.revision, patch)
        : subjectsRepository.create({ semesterId: data.semester.id, ...patch });
      return {
        undo: () => {
          if (original)
            subjectsRepository.update(saved.id, saved.revision, {
              name: original.name,
              normalizedName: original.normalizedName,
              code: original.code,
              teacher: original.teacher,
              color: original.color,
              icon: original.icon,
              targetBps: original.targetBps,
            });
          else subjectsRepository.remove(saved.id, saved.revision);
        },
      };
    }, "Subject saved");
  return (
    <Editor
      title={original ? "Edit subject" : "Add subject"}
      dirty={dirty && !form.done}
      busy={form.busy}
      primaryAction={{
        label: "Save",
        loading: form.busy,
        disabled: data.semester.archivedAt !== null || !name.trim(),
        onPress: submit,
      }}
    >
      <Field
        label="Subject name"
        placeholder="e.g. Applied Mathematics"
        value={name}
        onChangeText={setName}
        autoFocus={!original}
        editable={!form.busy}
      />
      <Field
        label="Short code"
        placeholder="e.g. MATH"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        editable={!form.busy}
      />
      <Field
        label="Teacher name"
        placeholder="Optional"
        value={teacher}
        onChangeText={setTeacher}
        editable={!form.busy}
      />
      <View style={{ gap: 8 }}>
        <Text variant="secondary">Color</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {subjectColors.map((c, i) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={colorsOptions[i]}
              accessibilityState={{ selected: color === c }}
              disabled={form.busy}
              onPress={() => setColor(c)}
              style={{
                minWidth: 48,
                minHeight: 48,
                borderRadius: 12,
                backgroundColor: c,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: color === c ? 3 : 0,
                borderColor: colors.textPrimary,
              }}
            >
              {color === c && <Text style={{ color: "#FFFFFF" }}>✓</Text>}
            </Pressable>
          ))}
        </View>
      </View>
      <Choice
        label="Icon"
        value={icons.some((i) => i.value === icon) ? icon : "book"}
        options={icons.map(({ value, label }) => ({ value, label }))}
        onChange={setIcon}
      />
      <SubjectIcon value={icon} color={color} />
      <Field
        label="Target override (%)"
        placeholder={`Blank uses ${data.semester.targetBps / 100}%`}
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        editable={!form.busy}
      />
      <Text variant="caption" secondary>
        Leave blank to use the semester target. 0–100%, with up to two decimal
        places.
      </Text>
      <ErrorText message={form.error} />
      <Button
        label="Save subject"
        loading={form.busy}
        disabled={data.semester.archivedAt !== null || !name.trim()}
        onPress={submit}
      />
    </Editor>
  );
}
