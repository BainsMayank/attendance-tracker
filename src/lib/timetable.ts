export type WeekPattern = "all" | "odd" | "even";
export type VersionRange = {
  id: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  supersededAt?: number | null;
};
export function selectVersion<T extends VersionRange>(
  versions: T[],
  date: string,
): T | undefined {
  const matching = versions.filter(
    (v) =>
      v.supersededAt == null &&
      v.effectiveFrom <= date &&
      (!v.effectiveUntil || date < v.effectiveUntil),
  );
  if (matching.length > 1)
    throw new RangeError("Overlapping timetable versions");
  return matching[0];
}
export type TimeSlot = {
  id?: string;
  weekday: number;
  parity: WeekPattern;
  startMinute: number;
  endMinute: number;
};
export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return (
    a.weekday === b.weekday &&
    (a.parity === "all" || b.parity === "all" || a.parity === b.parity) &&
    a.startMinute < b.endMinute &&
    b.startMinute < a.endMinute
  );
}
export function validateSlots(slots: TimeSlot[]) {
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i];
    if (!Number.isInteger(a.weekday) || a.weekday < 1 || a.weekday > 7)
      throw new Error("Choose a day from Monday to Sunday.");
    if (!["all", "odd", "even"].includes(a.parity))
      throw new Error("Choose every, odd, or even week.");
    if (
      !Number.isInteger(a.startMinute) ||
      !Number.isInteger(a.endMinute) ||
      a.startMinute < 0 ||
      a.endMinute > 1440 ||
      a.startMinute >= a.endMinute
    )
      throw new Error(
        "End time must be after start time, within the same day.",
      );
    for (let j = 0; j < i; j++)
      if (slotsOverlap(a, slots[j]))
        throw new Error(
          `This class overlaps ${formatTime(slots[j].startMinute)}–${formatTime(slots[j].endMinute)} on ${DAY_NAMES[a.weekday - 1]}. Choose another time or week pattern.`,
        );
  }
}
export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export function formatTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
export const subjectColors = [
  "#4144D8",
  "#176640",
  "#956000",
  "#A32956",
  "#007383",
  "#7540B4",
];
export function percentToBps(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value.trim()) || Number(value) > 100)
    throw new Error("Target must be 0–100%, with up to two decimal places.");
  return Math.round(Number(value) * 100);
}
