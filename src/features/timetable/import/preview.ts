import type {
  SlotDraft,
  TimetableData,
} from "@/db/repositories/timetable-commands";
import { selectVersion, slotsOverlap } from "@/lib/timetable";
import { weekIndex, weekday } from "@/lib/attendance";
import { nameKey, type ImportDraft } from "./parser";

export type ImportMode = "replace" | "merge";
export function buildImportPreview(
  draft: ImportDraft,
  data: TimetableData,
  mode: ImportMode,
  from: string,
) {
  const errors: string[] = [];
  const subjects = draft.subjects.map((subject) => {
    const matches = data.subjects.filter(
      (s) => nameKey(s.name) === nameKey(subject.name),
    );
    if (matches.length > 1)
      errors.push(
        `More than one existing subject matches "${subject.name}". Rename them before importing.`,
      );
    const existing = matches[0];
    if (existing?.archivedAt != null)
      errors.push(
        `"${existing.name}" is archived. Restore it in Manage subjects first.`,
      );
    return {
      ...subject,
      id: existing?.id ?? `subject:${nameKey(subject.name)}`,
      existing: !!existing,
    };
  });
  const types = [...new Set(draft.slots.map((s) => nameKey(s.classType)))].map(
    (key) => {
      const matches = data.types.filter((t) => nameKey(t.name) === key);
      if (matches.length > 1)
        errors.push(
          `More than one class type matches "${key}". Rename them before importing.`,
        );
      const existing = matches[0];
      if (existing?.archivedAt != null)
        errors.push(
          `Class type "${existing.name}" is archived. Restore it first.`,
        );
      return {
        key,
        id: existing?.id ?? `type:${key}`,
        name: draft.slots.find((s) => nameKey(s.classType) === key)!.classType,
        existing: !!existing,
      };
    },
  );
  const version = selectVersion(data.versions, from);
  const originals = data.slots.filter((s) => s.versionId === version?.id);
  type PreviewSlot = SlotDraft & {
    label: string;
    subjectName: string;
    classTypeName: string;
    imported: boolean;
  };
  const slots: PreviewSlot[] =
    mode === "merge"
      ? originals.map((s) => ({
          ...s,
          label: "Existing class",
          imported: false,
          subjectName: data.subjects.find(
            (subject) => subject.id === s.subjectId,
          )!.name,
          classTypeName: data.types.find((t) => t.id === s.classTypeId)!.name,
        }))
      : [];
  let duplicates = 0;
  const identity = (s: SlotDraft) =>
    JSON.stringify([
      s.subjectId,
      s.classTypeId,
      s.weekday,
      s.parity,
      s.startMinute,
      s.endMinute,
      s.room,
      s.teacher,
      s.countsAs,
    ]);
  for (const slot of draft.slots) {
    const entry: PreviewSlot = {
      subjectId: subjects.find(
        (s) => nameKey(s.name) === nameKey(slot.subject),
      )!.id,
      classTypeId: types.find((t) => t.key === nameKey(slot.classType))!.id,
      weekday: slot.weekday,
      parity: slot.weekPattern === "every" ? "all" : slot.weekPattern,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
      room: slot.venue || null,
      teacher: slot.teacher || null,
      countsAs: slot.countsAs,
      label: `Slot ${slot.index}`,
      subjectName: slot.subject,
      classTypeName: slot.classType,
      imported: true,
    };
    if (slots.some((s) => identity(s) === identity(entry))) {
      duplicates++;
      continue;
    }
    // Reuse lineage even for a replacement containing the same occurrence.
    entry.id = originals.find((s) => identity(s) === identity(entry))?.id;
    slots.push(entry);
  }
  const conflicts = new Map<number, string[]>();
  const flag = (i: number, message: string) =>
    conflicts.set(i, [...(conflicts.get(i) ?? []), message]);
  for (let i = 0; i < slots.length; i++) {
    for (let j = 0; j < i; j++)
      if (slotsOverlap(slots[i], slots[j])) {
        flag(i, `Overlaps ${slots[j].label}: ${slots[j].subjectName}`);
        flag(j, `Overlaps ${slots[i].label}: ${slots[i].subjectName}`);
      }
  }
  for (const [i, messages] of extraConflicts(slots, data.extras, data, from))
    for (const message of messages) flag(i, message);
  return {
    subjects,
    types,
    slots,
    conflicts,
    errors,
    duplicates,
    sourceVersionId: version?.id,
  };
}

// Extra classes remain after Replace. Check them over the new version's range too.
export function extraConflicts(
  slots: SlotDraft[],
  extras: {
    onDate: string;
    startMinute: number;
    endMinute: number;
    cancelledAt: number | null;
  }[],
  data: TimetableData,
  from: string,
) {
  const result = new Map<number, string[]>();
  slots.forEach((slot, i) => {
    for (const extra of extras) {
      if (
        extra.cancelledAt !== null ||
        extra.onDate < from ||
        extra.onDate > data.semester.endsOn
      )
        continue;
      const parity =
        weekIndex(data.semester.weekAnchor, extra.onDate) % 2 === 1
          ? "odd"
          : "even";
      if (
        slot.weekday === weekday(extra.onDate) &&
        (slot.parity === "all" || slot.parity === parity) &&
        slot.startMinute < extra.endMinute &&
        extra.startMinute < slot.endMinute
      )
        result.set(i, [
          ...(result.get(i) ?? []),
          `Overlaps an extra class on ${extra.onDate}`,
        ]);
    }
  });
  return result;
}
