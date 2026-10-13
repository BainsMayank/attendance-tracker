import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import {
  attendanceRecords,
  timetableSlots,
  extraClasses,
  classTypes,
  timetableVersions,
} from "../schema";
import { occurrenceDelta, dayNumber } from "@/lib/attendance";
import { write, StaleRevisionError } from "./write";
export function markOccurrence(input: {
  slotId?: string;
  extraClassId?: string;
  onDate: string;
  status: "present" | "absent" | "neutral";
  expectedRevision: number | null;
}) {
  dayNumber(input.onDate);
  if (!!input.slotId === !!input.extraClassId)
    throw new Error("Select exactly one occurrence source");
  return write((db) => {
    const source = input.slotId
      ? db
          .select()
          .from(timetableSlots)
          .where(eq(timetableSlots.id, input.slotId))
          .get()
      : db
          .select()
          .from(extraClasses)
          .where(eq(extraClasses.id, input.extraClassId!))
          .get();
    if (!source) throw new Error("Class unavailable");
    const key = input.slotId
      ? `slot:${input.slotId}:${input.onDate}`
      : `extra:${input.extraClassId}`;
    let existing = db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.occurrenceKey, key))
      .get();
    if (!existing && input.slotId && "lineageId" in source) {
      const slots = db.select().from(timetableSlots).all();
      const root = source.lineageId ?? source.id;
      existing = db.select().from(attendanceRecords).all().find(r => {
        const slot = slots.find(s => s.id === r.slotId);
        return r.onDate === input.onDate && slot && (slot.lineageId ?? slot.id) === root;
      });
    }
    if (existing) {
      if (existing.revision !== input.expectedRevision)
        throw new StaleRevisionError();
      const delta = occurrenceDelta(input.status, existing.countsAs!);
      return db
        .update(attendanceRecords)
        .set({
          status: input.status,
          attendedDelta: delta.attended,
          heldDelta: delta.held,
          updatedAt: Date.now(),
          revision: sql`${attendanceRecords.revision} + 1`,
        })
        .where(eq(attendanceRecords.id, existing.id))
        .returning()
        .get();
    }
    if (input.expectedRevision !== null) throw new StaleRevisionError();
    if ("versionId" in source) {
      const version = db.select().from(timetableVersions).where(eq(timetableVersions.id, source.versionId)).get();
      if (!version || version.supersededAt !== null)
        throw new Error("The timetable changed. Reload this day before marking attendance.");
    }
    const type = db
      .select()
      .from(classTypes)
      .where(eq(classTypes.id, source.classTypeId))
      .get()!;
    const delta = occurrenceDelta(input.status, source.countsAs),
      now = Date.now();
    return db
      .insert(attendanceRecords)
      .values({
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        semesterId: source.semesterId,
        subjectId: source.subjectId,
        onDate: input.onDate,
        kind: "occurrence",
        occurrenceKey: key,
        slotId: input.slotId ?? null,
        extraClassId: input.extraClassId ?? null,
        classTypeId: type.id,
        classTypeName: type.name,
        startMinute: source.startMinute,
        endMinute: source.endMinute,
        room: source.room,
        countsAs: source.countsAs,
        status: input.status,
        attendedDelta: delta.attended,
        heldDelta: delta.held,
      })
      .returning()
      .get();
  });
}
export function resetOccurrence(id: string, revision: number) {
  return write((db) => {
    const row = db
      .delete(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.id, id),
          eq(attendanceRecords.revision, revision),
        ),
      )
      .returning()
      .get();
    if (!row) throw new StaleRevisionError();
    return row;
  });
}
