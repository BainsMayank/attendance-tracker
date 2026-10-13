import { canSkip, classesNeeded, dayNumber, weekIndex } from "@/lib/attendance";
import type { SubjectModel } from "@/lib/subjects";
import { formatTime } from "@/lib/timetable";
import { statusTone, type Tone } from "@/ui";

type Totals = Pick<SubjectModel, "attended" | "held" | "target" | "status" | "weighted">;

/** Short and long copy for a subject's position against its target. */
export function subjectStatus(model: Totals) {
  const tone: Tone = statusTone(model.status);
  const unit = (n: number, long = false) =>
    model.weighted
      ? `${n} attendance ${n === 1 ? "unit" : "units"}`
      : long
        ? `${n} more ${n === 1 ? "class" : "classes"}`
        : String(n);
  const target = model.target / 100;
  if (model.target === 0)
    return {
      tone: "ok" as Tone,
      label: "No minimum target",
      sentence: "This subject has no minimum attendance target.",
      need: "—",
      needLabel: "Can skip",
    };
  if (!model.held)
    return {
      tone: "neutral" as Tone,
      label: "No classes counted yet",
      sentence: "Mark your first class to start tracking this subject.",
      need: "—",
      needLabel: "To attend",
    };
  if (model.status === "below") {
    const needed = classesNeeded(model.attended, model.held, model.target);
    if (needed.kind !== "finite")
      return {
        tone,
        label: `${target}% is out of reach`,
        sentence: `Exactly ${target}% can no longer be reached with this history.`,
        need: "—",
        needLabel: "To attend",
      };
    return {
      tone,
      label: `Attend next ${needed.units} to reach ${target}%`,
      sentence: `Attend the next ${model.weighted ? unit(needed.units) : `${needed.units} ${needed.units === 1 ? "class" : "classes"}`} in a row to get back to ${target}%.`,
      need: String(needed.units),
      needLabel: "To attend",
    };
  }
  const skip = canSkip(model.attended, model.held, model.target);
  const units = skip.kind === "finite" ? skip.units : 0;
  const zone = model.status === "warning" ? "On the line" : "Safe";
  return {
    tone,
    label: units ? `${zone} · can skip ${units}` : `${zone} · don’t skip`,
    sentence: units
      ? `You can skip ${unit(units, true)} and stay at ${target}% or above.`
      : `You’re right at ${target}%. Skipping the next class drops you below it.`,
    need: String(units),
    needLabel: "Can skip",
  };
}

/** "Today 09:00", "Tomorrow 10:30", "Tue 14:00", "Tue 20 Oct 14:00". */
export function relativeClassTime(date: string, minute: number, today: string) {
  const diff = dayNumber(date) - dayNumber(today);
  const day =
    diff === 0
      ? "Today"
      : diff === 1
        ? "Tomorrow"
        : new Intl.DateTimeFormat(undefined, {
            weekday: "short",
            ...(diff > 6 ? { day: "numeric", month: "short" } : {}),
            timeZone: "UTC",
          }).format(new Date(`${date}T12:00:00Z`));
  return `${day} ${formatTime(minute)}`;
}

/** "Fall 2026 · Week 12", or the semester's state when outside its dates. */
export function semesterCaption(
  semester: { name: string; startsOn: string; endsOn: string; weekAnchor: string; archivedAt: number | null },
  today: string,
) {
  if (semester.archivedAt !== null) return `${semester.name} · Archived`;
  if (today < semester.startsOn) return `${semester.name} · Starts ${shortDate(semester.startsOn)}`;
  if (today > semester.endsOn) return `${semester.name} · Ended`;
  return `${semester.name} · Week ${weekIndex(semester.weekAnchor, today)}`;
}
export function shortDate(date: string, withWeekday = false) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    ...(withWeekday ? { weekday: "short" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
/** One decimal, without the percent sign; "—" for no counted classes. */
export function percentNumber(attended: number, held: number) {
  if (!held) return "—";
  const p = (attended / held) * 100;
  return attended < held && p >= 99.95 ? "99.9" : p.toFixed(1);
}
