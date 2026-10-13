import { getDatabase, type Database } from "../client";
import { validateDatabase } from "../validation";
import * as s from "../schema";
import { weekIndex, weekday } from "@/lib/attendance";
import { slotsOverlap } from "@/lib/timetable";
import { archivedSnapshot, assertArchivedUnchanged } from "./semester-data";
export class StaleRevisionError extends Error {
  constructor() {
    super("This item changed. Reload it before saving.");
  }
}
export function write<T>(
  operation: (db: Database) => T,
  options: { reviewedScheduleConflicts?: boolean } = {},
): T {
  const db = getDatabase();
  return db.transaction((tx) => {
    const archived = archivedSnapshot(tx);
    const recorded = tx.select().from(s.attendanceRecords).all();
    const slots = tx.select().from(s.timetableSlots).all();
    const versions = tx.select().from(s.timetableVersions).all();
    const extras = tx.select().from(s.extraClasses).all();
    const result = operation(tx);
    const afterRecords = tx.select().from(s.attendanceRecords).all();
    const afterSlots = tx.select().from(s.timetableSlots).all();
    const afterVersions = tx.select().from(s.timetableVersions).all();
    const afterExtras = tx.select().from(s.extraClasses).all();
    const types = tx.select().from(s.classTypes).all();
    for (const record of recorded) {
      const after = afterRecords.find((r) => r.id === record.id);
      if (!after) continue;
      const slot = slots.find((r) => r.id === record.slotId);
      if (
        slot &&
        JSON.stringify(slot) !==
          JSON.stringify(afterSlots.find((r) => r.id === slot.id))
      )
        throw new Error("Recorded slots are immutable; create a new version");
      const extra = extras.find((r) => r.id === record.extraClassId);
      const afterExtra = afterExtras.find((r) => r.id === record.extraClassId);
      if (
        extra &&
        afterExtra &&
        [
          "subjectId",
          "classTypeId",
          "onDate",
          "startMinute",
          "endMinute",
          "countsAs",
          "room",
        ].some(
          (key) =>
            extra[key as keyof typeof extra] !==
            afterExtra[key as keyof typeof extra],
        )
      )
        throw new Error("Recorded extra snapshots are immutable");
      const version = versions.find((r) => r.id === slot?.versionId);
      // A future split may shorten the interval, but cannot reassign a recorded date.
      if (version) {
        const after = afterVersions.find((r) => r.id === version.id);
        if (
          !after ||
          after.effectiveFrom !== version.effectiveFrom ||
          (after.effectiveUntil && after.effectiveUntil <= record.onDate)
        )
          throw new Error("Cannot reassign recorded timetable history");
      }
      for (const key of [
        "countsAs",
        "startMinute",
        "endMinute",
        "room",
        "classTypeId",
        "classTypeName",
        "slotId",
        "extraClassId",
        "occurrenceKey",
        "onDate",
        "subjectId",
      ] as const)
        if (after[key] !== record[key])
          throw new Error(
            "Occurrence snapshots are immutable; use a reviewed correction command",
          );
    }
    for (const record of afterRecords.filter(
      (r) =>
        r.kind === "occurrence" && !recorded.some((old) => old.id === r.id),
    )) {
      const source = record.slotId
        ? afterSlots.find((r) => r.id === record.slotId)
        : afterExtras.find((r) => r.id === record.extraClassId);
      if (
        !source ||
        ["countsAs", "startMinute", "endMinute", "room", "classTypeId"].some(
          (key) =>
            source[key as keyof typeof source] !==
            record[key as keyof typeof record],
        ) ||
        types.find((t) => t.id === record.classTypeId)?.name !==
          record.classTypeName
      )
        throw new Error("New attendance must copy its source snapshot");
    }
    if (!options.reviewedScheduleConflicts) {
      const changedSlots = afterSlots.filter(
        (slot) =>
          JSON.stringify(slot) !==
          JSON.stringify(slots.find((old) => old.id === slot.id)),
      );
      const overlaps = (
        a: { startMinute: number; endMinute: number },
        b: { startMinute: number; endMinute: number },
      ) => a.startMinute < b.endMinute && b.startMinute < a.endMinute;
      for (const slot of changedSlots)
        if (
          afterSlots.some(
            (other) =>
              other.id !== slot.id &&
              other.versionId === slot.versionId &&
              slotsOverlap(slot, other),
          )
        )
          throw new Error("Schedule conflict requires an explicit review");
      const changedExtras = afterExtras.filter(
        (extra) =>
          JSON.stringify(extra) !==
          JSON.stringify(extras.find((old) => old.id === extra.id)),
      );
      const semesters = tx.select().from(s.semesters).all();
      for (const extra of afterExtras.filter((e) => e.cancelledAt === null)) {
        if (
          changedExtras.includes(extra) &&
          afterExtras.some(
            (other) =>
              other.id !== extra.id &&
              other.semesterId === extra.semesterId &&
              other.onDate === extra.onDate &&
              other.cancelledAt === null &&
              overlaps(extra, other),
          )
        )
          throw new Error("Extra class conflict requires an explicit review");
        const sem = semesters.find((r) => r.id === extra.semesterId);
        if (!sem) continue;
        const odd = weekIndex(sem.weekAnchor, extra.onDate) % 2 === 1;
        if (
          afterSlots.some(
            (slot) =>
              (changedExtras.includes(extra) || changedSlots.includes(slot)) &&
              slot.semesterId === extra.semesterId &&
              slot.weekday === weekday(extra.onDate) &&
              (slot.parity === "all" || (slot.parity === "odd") === odd) &&
              afterVersions.some(
                (v) =>
                  v.id === slot.versionId &&
                  v.supersededAt === null &&
                  v.effectiveFrom <= extra.onDate &&
                  (!v.effectiveUntil || extra.onDate < v.effectiveUntil),
              ) &&
              overlaps(slot, extra),
          )
        )
          throw new Error("Slot/extra conflict requires an explicit review");
      }
    }
    assertArchivedUnchanged(tx, archived);
    validateDatabase(tx);
    return result;
  });
}
