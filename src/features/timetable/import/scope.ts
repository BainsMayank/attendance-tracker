import { localToday } from "@/db/validation";
export function importEffectiveFrom(
  semester: { startsOn: string; endsOn: string; timezone: string },
  scope: "today" | "semester",
) {
  const today = localToday(semester.timezone);
  const from =
    scope === "semester"
      ? semester.startsOn
      : today < semester.startsOn
        ? semester.startsOn
        : today;
  if (from > semester.endsOn)
    throw new Error(
      "This semester has ended. Choose Whole semester to correct its timetable.",
    );
  return from;
}
