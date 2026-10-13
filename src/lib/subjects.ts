import type { LogData } from "./daily-log";
import type { deadlines } from "@/db/schema";
import {
  addDays,
  aggregate,
  attendanceStatus,
  canSkip,
  classesNeeded,
  expandDay,
  meetsTarget,
  percentage,
  calendarDaysBetween,
} from "./attendance";

export type SubjectSort = "name" | "percentage" | "nextClass";
export const sortOptions = [
  { value: "name", label: "Name" },
  { value: "percentage", label: "Attendance · low to high" },
  { value: "nextClass", label: "Next class" },
] satisfies { value: SubjectSort; label: string }[];
export type NextClass = {
  date: string;
  startMinute: number;
  countsAs: number;
  room?: string;
};

/** Expand actual future occurrences, including version boundaries, holidays and extras. */
export function nextClasses(data: LogData, today: string, minute: number) {
  const result = new Map<string, NextClass>();
  const active = new Set(
    data.subjects.filter((s) => s.archivedAt === null).map((s) => s.id),
  );
  const slots = new Map(data.slots.map((s) => [s.id, s]));
  const extras = new Map(data.extras.map((e) => [e.id, e]));
  const schedule = { ...data.semester, ...data };
  const start = today < data.semester.startsOn ? data.semester.startsOn : today;
  for (
    let date = start;
    date <= data.semester.endsOn && result.size < active.size;
    date = addDays(date, 1)
  ) {
    for (const occurrence of expandDay(schedule, date).occurrences) {
      if (!active.has(occurrence.subjectId)) continue;
      const source = occurrence.key.startsWith("slot:")
        ? slots.get(occurrence.key.split(":")[1])
        : extras.get(occurrence.key.slice(6));
      if (!source || (date === today && source.startMinute <= minute)) continue;
      const previous = result.get(occurrence.subjectId);
      if (
        !previous ||
        date < previous.date ||
        (date === previous.date && source.startMinute < previous.startMinute)
      )
        result.set(occurrence.subjectId, {
          date,
          startMinute: source.startMinute,
          countsAs: occurrence.countsAs,
          room: ("room" in source && source.room) || undefined,
        });
    }
  }
  return result;
}

export function recommendation(
  attended: number,
  held: number,
  target: number,
  weighted: boolean,
) {
  if (target === 0) return "No minimum target";
  if (!held) return "Attend your first class to start tracking";
  const needed = classesNeeded(attended, held, target);
  if (needed.kind === "unreachableExactly")
    return "Exact 100% cannot be reached with this history";
  const unit = weighted ? " attendance units" : "";
  if (needed.kind === "finite" && needed.units > 0)
    return `Attend next ${needed.units}${unit} to reach ${target / 100}%`;
  const skip = canSkip(attended, held, target);
  return skip.kind === "finite"
    ? `You can skip ${skip.units} more${unit}`
    : "No minimum target";
}
export function subjectModels(
  data: LogData,
  totals: { subjectId: string; attended: number; held: number }[],
  upcoming: Map<string, NextClass>,
  includeArchived = false,
) {
  const byId = new Map(totals.map((t) => [t.subjectId, t]));
  return data.subjects
    .filter((s) => includeArchived || s.archivedAt === null)
    .map((subject) => {
      const total = byId.get(subject.id) ?? { attended: 0, held: 0 };
      const target = subject.targetBps ?? data.semester.targetBps;
      const weighted =
        data.slots.some(
          (s) => s.subjectId === subject.id && s.countsAs !== 1,
        ) ||
        data.extras.some((s) => s.subjectId === subject.id && s.countsAs !== 1);
      return {
        subject,
        ...total,
        target,
        weighted,
        missed: total.held - total.attended,
        progress: total.held ? total.attended / total.held : null,
        percent: percentage(total.attended, total.held),
        status: attendanceStatus(total.attended, total.held, target),
        message: recommendation(total.attended, total.held, target, weighted),
        next: upcoming.get(subject.id),
      };
    });
}
export type SubjectModel = ReturnType<typeof subjectModels>[number];
export function sortSubjects(rows: SubjectModel[], sort: SubjectSort) {
  return [...rows].sort((a, b) => {
    let order = 0;
    if (sort === "percentage")
      order = (a.percent ?? Infinity) - (b.percent ?? Infinity);
    if (sort === "nextClass")
      order =
        a.next && b.next
          ? a.next.date.localeCompare(b.next.date) ||
            a.next.startMinute - b.next.startMinute
          : a.next
            ? -1
            : b.next
              ? 1
              : 0;
    return (
      order ||
      a.subject.name.localeCompare(b.subject.name) ||
      a.subject.id.localeCompare(b.subject.id)
    );
  });
}
export function overallSummary(
  totals: { attended: number; held: number }[],
  models: SubjectModel[],
) {
  return {
    ...aggregate(totals),
    safe: models.filter(
      (m) => meetsTarget(m.attended, m.held, m.target) === true,
    ).length,
    count: models.length,
  };
}
export function countdown(
  rows: (typeof deadlines.$inferSelect)[],
  subjectId: string,
  now: Date,
  timezone: string,
) {
  const nearest = rows
    .filter(
      (d) =>
        d.subjectId === subjectId &&
        d.completedAt === null &&
        d.dueAt >= now.getTime() &&
        d.dueAt <= now.getTime() + 7 * 86400000,
    )
    .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id))[0];
  if (!nearest) return null;
  const localDate = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    return ["year", "month", "day"]
      .map((key) => parts.find((p) => p.type === key)!.value)
      .join("-");
  };
  const days = calendarDaysBetween(
    localDate(now),
    localDate(new Date(nearest.dueAt)),
  );
  return {
    deadline: nearest,
    label: `${["exam", "quiz", "mid-sem", "end-sem"].includes(nearest.category) ? "Exam" : "Deadline"} ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}`,
  };
}
