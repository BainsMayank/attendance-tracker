import type { TimetableData } from "@/db/repositories/timetable-commands";
import { buildTimetableExport } from "../export-format";

test("JSON export preserves timetable references and metadata without attendance or superseded schedules", () => {
  const meta = { createdAt: 1, updatedAt: 1, revision: 1 };
  const version = {
    ...meta,
    semesterId: "semester",
    label: "Current",
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
  };
  const slot = {
    ...meta,
    semesterId: "semester",
    subjectId: "subject",
    classTypeId: "lab",
    weekday: 1,
    startMinute: 540,
    endMinute: 660,
    room: "Lab 2",
    teacher: "Dr Example",
    countsAs: 2,
    lineageId: "old-slot",
  };
  const data: TimetableData = {
    extras: [],
    semester: {
      ...meta,
      id: "semester",
      name: "Semester",
      startsOn: "2026-01-01",
      endsOn: "2026-06-30",
      timezone: "Asia/Kolkata",
      weekAnchor: "2025-12-29",
      targetBps: 7500,
      archivedAt: null,
    },
    subjects: [
      {
        ...meta,
        id: "subject",
        semesterId: "semester",
        name: "Chemistry",
        normalizedName: "chemistry",
        code: "CHEM",
        teacher: "Dr Example",
        color: "#4144D8",
        icon: "science",
        credits: null,
        targetBps: 8000,
        sortOrder: 0,
        archivedAt: 1,
      },
    ],
    types: [
      {
        ...meta,
        id: "lab",
        semesterId: "semester",
        name: "Lab",
        normalizedName: "lab",
        defaultCountsAs: 2,
        archivedAt: null,
      },
    ],
    versions: [
      { ...version, id: "old", supersededAt: 2 },
      { ...version, id: "active", supersededAt: null },
    ],
    slots: [
      { ...slot, id: "old-slot", versionId: "old", parity: "all" },
      { ...slot, id: "new-slot", versionId: "active", parity: "odd" },
      {
        ...slot,
        id: "every-slot",
        versionId: "active",
        weekday: 2,
        parity: "all",
      },
    ],
    records: [
      {
        ...meta,
        id: "private-attendance",
        semesterId: "semester",
        subjectId: "subject",
        onDate: "2026-01-01",
        kind: "adjustment",
        occurrenceKey: null,
        slotId: null,
        extraClassId: null,
        classTypeId: null,
        classTypeName: null,
        startMinute: null,
        endMinute: null,
        room: null,
        countsAs: null,
        status: null,
        attendedDelta: 1,
        heldDelta: 1,
        reason: "Private note",
        source: "manual",
      },
    ],
  };
  const exported = buildTimetableExport(data);
  expect(exported.format).toBe("attendance-tracker/timetable");
  expect(exported.formatVersion).toBe(1);
  expect(exported.subjects[0]).toMatchObject({
    code: "CHEM",
    color: "#4144D8",
    icon: "science",
    targetBps: 8000,
    teacher: "Dr Example",
    archived: true,
  });
  expect(exported.classTypes).toEqual([
    { id: "lab", name: "Lab", countsAs: 2, archived: false },
  ]);
  expect(exported.versions.map((v) => v.id)).toEqual(["active"]);
  expect(exported.slots.map((s) => s.weekPattern)).toEqual(["odd", "every"]);
  expect(exported.slots[0]).toMatchObject({
    versionId: "active",
    subjectId: "subject",
    classTypeId: "lab",
    venue: "Lab 2",
    teacher: "Dr Example",
    startMinute: 540,
    endMinute: 660,
    countsAs: 2,
  });
  expect(JSON.stringify(exported)).not.toMatch(
    /private-attendance|Private note|old-slot|lineageId|supersededAt|revision/,
  );
  expect(data.versions).toHaveLength(2);
  expect(data.slots).toHaveLength(3);
});
