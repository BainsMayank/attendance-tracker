import type { LogData } from "@/lib/daily-log";
import {
  semesterTables,
  type SemesterRows,
} from "@/db/repositories/semester-data";
import type { AppBackup } from "../backup-model";
export const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const meta = { createdAt: 1, updatedAt: 1, revision: 1 };
export function logFixture(): LogData {
  return {
    semester: {
      ...meta,
      id: id(1),
      name: "Term",
      startsOn: "2026-01-05",
      endsOn: "2026-06-30",
      timezone: "Asia/Kolkata",
      weekAnchor: "2026-01-05",
      targetBps: 7500,
      archivedAt: null,
    },
    subjects: [
      {
        ...meta,
        id: id(2),
        semesterId: id(1),
        name: "Math",
        normalizedName: "math",
        color: "#4144D8",
        code: null,
        icon: null,
        teacher: null,
        credits: null,
        targetBps: null,
        archivedAt: null,
        sortOrder: 0,
      },
    ],
    types: [
      {
        ...meta,
        id: id(3),
        semesterId: id(1),
        name: "Lecture",
        normalizedName: "lecture",
        defaultCountsAs: 1,
        archivedAt: null,
      },
    ],
    versions: [
      {
        ...meta,
        id: id(4),
        semesterId: id(1),
        label: "Week",
        effectiveFrom: "2026-01-05",
        effectiveUntil: null,
        supersededAt: null,
      },
    ],
    slots: [
      {
        ...meta,
        id: id(5),
        semesterId: id(1),
        versionId: id(4),
        subjectId: id(2),
        classTypeId: id(3),
        weekday: 1,
        parity: "all",
        startMinute: 540,
        endMinute: 600,
        room: "101",
        teacher: null,
        lineageId: null,
        countsAs: 1,
      },
    ],
    extras: [],
    holidays: [],
    records: [],
    notes: [],
  };
}
export function backupFixture(): AppBackup {
  const data = logFixture();
  const rows = Object.fromEntries(
    Object.keys(semesterTables).map((k) => [k, []]),
  ) as unknown as SemesterRows;
  rows.semesters = [data.semester];
  rows.subjects = data.subjects;
  rows.classTypes = data.types;
  rows.timetableVersions = data.versions;
  rows.timetableSlots = data.slots;
  return {
    format: "attendance-tracker/app",
    version: 1,
    schemaVersion: 4,
    createdAt: 1,
    activeSemesterId: data.semester.id,
    attachments: "omitted",
    preferences: {},
    rows,
  };
}
