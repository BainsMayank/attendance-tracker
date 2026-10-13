import { eq } from "drizzle-orm";
import * as s from "./schema";
import { write } from "./repositories/write";
import { getDatabase, type Database } from "./client";
import { normalizeName, localToday } from "./validation";
import {
  addDays,
  mondayAnchor,
  occurrenceDelta,
  weekday,
} from "@/lib/attendance";

const id = (number: number) =>
  `de000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const semesterId = id(1);
export function demoCounts() {
  const db = getDatabase();
  return {
    subjects: db
      .select()
      .from(s.subjects)
      .all()
      .filter((r) => r.semesterId === semesterId).length,
    slots: db
      .select()
      .from(s.timetableSlots)
      .all()
      .filter((r) => r.semesterId === semesterId).length,
    records: db
      .select()
      .from(s.attendanceRecords)
      .all()
      .filter((r) => r.semesterId === semesterId).length,
  };
}
const fingerprint = (db: Database) =>
  JSON.stringify([
    db
      .select()
      .from(s.semesters)
      .all()
      .filter((r) => r.id === semesterId),
    ...[
      s.subjects,
      s.classTypes,
      s.timetableVersions,
      s.timetableSlots,
      s.attendanceRecords,
    ].map((table) =>
      db
        .select()
        .from(table)
        .all()
        .filter((r) => r.semesterId === semesterId),
    ),
  ]);
export function loadDemoData(): { alreadyLoaded: boolean; undo?: () => void } {
  if (!__DEV__) throw new Error("Demo data is only available in development");
  const db = getDatabase();
  if (db.select().from(s.semesters).where(eq(s.semesters.id, semesterId)).get())
    return { alreadyLoaded: true };
  const previous = db
    .select()
    .from(s.settings)
    .where(eq(s.settings.key, "activeSemesterId"))
    .get();
  write((tx) => {
    const startsOn = addDays(mondayAnchor(localToday("Asia/Kolkata")), -21),
      now = Date.now();
    const meta = (number: number) => ({
      id: id(number),
      createdAt: now,
      updatedAt: now,
      revision: 1,
    });
    tx.insert(s.semesters)
      .values({
        ...meta(1),
        name: "Demo semester",
        startsOn,
        endsOn: addDays(startsOn, 140),
        weekAnchor: startsOn,
        timezone: "Asia/Kolkata",
      })
      .run();
    const names = [
      "Mathematics",
      "Physics",
      "Computer Science",
      "Chemistry",
      "English",
      "Economics",
    ];
    names.forEach((name, i) =>
      tx
        .insert(s.subjects)
        .values({
          ...meta(10 + i),
          semesterId,
          name,
          normalizedName: normalizeName(name),
          code: ["MA101", "PH101", "CS101", "CH101", "EN101", "EC101"][i],
          sortOrder: i,
        })
        .run(),
    );
    tx.insert(s.classTypes)
      .values([
        { ...meta(20), semesterId, name: "Lecture", normalizedName: "lecture" },
        {
          ...meta(21),
          semesterId,
          name: "Lab",
          normalizedName: "lab",
          defaultCountsAs: 2,
        },
      ])
      .run();
    tx.insert(s.timetableVersions)
      .values({
        ...meta(30),
        semesterId,
        label: "Demo week",
        effectiveFrom: startsOn,
      })
      .run();
    for (let day = 1; day <= 7; day++)
      for (let period = 0; period < 3; period++) {
        const i = (day - 1) * 3 + period,
          lab = period === 2 && day % 2 === 0;
        tx.insert(s.timetableSlots)
          .values({
            ...meta(100 + i),
            semesterId,
            versionId: id(30),
            subjectId: id(10 + (i % 6)),
            classTypeId: id(lab ? 21 : 20),
            weekday: day,
            startMinute: 540 + period * 90,
            endMinute: 600 + period * 90,
            countsAs: lab ? 2 : 1,
            room: lab ? "Lab 2" : "A101",
          })
          .run();
      }
    const slots = tx
      .select()
      .from(s.timetableSlots)
      .all()
      .filter((slot) => slot.semesterId === semesterId);
    for (let day = 0; day < 21; day++) {
      const onDate = addDays(startsOn, day);
      for (const slot of slots.filter(
        (slot) => slot.weekday === weekday(onDate),
      )) {
        const n =
            day * 3 +
            slots
              .filter((slot) => slot.weekday === weekday(onDate))
              .indexOf(slot),
          status =
            n % 17 === 0 ? "neutral" : n % 5 === 0 ? "absent" : "present";
        const delta = occurrenceDelta(status, slot.countsAs);
        tx.insert(s.attendanceRecords)
          .values({
            ...meta(1000 + n),
            semesterId,
            subjectId: slot.subjectId,
            onDate,
            kind: "occurrence",
            occurrenceKey: `slot:${slot.id}:${onDate}`,
            slotId: slot.id,
            classTypeId: slot.classTypeId,
            classTypeName: slot.classTypeId === id(21) ? "Lab" : "Lecture",
            startMinute: slot.startMinute,
            endMinute: slot.endMinute,
            room: slot.room,
            countsAs: slot.countsAs,
            status,
            attendedDelta: delta.attended,
            heldDelta: delta.held,
          })
          .run();
      }
    }
    // Existing active selection is retained; the demo is a separate dataset.
    if (!previous || previous.value === null)
      tx.insert(s.settings)
        .values({
          key: "activeSemesterId",
          value: semesterId,
          updatedAt: now,
          revision: (previous?.revision ?? 0) + 1,
        })
        .onConflictDoUpdate({
          target: s.settings.key,
          set: {
            value: semesterId,
            updatedAt: now,
            revision: (previous?.revision ?? 0) + 1,
          },
        })
        .run();
  });
  const initial = fingerprint(db),
    active = db
      .select()
      .from(s.settings)
      .where(eq(s.settings.key, "activeSemesterId"))
      .get();
  return {
    alreadyLoaded: false,
    undo: () =>
      write((tx) => {
        if (fingerprint(tx) !== initial)
          throw new Error("Demo data changed; it has been preserved");
        const current = tx
          .select()
          .from(s.settings)
          .where(eq(s.settings.key, "activeSemesterId"))
          .get();
        if (JSON.stringify(current) !== JSON.stringify(active))
          throw new Error("Active semester changed; demo data preserved");
        for (const table of [
          s.attendanceRecords,
          s.timetableSlots,
          s.timetableVersions,
          s.classTypes,
          s.subjects,
        ])
          tx.delete(table).where(eq(table.semesterId, semesterId)).run();
        if (previous)
          tx.update(s.settings)
            .set({
              ...previous,
              revision: current!.revision + 1,
              updatedAt: Date.now(),
            })
            .where(eq(s.settings.key, "activeSemesterId"))
            .run();
        else
          tx.delete(s.settings)
            .where(eq(s.settings.key, "activeSemesterId"))
            .run();
        tx.delete(s.semesters).where(eq(s.semesters.id, semesterId)).run();
      }),
  };
}
