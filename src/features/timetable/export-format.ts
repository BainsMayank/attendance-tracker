import type { TimetableData } from "@/db/repositories/timetable-commands";
export function buildTimetableExport(data: TimetableData) {
  const versions = data.versions.filter((v) => v.supersededAt === null);
  const slots = data.slots.filter((s) =>
    versions.some((v) => v.id === s.versionId),
  );
  return {
    format: "attendance-tracker/timetable",
    formatVersion: 1,
    semester: {
      name: data.semester.name,
      startsOn: data.semester.startsOn,
      endsOn: data.semester.endsOn,
      timezone: data.semester.timezone,
      weekAnchor: data.semester.weekAnchor,
      targetBps: data.semester.targetBps,
    },
    subjects: data.subjects.map(
      ({ id, name, code, color, icon, targetBps, teacher, archivedAt }) => ({
        id,
        name,
        code,
        color,
        icon,
        targetBps,
        teacher,
        archived: archivedAt !== null,
      }),
    ),
    classTypes: data.types.map(({ id, name, defaultCountsAs, archivedAt }) => ({
      id,
      name,
      countsAs: defaultCountsAs,
      archived: archivedAt !== null,
    })),
    versions: versions.map(({ id, effectiveFrom, effectiveUntil, label }) => ({
      id,
      effectiveFrom,
      effectiveUntil,
      label,
    })),
    slots: slots.map(
      ({
        id,
        versionId,
        subjectId,
        classTypeId,
        weekday,
        parity,
        startMinute,
        endMinute,
        room,
        teacher,
        countsAs,
      }) => ({
        id,
        versionId,
        subjectId,
        classTypeId,
        weekday,
        weekPattern: parity === "all" ? "every" : parity,
        startMinute,
        endMinute,
        venue: room,
        teacher,
        countsAs,
      }),
    ),
  };
}
