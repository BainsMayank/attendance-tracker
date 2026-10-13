import { FlatList, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { Button, EmptyState, GradientBackground, Skeleton, Text } from "@/ui";
import { contentScope, saveContent } from "@/db/repositories/subject-content";
import { useLogMutation } from "@/features/daily-log/hooks";
import { ErrorText } from "@/features/timetable/form-controls";
import { Screen } from "@/features/shell/screen";
import { useSubjectContent } from "./content-hooks";
import { noteLines, toggleChecklist } from "./content-model";
import { NoteBodyLine, RowActions } from "./content-ui";

export default function NoteScreen() {
  const params = useLocalSearchParams<{
    semesterId: string;
    subjectId: string;
    id: string;
  }>();
  const scope = { semesterId: params.semesterId, subjectId: params.subjectId };
  const state = useSubjectContent(scope),
    mutation = useLogMutation();
  if (state.loading)
    return (
      <Screen>
        <Skeleton height={300} />
      </Screen>
    );
  if (state.error)
    return (
      <Screen>
        <ErrorText message={state.error} />
        <Button label="Retry" onPress={state.reload} />
      </Screen>
    );
  const note = state.data?.notes.find((n) => n.id === params.id);
  if (!note)
    return (
      <Screen>
        <EmptyState
          title="Note unavailable"
          message="This note may have been deleted. Return to the subject to see your notes."
        />
      </Screen>
    );
  const parents = contentScope(scope),
    readOnly =
      parents.subject.archivedAt !== null ||
      parents.semester.archivedAt !== null;
  return (
    <GradientBackground>
      <Stack.Screen
        options={{ title: note.title, headerLargeTitleEnabled: false }}
      />
      <FlatList
        data={noteLines(note.body)}
        keyExtractor={(line) => String(line.index)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 48,
          gap: 8,
          width: "100%",
          maxWidth: 680,
          alignSelf: "center",
        }}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 16 }}>
            <Text variant="heading" selectable>
              {note.title}
            </Text>
            <Text secondary>
              {note.pinned ? "Pinned · " : ""}
              {new Intl.DateTimeFormat(undefined, {
                timeZone: parents.semester.timezone,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(note.updatedAt)}
            </Text>
            {!readOnly && (
              <RowActions>
                <Button
                  label="Edit note"
                  onPress={() =>
                    router.push({
                      pathname: "/subject-content-editor",
                      params: { ...scope, kind: "note", id: note.id },
                    })
                  }
                />
                <Button
                  label={note.pinned ? "Unpin" : "Pin note"}
                  variant="secondary"
                  disabled={mutation.busy}
                  onPress={() =>
                    void mutation.run(
                      () =>
                        saveContent(
                          scope,
                          "note",
                          { ...note, pinned: !note.pinned },
                          note.id,
                          note.revision,
                        ),
                      note.pinned ? "Note unpinned" : "Note pinned",
                    )
                  }
                />
              </RowActions>
            )}
            <ErrorText message={mutation.error} />
            {!note.body && <Text secondary>This note has no body yet.</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <NoteBodyLine
            line={item}
            disabled={readOnly || mutation.busy}
            onToggle={() =>
              void mutation.run(
                () =>
                  saveContent(
                    scope,
                    "note",
                    { ...note, body: toggleChecklist(note.body, item.index) },
                    note.id,
                    note.revision,
                  ),
                "Checklist updated",
              )
            }
          />
        )}
      />
    </GradientBackground>
  );
}
