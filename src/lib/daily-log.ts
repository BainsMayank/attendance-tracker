import { addDays, dayNumber, weekday, weekIndex } from "./attendance/calendar";
import { selectVersion } from "./timetable";
import type * as schema from "@/db/schema";

export type Status = "present" | "absent" | "neutral";
export type LogData = {
  semester: typeof schema.semesters.$inferSelect;
  subjects: (typeof schema.subjects.$inferSelect)[];
  types: (typeof schema.classTypes.$inferSelect)[];
  versions: (typeof schema.timetableVersions.$inferSelect)[];
  slots: (typeof schema.timetableSlots.$inferSelect)[];
  extras: (typeof schema.extraClasses.$inferSelect)[];
  holidays: (typeof schema.holidays.$inferSelect)[];
  records: (typeof schema.attendanceRecords.$inferSelect)[];
  notes: (typeof schema.classNotes.$inferSelect)[];
};
export type LogClass = {
  key: string;
  slotId?: string;
  extraClassId?: string;
  subjectId: string;
  typeId: string;
  typeName: string;
  startMinute: number;
  endMinute: number;
  room: string | null;
  countsAs: number;
  status: Status | null;
  holiday: boolean;
  cancelled: boolean;
  record?: LogData["records"][number];
  note?: LogData["notes"][number];
};

/** No database, clock, or timezone side effects. Dates are semester-local ISO days. */
export function resolveDay(data: LogData, date: string) {
  dayNumber(date);
  const outside = date < data.semester.startsOn || date > data.semester.endsOn;
  const version = outside ? undefined : selectVersion(data.versions, date);
  const holidays = outside
    ? []
    : data.holidays.filter((h) => h.startsOn <= date && date <= h.endsOn);
  const holiday = holidays.some((h) => h.subjectId === null);
  const blocked = (id: string) =>
    holidays.some((h) => h.subjectId === null || h.subjectId === id);
  const slots = new Map(data.slots.map((s) => [s.id, s]));
  const extras = new Map(data.extras.map((e) => [e.id, e]));
  const types = new Map(data.types.map((t) => [t.id, t.name]));
  const notes = new Map(
    data.notes
      .filter((n) => n.onDate === date)
      .map((n) => [n.occurrenceKey, n]),
  );
  const rows = new Map<string, LogClass>();
  if (!outside) {
    const odd = weekIndex(data.semester.weekAnchor, date) % 2 === 1;
    for (const slot of data.slots) {
      if (
        slot.versionId !== version?.id ||
        slot.weekday !== weekday(date) ||
        (slot.parity !== "all" && (slot.parity === "odd") !== odd)
      )
        continue;
      const key = `slot:${slot.lineageId ?? slot.id}:${date}`;
      rows.set(key, {
        key,
        slotId: slot.id,
        subjectId: slot.subjectId,
        typeId: slot.classTypeId,
        typeName: types.get(slot.classTypeId) ?? "Class",
        startMinute: slot.startMinute,
        endMinute: slot.endMinute,
        room: slot.room,
        countsAs: slot.countsAs,
        status: blocked(slot.subjectId) ? "neutral" : null,
        holiday: blocked(slot.subjectId),
        cancelled: false,
        note: notes.get(key),
      });
    }
    for (const extra of data.extras) {
      if (extra.onDate !== date || extra.cancelledAt !== null) continue;
      const key = `extra:${extra.id}`;
      const excluded = blocked(extra.subjectId) && !extra.allowOnHoliday;
      rows.set(key, {
        key,
        extraClassId: extra.id,
        subjectId: extra.subjectId,
        typeId: extra.classTypeId,
        typeName: types.get(extra.classTypeId) ?? "Class",
        startMinute: extra.startMinute,
        endMinute: extra.endMinute,
        room: extra.room,
        countsAs: extra.countsAs,
        status: excluded ? "neutral" : null,
        holiday: excluded,
        cancelled: false,
        note: notes.get(key),
      });
    }
    // Frozen records win over live clones, including removed or rescheduled classes.
    for (const record of data.records) {
      if (record.onDate !== date || record.kind !== "occurrence") continue;
      const slot = record.slotId ? slots.get(record.slotId) : undefined;
      const extra = record.extraClassId
        ? extras.get(record.extraClassId)
        : undefined;
      const key = slot
        ? `slot:${slot.lineageId ?? slot.id}:${date}`
        : record.occurrenceKey!;
      const excluded = blocked(record.subjectId) && !extra?.allowOnHoliday;
      const cancelled = !!extra?.cancelledAt;
      rows.set(key, {
        key,
        slotId: record.slotId ?? undefined,
        extraClassId: record.extraClassId ?? undefined,
        subjectId: record.subjectId,
        typeId: record.classTypeId!,
        typeName: record.classTypeName!,
        startMinute: record.startMinute!,
        endMinute: record.endMinute!,
        room: record.room,
        countsAs: record.countsAs!,
        status: excluded || cancelled ? "neutral" : record.status!,
        holiday: excluded,
        cancelled,
        record,
        note: notes.get(key),
      });
    }
  }
  const classes = [...rows.values()].sort(
    (a, b) => a.startMinute - b.startMinute || a.key.localeCompare(b.key),
  );
  const marked = classes.filter((c) => c.status !== null).length;
  const state:
    | "outside"
    | "holiday"
    | "unconfigured"
    | "noClasses"
    | "allMarked"
    | "partlyMarked"
    | "unmarked" = outside
    ? "outside"
    : holiday && classes.every((c) => c.holiday)
      ? "holiday"
      : !version
        ? "unconfigured"
        : classes.length === 0
          ? "noClasses"
          : marked === classes.length
            ? "allMarked"
            : marked > 0
              ? "partlyMarked"
              : "unmarked";
  return {
    date,
    outside,
    configured: !!version,
    holiday,
    classes,
    marked,
    state,
  };
}
export type LogDay = ReturnType<typeof resolveDay>;
export function monthBounds(date: string) {
  dayNumber(date);
  const start = `${date.slice(0, 7)}-01`;
  const [year, month] = start.split("-").map(Number);
  const next = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`;
  return {
    start,
    end: addDays(next, -1),
    next,
    previous: addDays(start, -1).slice(0, 7) + "-01",
  };
}
