import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { BottomSheet, Button, Text, useTheme } from "@/ui";
import { changeSubject } from "@/db/repositories/subject-attendance";
import { useLogMutation } from "@/features/daily-log/hooks";
import { ErrorText } from "@/features/timetable/form-controls";
import { subjectColors } from "@/lib/timetable";
import type { SubjectModel } from "@/lib/subjects";
import type { SubjectAction } from "./subject-card";

export function useSubjectActions() {
  const [selection, setSelection] = useState<{
    model: SubjectModel;
    mode: "actions" | "color" | "archive";
  }>();
  const pendingEditor = useRef<SubjectModel | undefined>(undefined);
  const mutation = useLogMutation();
  const edit = (model: SubjectModel) =>
    router.push({
      pathname: "/subject-editor",
      params: {
        semesterId: model.subject.semesterId,
        subjectId: model.subject.id,
      },
    });
  const dismiss = () => {
    if (mutation.busy) return;
    setSelection(undefined);
    if (pendingEditor.current) {
      const model = pendingEditor.current;
      pendingEditor.current = undefined;
      edit(model);
    }
  };
  const action = (model: SubjectModel, type: SubjectAction) => {
    if (type === "edit") {
      if (selection && process.env.EXPO_OS === "ios") {
        pendingEditor.current = model;
        setSelection(undefined);
      } else {
        setSelection(undefined);
        edit(model);
      }
    } else setSelection({ model, mode: type });
  };
  return { selection, setSelection, mutation, action, dismiss };
}
export function SubjectActions({
  controller,
  readOnly,
}: {
  controller: ReturnType<typeof useSubjectActions>;
  readOnly: boolean;
}) {
  const { selection, setSelection, mutation, action } = controller;
  const { colors } = useTheme();
  const names = ["Indigo", "Green", "Amber", "Rose", "Teal", "Violet"];
  return (
    <BottomSheet
      open={!!selection}
      onDismiss={controller.dismiss}
      title={
        selection?.mode === "archive"
          ? `Archive ${selection.model.subject.name}?`
          : selection?.mode === "color"
            ? "Subject color"
            : (selection?.model.subject.name ?? "Subject actions")
      }
    >
      {selection?.mode === "actions" ? (
        <>
          <Button
            label="Edit subject"
            variant="secondary"
            disabled={readOnly || mutation.busy}
            onPress={() => action(selection.model, "edit")}
          />
          <Button
            label="Change color"
            variant="secondary"
            disabled={readOnly || mutation.busy}
            onPress={() => action(selection.model, "color")}
          />
          <Button
            label="Archive subject"
            variant="secondary"
            disabled={readOnly || mutation.busy}
            onPress={() => action(selection.model, "archive")}
          />
        </>
      ) : selection?.mode === "archive" ? (
        <>
          <Text>
            Attendance and timetable history will be kept. Restore this subject
            from Manage subjects.
          </Text>
          <Button
            label="Archive subject"
            variant="secondary"
            disabled={readOnly || mutation.busy}
            loading={mutation.busy}
            onPress={() =>
              void mutation
                .run(
                  () =>
                    changeSubject(selection.model.subject, {
                      archivedAt: Date.now(),
                    }),
                  "Subject archived",
                )
                .then((saved) => {
                  if (saved) setSelection(undefined);
                })
            }
          />
          <Button
            label="Cancel"
            variant="secondary"
            disabled={mutation.busy}
            onPress={() => setSelection(undefined)}
          />
        </>
      ) : (
        selection && (
          <>
            <Text secondary>
              Choose an identity color. Attendance status keeps its own color.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {subjectColors.map((color, index) => (
                <Pressable
                  key={color}
                  accessibilityRole="radio"
                  accessibilityLabel={names[index]}
                  accessibilityState={{
                    selected: selection.model.subject.color === color,
                    disabled: readOnly || mutation.busy,
                  }}
                  disabled={readOnly || mutation.busy}
                  onPress={() =>
                    void mutation
                      .run(
                        () => changeSubject(selection.model.subject, { color }),
                        "Subject color changed",
                      )
                      .then((saved) => {
                        if (saved) setSelection(undefined);
                      })
                  }
                  style={{
                    minHeight: 56,
                    minWidth: 88,
                    flexGrow: 1,
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor:
                      selection.model.subject.color === color
                        ? colors.textPrimary
                        : colors.separator,
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: color,
                    }}
                  />
                  <Text variant="caption">
                    {names[index]}
                    {selection.model.subject.color === color
                      ? " · selected"
                      : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )
      )}
      <ErrorText message={mutation.error} />
      {mutation.busy && <Text secondary>Saving…</Text>}
    </BottomSheet>
  );
}
