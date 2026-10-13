import { resolveDay, type LogData } from "./daily-log";

export function subjectDay(data: LogData, date: string, subjectId: string) {
  const day = resolveDay(data, date);
  const rows = day.classes.filter((c) => c.subjectId === subjectId);
  const holiday = data.holidays.some(
    (h) =>
      (h.subjectId === null || h.subjectId === subjectId) &&
      h.startsOn <= date &&
      date <= h.endsOn,
  );
  const present = rows.filter((c) => c.status === "present").length;
  const absent = rows.filter((c) => c.status === "absent").length;
  const pending = rows.filter((c) => c.status === null).length;
  const state:
    | "outside"
    | "holiday"
    | "pending"
    | "mixed"
    | "present"
    | "absent"
    | "neutral"
    | "unconfigured"
    | "noClasses" = day.outside
    ? "outside"
    : holiday && rows.every((c) => c.holiday)
      ? "holiday"
      : pending
        ? "pending"
        : present && absent
          ? "mixed"
          : present
            ? "present"
            : absent
              ? "absent"
              : rows.length
                ? "neutral"
                : !day.configured
                  ? "unconfigured"
                  : "noClasses";
  return { state, rows, present, absent, pending };
}
