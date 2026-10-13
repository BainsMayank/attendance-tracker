import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { getDatabase, type Database } from "../client";
import * as s from "../schema";
import { localToday } from "../validation";
import { StaleRevisionError } from "./write";
import {
  addDays,
  dayNumber,
  ledgerTotals,
  occurrenceDelta,
} from "@/lib/attendance";
import {
  resolveDay,
  type LogData,
  type LogClass,
  type Status,
} from "@/lib/daily-log";
import { validateSlots } from "@/lib/timetable";

export function logRange(
  semesterId: string,
  start: string,
  end: string,
  db: Database = getDatabase(),
  includeHistory = true,
): LogData {
  dayNumber(start);
  dayNumber(end);
  const semester = db
    .select()
    .from(s.semesters)
    .where(eq(s.semesters.id, semesterId))
    .get();
  if (!semester) throw new Error("Select a semester first.");
  return {
    semester,
    subjects: db
      .select()
      .from(s.subjects)
      .where(eq(s.subjects.semesterId, semesterId))
      .all(),
    types: db
      .select()
      .from(s.classTypes)
      .where(eq(s.classTypes.semesterId, semesterId))
      .all(),
    versions: db
      .select()
      .from(s.timetableVersions)
      .where(eq(s.timetableVersions.semesterId, semesterId))
      .all(),
    slots: db
      .select()
      .from(s.timetableSlots)
      .where(eq(s.timetableSlots.semesterId, semesterId))
      .all(),
    extras: db
      .select()
      .from(s.extraClasses)
      .where(
        and(
          eq(s.extraClasses.semesterId, semesterId),
          gte(s.extraClasses.onDate, start),
          lte(s.extraClasses.onDate, end),
        ),
      )
      .all(),
    holidays: db
      .select()
      .from(s.holidays)
      .where(
        and(
          eq(s.holidays.semesterId, semesterId),
          lte(s.holidays.startsOn, end),
          gte(s.holidays.endsOn, start),
        ),
      )
      .all(),
    records: includeHistory
      ? db
          .select()
          .from(s.attendanceRecords)
          .where(
            and(
              eq(s.attendanceRecords.semesterId, semesterId),
              gte(s.attendanceRecords.onDate, start),
              lte(s.attendanceRecords.onDate, end),
            ),
          )
          .all()
      : [],
    notes: includeHistory
      ? db
          .select()
          .from(s.classNotes)
          .where(
            and(
              eq(s.classNotes.semesterId, semesterId),
              gte(s.classNotes.onDate, start),
              lte(s.classNotes.onDate, end),
            ),
          )
          .all()
      : [],
  };
}
export function subjectTotals(semesterId: string, today: string) {
  return getDatabase()
    .select({
      subjectId: s.attendanceRecords.subjectId,
      attended:
        sql<number>`coalesce(sum(${s.attendanceRecords.attendedDelta}), 0)`.mapWith(
          Number,
        ),
      held: sql<number>`coalesce(sum(${s.attendanceRecords.heldDelta}), 0)`.mapWith(
        Number,
      ),
    })
    .from(s.attendanceRecords)
    .where(
      and(
        eq(s.attendanceRecords.semesterId, semesterId),
        lte(s.attendanceRecords.onDate, today),
      ),
    )
    .groupBy(s.attendanceRecords.subjectId)
    .all();
}
export function dayFingerprint(data: LogData, date: string) {
  return JSON.stringify([
    data.semester,
    data.subjects,
    data.types,
    data.versions,
    data.slots,
    data.extras.filter((e) => e.onDate === date),
    data.holidays.filter((h) => h.startsOn <= date && date <= h.endsOn),
    data.records.filter((r) => r.onDate === date),
    data.notes.filter((n) => n.onDate === date),
  ]);
}
const meta = () => ({
  id: randomUUID(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  revision: 1,
});
function editable(data: LogData, date: string) {
  if (data.semester.archivedAt !== null)
    throw new Error("Archived semesters are read-only.");
  if (date < data.semester.startsOn || date > data.semester.endsOn)
    throw new Error("Date outside semester.");
  if (date > localToday(data.semester.timezone))
    throw new Error("Future days are view-only.");
}
function validateLedgers(db: Database, subjectIds: Set<string>) {
  for (const id of subjectIds)
    ledgerTotals(
      db
        .select()
        .from(s.attendanceRecords)
        .where(eq(s.attendanceRecords.subjectId, id))
        .all(),
    );
}
type DayInput = { semesterId: string; date: string; expected: string };

/** Scoped transactions: foreign keys/checks plus source validation and every affected ledger prefix. */
function changeDay(
  input: DayInput,
  operation: (db: Database, data: LogData) => void,
) {
  const db = getDatabase();
  const capture = (tx: Database) => ({
    data: logRange(input.semesterId, input.date, input.date, tx),
    holidays: tx
      .select()
      .from(s.holidays)
      .where(eq(s.holidays.semesterId, input.semesterId))
      .all(),
  });
  const { before, after } = db.transaction((tx) => {
    const before = capture(tx);
    editable(before.data, input.date);
    if (dayFingerprint(before.data, input.date) !== input.expected)
      throw new StaleRevisionError();
    operation(tx, before.data);
    const after = capture(tx);
    validateLedgers(
      tx,
      new Set(
        [...before.data.records, ...after.data.records].map((r) => r.subjectId),
      ),
    );
    return { before, after };
  });
  let used = false;
  return {
    undo: () => {
      db.transaction((tx) => {
        if (used) throw new Error("This change was already undone.");
        const current = capture(tx);
        editable(current.data, input.date);
        if (
          dayFingerprint(current.data, input.date) !==
            dayFingerprint(after.data, input.date) ||
          JSON.stringify(current.holidays) !== JSON.stringify(after.holidays)
        )
          throw new Error("This day changed. Newer data was preserved.");
        // Restore only rows this command changed. Unrelated revisions remain intact.
        const changes = <
          T extends { id: string; revision: number; updatedAt: number },
        >(
          old: T[],
          saved: T[],
        ) => {
          const oldById = new Map(old.map((row) => [row.id, row]));
          const savedById = new Map(saved.map((row) => [row.id, row]));
          return {
            remove: saved
              .filter((row) => !oldById.has(row.id))
              .map((row) => row.id),
            restore: old
              .filter(
                (row) =>
                  JSON.stringify(row) !== JSON.stringify(savedById.get(row.id)),
              )
              .map((row) => ({
                ...row,
                revision:
                  Math.max(row.revision, savedById.get(row.id)?.revision ?? 0) +
                  1,
                updatedAt: Date.now(),
              })),
          };
        };
        const records = changes(before.data.records, after.data.records);
        const notes = changes(before.data.notes, after.data.notes);
        const extras = changes(before.data.extras, after.data.extras);
        const holidays = changes(before.holidays, after.holidays);
        if (records.remove.length)
          tx.delete(s.attendanceRecords)
            .where(inArray(s.attendanceRecords.id, records.remove))
            .run();
        if (notes.remove.length)
          tx.delete(s.classNotes)
            .where(inArray(s.classNotes.id, notes.remove))
            .run();
        if (extras.remove.length)
          tx.delete(s.extraClasses)
            .where(inArray(s.extraClasses.id, extras.remove))
            .run();
        if (holidays.remove.length)
          tx.delete(s.holidays)
            .where(inArray(s.holidays.id, holidays.remove))
            .run();
        for (const row of extras.restore)
          tx.insert(s.extraClasses)
            .values(row)
            .onConflictDoUpdate({ target: s.extraClasses.id, set: row })
            .run();
        for (const row of records.restore)
          tx.insert(s.attendanceRecords)
            .values(row)
            .onConflictDoUpdate({ target: s.attendanceRecords.id, set: row })
            .run();
        for (const row of notes.restore)
          tx.insert(s.classNotes)
            .values(row)
            .onConflictDoUpdate({ target: s.classNotes.id, set: row })
            .run();
        for (const row of holidays.restore)
          tx.insert(s.holidays)
            .values(row)
            .onConflictDoUpdate({ target: s.holidays.id, set: row })
            .run();
        validateLedgers(
          tx,
          new Set(
            [...before.data.records, ...after.data.records].map(
              (r) => r.subjectId,
            ),
          ),
        );
      });
      used = true;
    },
  };
}

function setStatus(
  db: Database,
  data: LogData,
  date: string,
  row: LogClass,
  status: Status | null,
) {
  if (status !== null && !["present", "absent", "neutral"].includes(status))
    throw new Error("Invalid attendance status.");
  if (row.record) {
    if (status === null)
      db.delete(s.attendanceRecords)
        .where(eq(s.attendanceRecords.id, row.record.id))
        .run();
    else {
      const delta = occurrenceDelta(status, row.record.countsAs!);
      db.update(s.attendanceRecords)
        .set({
          status,
          attendedDelta: delta.attended,
          heldDelta: delta.held,
          revision: row.record.revision + 1,
          updatedAt: Date.now(),
        })
        .where(eq(s.attendanceRecords.id, row.record.id))
        .run();
    }
  } else if (status !== null) {
    const delta = occurrenceDelta(status, row.countsAs);
    db.insert(s.attendanceRecords)
      .values({
        ...meta(),
        semesterId: data.semester.id,
        subjectId: row.subjectId,
        onDate: date,
        kind: "occurrence",
        occurrenceKey: row.slotId
          ? `slot:${row.slotId}:${date}`
          : `extra:${row.extraClassId}`,
        slotId: row.slotId ?? null,
        extraClassId: row.extraClassId ?? null,
        classTypeId: row.typeId,
        classTypeName: row.typeName,
        startMinute: row.startMinute,
        endMinute: row.endMinute,
        room: row.room,
        countsAs: row.countsAs,
        status,
        attendedDelta: delta.attended,
        heldDelta: delta.held,
      })
      .run();
  }
}
export function markClass(
  input: DayInput & { key: string; status: Status | null },
) {
  return changeDay(input, (db, data) => {
    const row = resolveDay(data, input.date).classes.find(
      (c) => c.key === input.key,
    );
    if (!row) throw new Error("Class unavailable. Reload this day.");
    if (row.holiday || row.cancelled)
      throw new Error(
        "This class is neutral. Remove the holiday before marking it.",
      );
    setStatus(db, data, input.date, row, input.status);
  });
}
export function markAllPresent(input: DayInput) {
  return changeDay(input, (db, data) => {
    const rows = resolveDay(data, input.date).classes.filter(
      (c) => !c.holiday && !c.cancelled,
    );
    if (!rows.length) throw new Error("No eligible classes on this day.");
    for (const row of rows) setStatus(db, data, input.date, row, "present");
  });
}
export function toggleDayHoliday(input: DayInput) {
  return changeDay(input, (db, data) => {
    const day = resolveDay(data, input.date);
    if (day.holiday) {
      for (const holiday of data.holidays.filter((h) => h.subjectId === null)) {
        db.delete(s.holidays).where(eq(s.holidays.id, holiday.id)).run();
        if (holiday.startsOn < input.date)
          db.insert(s.holidays)
            .values({ ...holiday, ...meta(), endsOn: addDays(input.date, -1) })
            .run();
        if (holiday.endsOn > input.date)
          db.insert(s.holidays)
            .values({ ...holiday, ...meta(), startsOn: addDays(input.date, 1) })
            .run();
      }
    } else {
      db.insert(s.holidays)
        .values({
          ...meta(),
          semesterId: input.semesterId,
          subjectId: null,
          startsOn: input.date,
          endsOn: input.date,
          title: "Day off",
        })
        .run();
      for (const row of day.classes) {
        const extra = data.extras.find((e) => e.id === row.extraClassId);
        if (!extra?.allowOnHoliday && !row.cancelled)
          setStatus(db, data, input.date, row, "neutral");
      }
    }
  });
}
export function saveClassNote(input: DayInput & { key: string; body: string }) {
  return changeDay(input, (db, data) => {
    const row = resolveDay(data, input.date).classes.find(
      (c) => c.key === input.key,
    );
    if (!row) throw new Error("Class unavailable.");
    if (input.body.length > 10000)
      throw new Error("Notes can contain up to 10,000 characters.");
    if (row.note)
      db.delete(s.classNotes).where(eq(s.classNotes.id, row.note.id)).run();
    if (input.body.trim())
      db.insert(s.classNotes)
        .values({
          ...(row.note ?? meta()),
          revision: (row.note?.revision ?? 0) + 1,
          updatedAt: Date.now(),
          semesterId: input.semesterId,
          subjectId: row.subjectId,
          onDate: input.date,
          occurrenceKey: row.key,
          body: input.body.trim(),
        })
        .run();
  });
}
export function addExtraClass(
  input: DayInput & {
    subjectId: string;
    typeId: string;
    startMinute: number;
    endMinute: number;
    room: string;
    note: string;
  },
) {
  return changeDay(input, (db, data) => {
    const subject = data.subjects.find(
      (s) => s.id === input.subjectId && s.archivedAt === null,
    );
    const type = data.types.find(
      (t) => t.id === input.typeId && t.archivedAt === null,
    );
    if (!subject || !type)
      throw new Error("Choose an active subject and class type.");
    validateSlots([
      {
        weekday: 1,
        parity: "all",
        startMinute: input.startMinute,
        endMinute: input.endMinute,
      },
    ]);
    if (
      resolveDay(data, input.date).classes.some(
        (c) =>
          !c.cancelled &&
          c.startMinute < input.endMinute &&
          input.startMinute < c.endMinute,
      )
    )
      throw new Error(
        "This extra class overlaps another class. Choose another time.",
      );
    if (input.note.length > 10000 || input.room.length > 500)
      throw new Error("The note or venue is too long.");
    const extra = {
      ...meta(),
      semesterId: input.semesterId,
      subjectId: subject.id,
      classTypeId: type.id,
      onDate: input.date,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      room: input.room.trim() || null,
      countsAs: type.defaultCountsAs,
    };
    db.insert(s.extraClasses).values(extra).run();
    if (input.note.trim())
      db.insert(s.classNotes)
        .values({
          ...meta(),
          semesterId: input.semesterId,
          subjectId: subject.id,
          onDate: input.date,
          occurrenceKey: `extra:${extra.id}`,
          body: input.note.trim(),
        })
        .run();
  });
}
