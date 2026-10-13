import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/features/shell/screen";
import {
  Choice,
  Editor,
  ErrorText,
  Field,
  TimeField,
} from "@/features/timetable/form-controls";
import { Button, Skeleton, Text } from "@/ui";
import { localToday } from "@/db/validation";
import {
  addExtraClass,
  dayFingerprint,
  saveClassNote,
} from "@/db/repositories/daily-log";
import { resolveDay, type LogData } from "@/lib/daily-log";
import { dayNumber } from "@/lib/attendance";
import { useLogData, useLogMutation } from "./hooks";

export function LogEditorScreen({ note = false }: { note?: boolean }) {
  const params = useLocalSearchParams<{
    date?: string;
    key?: string;
    semesterId?: string;
  }>();
  let date = localToday(Intl.DateTimeFormat().resolvedOptions().timeZone),
    valid = false;
  try {
    if (params.date) {
      dayNumber(params.date);
      date = params.date;
      valid = true;
    }
  } catch {}
  const { data, loading, error, reload } = useLogData(date, params.semesterId);
  if (loading)
    return (
      <Screen>
        <Skeleton height={200} />
      </Screen>
    );
  if (error)
    return (
      <Screen>
        <ErrorText message={error} />
        <Button label="Retry" onPress={reload} />
      </Screen>
    );
  if (
    !valid ||
    !data ||
    resolveDay(data, date).outside ||
    date > localToday(data.semester.timezone) ||
    data.semester.archivedAt !== null
  )
    return (
      <Screen>
        <Text>This day is view-only or unavailable.</Text>
      </Screen>
    );
  return note ? (
    <NoteEditor
      key={`${data.semester.id}:${date}:${params.key}`}
      data={data}
      date={date}
      occurrenceKey={params.key ?? ""}
    />
  ) : (
    <ExtraEditor key={`${data.semester.id}:${date}`} data={data} date={date} />
  );
}
function NoteEditor({
  data,
  date,
  occurrenceKey,
}: {
  data: LogData;
  date: string;
  occurrenceKey: string;
}) {
  const [row] = useState(() =>
    resolveDay(data, date).classes.find((c) => c.key === occurrenceKey),
  );
  const [expected] = useState(() => dayFingerprint(data, date));
  const [body, setBody] = useState(row?.note?.body ?? ""),
    [done, setDone] = useState(false);
  const mutation = useLogMutation();
  if (!row)
    return (
      <Screen>
        <Text>Class unavailable. Return to Daily Log.</Text>
      </Screen>
    );
  return (
    <Editor
      title="Class note"
      dirty={!done && body !== (row.note?.body ?? "")}
      busy={mutation.busy}
      primaryAction={{
        label: "Save",
        disabled: body.length > 10000,
        loading: mutation.busy,
        onPress: () => {
          void mutation
            .run(
              () =>
                saveClassNote({
                  semesterId: data.semester.id,
                  date,
                  expected,
                  key: row.key,
                  body,
                }),
              "Class note saved",
            )
            .then((saved) => {
              if (saved) {
                setDone(true);
                requestAnimationFrame(() => router.back());
              }
            });
        },
      }}
    >
      <Text variant="title">
        {data.subjects.find((s) => s.id === row.subjectId)?.name} · {date}
      </Text>
      <Field
        label="Optional note"
        multiline
        value={body}
        onChangeText={setBody}
        maxLength={10000}
        style={{ minHeight: 180, textAlignVertical: "top" }}
      />
      <Text secondary variant="secondary">
        Clearing attendance keeps this note. Clear the text and save to remove
        it.
      </Text>
      <ErrorText message={mutation.error} />
    </Editor>
  );
}
function ExtraEditor({ data, date }: { data: LogData; date: string }) {
  const subjects = data.subjects.filter((s) => s.archivedAt === null),
    types = data.types.filter((t) => t.archivedAt === null);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? ""),
    [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [initialStart] = useState(() => {
    let candidate = 540;
    for (const row of resolveDay(data, date).classes) {
      if (row.startMinute < candidate + 60 && candidate < row.endMinute)
        candidate = row.endMinute;
    }
    return candidate <= 1380 ? candidate : 540;
  });
  const [startMinute, setStart] = useState(initialStart),
    [endMinute, setEnd] = useState(initialStart + 60);
  const [room, setRoom] = useState(""),
    [note, setNote] = useState(""),
    [done, setDone] = useState(false);
  const [expected] = useState(() => dayFingerprint(data, date));
  const mutation = useLogMutation();
  const dirty =
    subjectId !== (subjects[0]?.id ?? "") ||
    typeId !== (types[0]?.id ?? "") ||
    startMinute !== initialStart ||
    endMinute !== initialStart + 60 ||
    !!room ||
    !!note;
  return (
    <Editor
      title="Add extra class"
      dirty={dirty && !done}
      busy={mutation.busy}
      primaryAction={{
        label: "Save",
        disabled: !subjectId || !typeId || startMinute >= endMinute,
        loading: mutation.busy,
        onPress: () => {
          void mutation
            .run(
              () =>
                addExtraClass({
                  semesterId: data.semester.id,
                  date,
                  expected,
                  subjectId,
                  typeId,
                  startMinute,
                  endMinute,
                  room,
                  note,
                }),
              "Extra class added",
            )
            .then((saved) => {
              if (saved) {
                setDone(true);
                requestAnimationFrame(() => router.back());
              }
            });
        },
      }}
    >
      <Text secondary>{date} · adds one class to this day</Text>
      <Choice
        label="Subject"
        value={subjectId}
        options={subjects.map((s) => ({ value: s.id, label: s.name }))}
        onChange={setSubjectId}
      />
      <Choice
        label="Class type"
        value={typeId}
        options={types.map((t) => ({ value: t.id, label: t.name }))}
        onChange={setTypeId}
      />
      <Text secondary variant="secondary">
        Counts as {types.find((t) => t.id === typeId)?.defaultCountsAs ?? 1}{" "}
        attendance units.
      </Text>
      <TimeField label="Start time" value={startMinute} onChange={setStart} />
      <TimeField label="End time" value={endMinute} onChange={setEnd} />
      {startMinute >= endMinute && (
        <ErrorText message="End time must be after start time." />
      )}
      <Field
        label="Venue (optional)"
        value={room}
        onChangeText={setRoom}
        maxLength={500}
      />
      <Field
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={10000}
      />
      {resolveDay(data, date).holiday && (
        <Text secondary>
          This is a holiday. The extra class will stay visible as neutral.
        </Text>
      )}
      <ErrorText message={mutation.error} />
    </Editor>
  );
}
