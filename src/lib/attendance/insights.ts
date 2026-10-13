import { addDays, dayNumber, expandDay, type Schedule } from "./calendar";
import {
  forecast,
  integer,
  ledgerTotals,
  percentage,
  totals,
  type LedgerRow,
} from "./math";

export type UpcomingClass = {
  key: string;
  subjectId: string;
  date: string;
  startMinute: number;
  countsAs: number;
};
export type TimedSchedule = Omit<Schedule, "slots" | "extras"> & {
  slots: (Schedule["slots"][number] & { startMinute: number })[];
  extras: (Schedule["extras"][number] & { startMinute: number })[];
};

/** Explicit semester-local clock; each class is one session, independently of weight. */
export function upcomingClasses(
  schedule: TimedSchedule,
  today: string,
  minute: number,
  subjectId?: string,
): UpcomingClass[] {
  dayNumber(today);
  integer(minute);
  if (minute > 1440) throw new RangeError("Invalid minute");
  const sources = new Map<string, { startMinute: number }>([
    ...schedule.slots.map((s) => [`slot:${s.id}`, s] as const),
    ...schedule.extras.map((e) => [`extra:${e.id}`, e] as const),
  ]);
  const result: UpcomingClass[] = [];
  for (
    let date = today < schedule.startsOn ? schedule.startsOn : today;
    date <= schedule.endsOn;
    date = addDays(date, 1)
  ) {
    for (const row of expandDay(schedule, date).occurrences) {
      const source = sources.get(
        row.key.startsWith("slot:") ? row.key.slice(0, -11) : row.key,
      )!;
      if (
        (subjectId !== undefined && row.subjectId !== subjectId) ||
        (date === today && source.startMinute <= minute)
      )
        continue;
      result.push({ ...row, date, startMinute: source.startMinute });
    }
  }
  return result.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startMinute - b.startMinute ||
      a.key.localeCompare(b.key),
  );
}

/** Independent all-absent or all-present scenario over the first N actual sessions. */
export function planClasses(
  attended: number,
  held: number,
  upcoming: UpcomingClass[],
  count: number,
  mode: "attend" | "skip",
) {
  totals(attended, held);
  integer(count);
  if (mode !== "attend" && mode !== "skip")
    throw new RangeError("Invalid planner mode");
  const chosen = upcoming.slice(0, count);
  const units = chosen.reduce(
    (sum, row) => integer(sum + integer(row.countsAs, 1)),
    0,
  );
  const complete = chosen.length === count;
  return {
    complete,
    sessions: chosen.length,
    units,
    nth: count > 0 && complete ? chosen[count - 1] : null,
    attended: integer(attended + (mode === "attend" ? units : 0)),
    held: integer(held + units),
    percentage: forecast(
      attended,
      held,
      mode === "attend" ? units : 0,
      mode === "skip" ? units : 0,
    ),
  };
}

/** One cumulative point per ledger date. Corrections use the same prefix ordering as totals. */
export function attendanceTrend(rows: LedgerRow[], through: string) {
  dayNumber(through);
  const ordered = [...rows]
    .filter((r) => r.onDate <= through)
    .sort(
      (a, b) =>
        a.onDate.localeCompare(b.onDate) ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
  ledgerTotals(ordered);
  const points: {
    date: string;
    attended: number;
    held: number;
    percentage: number | null;
  }[] = [];
  let attended = 0,
    held = 0;
  for (const row of ordered) {
    attended += row.attendedDelta;
    held += row.heldDelta;
    const point = {
      date: row.onDate,
      attended,
      held,
      percentage: percentage(attended, held),
    };
    if (points[points.length - 1]?.date === row.onDate)
      points[points.length - 1] = point;
    else points.push(point);
  }
  return points;
}
