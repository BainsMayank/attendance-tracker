import { useState } from "react";
import { Alert, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Button, Chip, EmptyState, GlassCard, Text } from "@/ui";
import {
  Choice,
  DateField,
  Editor,
  ErrorText,
  Field,
  TimeField,
  useSave,
} from "@/features/timetable/form-controls";
import { Screen } from "@/features/shell/screen";
import { errorMessage } from "@/features/timetable/hooks";
import {
  contentScope,
  deleteContent,
  saveContent,
  subjectContent,
  type ContentKind,
  type ContentData,
} from "@/db/repositories/subject-content";
import {
  deadlineTypes,
  formatSelection,
  localParts,
  noteLines,
  zonedInstant,
} from "./content-model";
import { NoteBodyLine, RowActions } from "./content-ui";

const collections = {
  unit: "units",
  topic: "topics",
  note: "notes",
  deadline: "deadlines",
  mark: "marks",
  link: "links",
} as const;
export default function ContentEditorScreen() {
  const params = useLocalSearchParams<{
    semesterId: string;
    subjectId: string;
    kind: ContentKind;
    id?: string;
    unitId?: string;
  }>();
  const scope = { semesterId: params.semesterId, subjectId: params.subjectId };
  const [initial] = useState(() => {
    try {
      if (!Object.hasOwn(collections, params.kind))
        throw new Error("Editor unavailable.");
      const parents = contentScope(scope, undefined, true),
        data = subjectContent(scope);
      const row: ContentData[keyof ContentData][number] | undefined = params.id
        ? data[collections[params.kind]].find((r) => r.id === params.id)
        : undefined;
      if (params.id && !row)
        throw new Error("This item is unavailable in the selected subject.");
      return { ...parents, data, row, error: "" };
    } catch (e) {
      return {
        error: errorMessage(e),
        data: undefined,
        row: undefined,
        semester: undefined,
        subject: undefined,
      };
    }
  });
  const row = initial.row,
    kind = params.kind;
  const [title, setTitle] = useState(row?.title ?? "");
  const [body, setBody] = useState(row && "body" in row ? row.body : "");
  const [pinned, setPinned] = useState(
    row && "pinned" in row ? row.pinned : false,
  );
  const [important, setImportant] = useState(
    row && "important" in row ? row.important === true : false,
  );
  const [done, setDone] = useState(
    row && "completedAt" in row ? row.completedAt : null,
  );
  const [unitId, setUnitId] = useState(
    row && "unitId" in row
      ? (row.unitId ?? "")
      : (params.unitId ?? initial.data?.units[0]?.id ?? ""),
  );
  const [category, setCategory] = useState(
    row && "category" in row ? row.category : "assignment",
  );
  const [defaultParts] = useState(() =>
    localParts(
      row && "dueAt" in row ? row.dueAt : Date.now() + 3600000,
      initial.semester?.timezone ?? "Asia/Kolkata",
    ),
  );
  const [date, setDate] = useState(
    row && "onDate" in row
      ? (row.onDate ?? defaultParts.date)
      : defaultParts.date,
  );
  const [minute, setMinute] = useState(defaultParts.minute);
  const [earned, setEarned] = useState(
    row && "earned" in row ? (row.earned?.toString() ?? "") : "",
  );
  const [maximum, setMaximum] = useState(
    row && "maximum" in row ? row.maximum.toString() : "100",
  );
  const [url, setURL] = useState(
    row && "url" in row && typeof row.url === "string" ? row.url : "",
  );
  const [selection, setSelection] = useState({ start: 0, end: 0 }),
    [preview, setPreview] = useState(false);
  const saved = useSave();
  const form = {
    title,
    body,
    pinned,
    important,
    done,
    unitId,
    category,
    date,
    minute,
    earned,
    maximum,
    url,
  };
  const [baseline] = useState(JSON.stringify(form));
  if (initial.error || !initial.data || !initial.semester)
    return (
      <Screen>
        <EmptyState
          title="Editor unavailable"
          message={initial.error || "Return to the subject and try again."}
        />
      </Screen>
    );
  const submit = () =>
    void saved.save(
      () => {
        const input =
          kind === "unit"
            ? { title }
            : kind === "topic"
              ? { title, unitId, important, completedAt: done }
              : kind === "note"
                ? { title, body, pinned }
                : kind === "deadline"
                  ? {
                      title,
                      category,
                      dueAt:
                        row &&
                        "dueAt" in row &&
                        date === defaultParts.date &&
                        minute === defaultParts.minute
                          ? row.dueAt
                          : zonedInstant(
                              date,
                              minute,
                              initial.semester!.timezone,
                            ),
                      completedAt: done,
                    }
                  : kind === "mark"
                    ? {
                        title,
                        earned: earned.trim() ? Number(earned) : NaN,
                        maximum: maximum.trim() ? Number(maximum) : NaN,
                        onDate: date,
                      }
                    : { title, url };
        return saveContent(scope, kind, input, row?.id, row?.revision);
      },
      `${kind === "mark" ? "Assessment" : kind[0].toUpperCase() + kind.slice(1)} saved`,
    );
  return (
    <Editor
      title={`${row ? "Edit" : "Add"} ${kind === "mark" ? "assessment" : kind}`}
      dirty={!saved.done && JSON.stringify(form) !== baseline}
      busy={saved.busy}
      primaryAction={{
        label: "Save",
        disabled: !title.trim() || (kind === "topic" && !unitId),
        loading: saved.busy,
        onPress: submit,
      }}
    >
      <ErrorText message={saved.error} />
      <Field
        label={kind === "mark" ? "Assessment name" : "Title"}
        value={title}
        onChangeText={setTitle}
        maxLength={200}
        autoFocus={!row}
        editable={!saved.busy}
      />
      {kind === "topic" && (
        <>
          <Choice
            label="Unit"
            value={unitId}
            options={initial.data.units.map((u) => ({
              value: u.id,
              label: u.title,
            }))}
            onChange={setUnitId}
          />
          {!initial.data.units.length && (
            <Text secondary>Add a unit before adding topics.</Text>
          )}
          <RowActions>
            <Chip
              label="Important"
              selected={important}
              disabled={saved.busy}
              onPress={() => setImportant(!important)}
            />
            <Chip
              label="Done"
              selected={done !== null}
              disabled={saved.busy}
              onPress={() => setDone(done === null ? Date.now() : null)}
            />
          </RowActions>
        </>
      )}
      {kind === "note" && (
        <>
          <RowActions>
            <Chip
              label="Pinned"
              selected={pinned}
              disabled={saved.busy}
              onPress={() => setPinned(!pinned)}
            />
            <Chip
              label={preview ? "Edit text" : "Preview"}
              selected={preview}
              onPress={() => setPreview(!preview)}
            />
          </RowActions>
          {preview ? (
            <GlassCard solid>
              {noteLines(body).map((line) => (
                <NoteBodyLine key={line.index} line={line} />
              ))}
            </GlassCard>
          ) : (
            <>
              <RowActions>
                {(["bold", "bullet", "check"] as const).map((format) => (
                  <Button
                    key={format}
                    label={
                      format === "bold"
                        ? "Bold"
                        : format === "bullet"
                          ? "Bullets"
                          : "Checklist"
                    }
                    variant="secondary"
                    disabled={saved.busy}
                    onPress={() => {
                      const result = formatSelection(body, selection, format);
                      setBody(result.body);
                      setSelection(result.selection);
                    }}
                  />
                ))}
              </RowActions>
              <Field
                label="Note"
                multiline
                value={body}
                onChangeText={setBody}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                selection={selection}
                maxLength={200000}
                style={{ minHeight: 280, textAlignVertical: "top" }}
                editable={!saved.busy}
              />
              <Text variant="caption" secondary>
                Select text to make it bold, or select lines for bullets and
                checklists.
              </Text>
            </>
          )}
        </>
      )}
      {kind === "deadline" && (
        <>
          <Choice
            label="Type"
            value={category}
            options={[
              ...deadlineTypes,
              ...(category === "exam"
                ? [{ value: "exam", label: "Exam (existing)" }]
                : []),
            ]}
            onChange={(value) => setCategory(value as typeof category)}
          />
          <DateField label="Due date" value={date} onChange={setDate} />
          <TimeField label="Due time" value={minute} onChange={setMinute} />
          <Text variant="caption" secondary>
            {initial.semester.timezone} · Repeated clock-change times use the
            earlier occurrence.
          </Text>
          <Chip
            label="Done"
            selected={done !== null}
            disabled={saved.busy}
            onPress={() => setDone(done === null ? Date.now() : null)}
          />
        </>
      )}
      {kind === "mark" && (
        <>
          <Field
            label="Marks earned"
            value={earned}
            onChangeText={setEarned}
            keyboardType="decimal-pad"
            editable={!saved.busy}
          />
          <Field
            label="Maximum marks"
            value={maximum}
            onChangeText={setMaximum}
            keyboardType="decimal-pad"
            editable={!saved.busy}
          />
          <DateField label="Assessment date" value={date} onChange={setDate} />
          <Text variant="caption" secondary>
            Maximum must be positive. Earned marks must be between zero and the
            maximum.
          </Text>
        </>
      )}
      {kind === "link" && (
        <Field
          label="URL"
          value={url}
          onChangeText={setURL}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://"
          editable={!saved.busy}
        />
      )}
      <Button
        label="Save"
        onPress={submit}
        disabled={!title.trim() || (kind === "topic" && !unitId)}
        loading={saved.busy}
      />
      {row && (
        <View style={{ gap: 12 }}>
          <Text variant="caption" secondary>
            {kind === "unit"
              ? "Only empty units without linked notes can be deleted."
              : kind === "topic"
                ? "Topics linked to notes or study sessions must be retained."
                : "You can undo deletion from the confirmation toast."}
          </Text>
          <Button
            label={`Delete ${kind === "mark" ? "assessment" : kind}`}
            variant="destructive"
            disabled={saved.busy}
            onPress={() =>
              Alert.alert(
                `Delete ${row.title}?`,
                "This removes the saved item. You can Undo immediately after deletion.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () =>
                      void saved.save(
                        () => deleteContent(scope, kind, row.id, row.revision),
                        "Item deleted",
                      ),
                  },
                ],
              )
            }
          />
        </View>
      )}
    </Editor>
  );
}
