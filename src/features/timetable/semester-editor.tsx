import { useState } from "react";
import { Button, Text } from "@/ui";
import { createTimetableSemester } from "@/db/repositories/timetable-commands";
import { addDays } from "@/lib/attendance";
import { localToday } from "@/db/validation";
import { DateField, Editor, ErrorText, Field, useSave } from "./form-controls";
export function TimetableSemesterScreen() {
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  );
  const [name, setName] = useState("");
  const [start, setStart] = useState(() => localToday(timezone)),
    [end, setEnd] = useState(() => addDays(start, 120));
  const [initial] = useState(JSON.stringify([name, start, end, timezone]));
  const form = useSave();
  const submit = () =>
    void form.save(() => {
      if (end < start)
        throw new Error("Semester end must be on or after its start.");
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone.trim() });
      } catch {
        throw new Error("Enter a valid timezone, such as Asia/Kolkata.");
      }
      return createTimetableSemester(name, start, end, timezone.trim());
    }, "Semester created. Add your subjects next.");
  return (
    <Editor
      title="Set up semester"
      dirty={
        !form.done && initial !== JSON.stringify([name, start, end, timezone])
      }
      busy={form.busy}
      primaryAction={{
        label: "Save",
        loading: form.busy,
        disabled: !name.trim(),
        onPress: submit,
      }}
    >
      <Text secondary>
        A semester gives your timetable its dates and keeps odd/even weeks
        consistent.
      </Text>
      <Field
        label="Semester name"
        placeholder="e.g. Semester 3"
        value={name}
        onChangeText={setName}
        editable={!form.busy}
      />
      <DateField label="Starts on" value={start} onChange={setStart} />
      <DateField label="Ends on" value={end} onChange={setEnd} />
      <Field
        label="Timezone"
        value={timezone}
        onChangeText={setTimezone}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!form.busy}
      />
      <Text variant="caption" secondary>
        Week 1 starts on the Monday on or before your semester start. Default
        attendance target: 75%.
      </Text>
      <ErrorText message={form.error} />
      <Button
        label="Create semester"
        loading={form.busy}
        disabled={!name.trim()}
        onPress={submit}
      />
    </Editor>
  );
}
