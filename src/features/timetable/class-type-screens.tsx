import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/features/shell/screen";
import { Button, EmptyState, GlassCard, Skeleton, Text } from "@/ui";
import { classTypesRepository } from "@/db/repositories";
import { normalizeName } from "@/db/validation";
import type { TimetableData } from "@/db/repositories/timetable-commands";
import { useTimetable } from "./hooks";
import { Editor, ErrorText, Field, useSave } from "./form-controls";
export function ClassTypesScreen() {
  const { semesterId } = useLocalSearchParams<{ semesterId: string }>();
  const { data, loading, error, reload } = useTimetable(semesterId);
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
  return (
    <Screen>
      <Text secondary>How many attendance units does each class count as?</Text>
      {data.types.map((type) => (
        <GlassCard solid key={type.id}>
          <View style={{ gap: 8 }}>
            <Text variant="title">{type.name}</Text>
            <Text>
              {type.defaultCountsAs}{" "}
              {type.defaultCountsAs === 1 ? "unit" : "units"}
              {type.archivedAt ? " · Archived" : ""}
            </Text>
          </View>
          <Button
            label={`Edit ${type.name}`}
            variant="secondary"
            disabled={data.semester.archivedAt !== null}
            onPress={() =>
              router.push({
                pathname: "/class-type-editor",
                params: { semesterId, typeId: type.id },
              })
            }
          />
        </GlassCard>
      ))}
      {!data.types.length && (
        <EmptyState
          title="No class types"
          message="Add Lecture, Lab, Tutorial, or your own class type."
        />
      )}
      <Button
        label="Add class type"
        disabled={data.semester.archivedAt !== null}
        onPress={() =>
          router.push({
            pathname: "/class-type-editor",
            params: { semesterId },
          })
        }
      />
      <Text variant="caption" secondary>
        Changing a default applies to new classes. Existing slots and recorded
        attendance keep their saved weights.
      </Text>
    </Screen>
  );
}
export function ClassTypeEditorScreen() {
  const { semesterId, typeId } = useLocalSearchParams<{
    semesterId: string;
    typeId?: string;
  }>();
  const { data, loading, error } = useTimetable(semesterId);
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
  if (typeId && !data.types.some((t) => t.id === typeId))
    return (
      <Screen>
        <ErrorText message="Class type unavailable." />
      </Screen>
    );
  return <TypeForm data={data} typeId={typeId} />;
}
function TypeForm({ data, typeId }: { data: TimetableData; typeId?: string }) {
  const [original] = useState(() => data.types.find((t) => t.id === typeId));
  const [name, setName] = useState(original?.name ?? ""),
    [weight, setWeight] = useState(String(original?.defaultCountsAs ?? 1));
  const [initial] = useState(JSON.stringify([name, weight]));
  const form = useSave();
  const submit = () =>
    void form.save(() => {
      if (
        !/^\d+$/.test(weight) ||
        !Number.isSafeInteger(Number(weight)) ||
        Number(weight) < 1
      )
        throw new Error("Counts as must be a positive whole number.");
      const normalizedName = normalizeName(name);
      if (
        data.types.some(
          (t) => t.id !== original?.id && t.normalizedName === normalizedName,
        )
      )
        throw new Error("A class type with that name already exists.");
      const patch = {
        name: name.trim(),
        normalizedName,
        defaultCountsAs: Number(weight),
      };
      const saved = original
        ? classTypesRepository.update(original.id, original.revision, patch)
        : classTypesRepository.create({
            semesterId: data.semester.id,
            ...patch,
          });
      return {
        undo: () => {
          if (original)
            classTypesRepository.update(saved.id, saved.revision, {
              name: original.name,
              normalizedName: original.normalizedName,
              defaultCountsAs: original.defaultCountsAs,
            });
          else classTypesRepository.remove(saved.id, saved.revision);
        },
      };
    }, "Class type saved");
  return (
    <Editor
      title={original ? "Edit class type" : "Add class type"}
      dirty={!form.done && initial !== JSON.stringify([name, weight])}
      busy={form.busy}
      primaryAction={{
        label: "Save",
        loading: form.busy,
        disabled: data.semester.archivedAt !== null || !name.trim(),
        onPress: submit,
      }}
    >
      <Field
        label="Class type name"
        value={name}
        onChangeText={setName}
        editable={!form.busy}
      />
      <Field
        label="Counts as (attendance units)"
        value={weight}
        onChangeText={setWeight}
        keyboardType="number-pad"
        editable={!form.busy}
      />
      <Text secondary>
        For example, a Lab can count as 2 attendance units. Existing classes
        keep their saved weights.
      </Text>
      <ErrorText message={form.error} />
      <Button
        label="Save class type"
        loading={form.busy}
        disabled={!name.trim() || data.semester.archivedAt !== null}
        onPress={submit}
      />
    </Editor>
  );
}
