import { integer } from "./math";
import { selectVersion } from "../timetable";

export function dayNumber(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new RangeError("Expected YYYY-MM-DD");
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date
  )
    throw new RangeError("Invalid calendar date");
  return timestamp / 86400000;
}
export function addDays(date: string, count: number): string {
  integer(count, -Number.MAX_SAFE_INTEGER);
  return new Date((dayNumber(date) + count) * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function calendarDaysBetween(start: string, end: string): number {
  return dayNumber(end) - dayNumber(start);
}
export function weekday(date: string): number {
  return ((((dayNumber(date) + 3) % 7) + 7) % 7) + 1;
}
export function mondayAnchor(date: string): string {
  return addDays(date, 1 - weekday(date));
}
export function weekIndex(anchor: string, date: string): number {
  if (weekday(anchor) !== 1 || date < anchor)
    throw new RangeError("Invalid week anchor/date");
  return Math.floor(calendarDaysBetween(anchor, date) / 7) + 1;
}
export type Version = {
  id: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  supersededAt?: number | null;
};
export type Slot = {
  id: string;
  versionId: string;
  subjectId: string;
  weekday: number;
  parity: "all" | "odd" | "even";
  countsAs: number;
  lineageId?: string | null;
};
export type Extra = {
  id: string;
  subjectId: string;
  onDate: string;
  countsAs: number;
  cancelledAt: number | null;
  allowOnHoliday: boolean;
};
export type Holiday = {
  subjectId: string | null;
  startsOn: string;
  endsOn: string;
};
export type Occurrence = {
  key: string;
  subjectId: string;
  countsAs: number;
  status?: "present" | "absent" | "neutral";
};
export type Schedule = {
  startsOn: string;
  endsOn: string;
  weekAnchor: string;
  versions: Version[];
  slots: Slot[];
  extras: Extra[];
  holidays: Holiday[];
};
export function expandDay(
  schedule: Schedule,
  date: string,
  snapshots: Occurrence[] = [],
) {
  dayNumber(date);
  dayNumber(schedule.startsOn);
  dayNumber(schedule.endsOn);
  if (date < schedule.startsOn || date > schedule.endsOn)
    return {
      configured: false,
      outside: true,
      holiday: false,
      occurrences: [] as Occurrence[],
    };
  const version = selectVersion(schedule.versions, date);
  const holidays = schedule.holidays.filter(
    (h) => h.startsOn <= date && date <= h.endsOn,
  );
  const blocked = (subjectId: string) =>
    holidays.some((h) => h.subjectId === null || h.subjectId === subjectId);
  const odd = weekIndex(schedule.weekAnchor, date) % 2 === 1;
  const occurrences: Occurrence[] = schedule.slots
    .filter(
      (s) =>
        s.versionId === version?.id &&
        s.weekday === weekday(date) &&
        (s.parity === "all" || (s.parity === "odd") === odd) &&
        !blocked(s.subjectId),
    )
    .map((s) => ({
      key: `slot:${s.id}:${date}`,
      subjectId: s.subjectId,
      countsAs: integer(s.countsAs, 1),
    }));
  for (const e of schedule.extras)
    if (
      e.onDate === date &&
      e.cancelledAt === null &&
      (!blocked(e.subjectId) || e.allowOnHoliday)
    )
      occurrences.push({
        key: `extra:${e.id}`,
        subjectId: e.subjectId,
        countsAs: integer(e.countsAs, 1),
      });
  const merged = new Map(occurrences.map((o) => [o.key, o]));
  for (const record of snapshots) {
    // A cloned slot is still the same class. Its frozen mark wins even when a
    // retroactive version changes its time, subject, or recurrence pattern.
    const source = schedule.slots.find(s => record.key.startsWith(`slot:${s.id}:`));
    if (source) {
      const root = source.lineageId ?? source.id;
      for (const slot of schedule.slots)
        if ((slot.lineageId ?? slot.id) === root)
          merged.delete(`slot:${slot.id}:${date}`);
    }
    merged.set(record.key, record);
  }
  return {
    configured: !!version,
    outside: false,
    holiday: holidays.some((h) => h.subjectId === null),
    occurrences: [...merged.values()],
  };
}
export function remainingUnits(
  schedule: Schedule,
  from: string,
  until: string,
): number {
  const days = calendarDaysBetween(from, until);
  if (days < 0) return 0;
  let total = 0;
  for (let i = 0; i <= days; i++)
    total = integer(
      total +
        expandDay(schedule, addDays(from, i)).occurrences.reduce(
          (sum, o) => sum + o.countsAs,
          0,
        ),
    );
  return total;
}
