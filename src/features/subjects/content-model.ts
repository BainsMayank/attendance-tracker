import { addDays, dayNumber, mondayAnchor } from "@/lib/attendance";

export const deadlineTypes = [
  { value: "assignment", label: "Assignment" },
  { value: "quiz", label: "Quiz" },
  { value: "mid-sem", label: "Mid-sem" },
  { value: "end-sem", label: "End-sem" },
  { value: "other", label: "Other" },
] as const;
export function deadlineType(value: string) {
  return deadlineTypes.find((t) => t.value === value)?.label ?? "Exam";
}
export function deadlineLabel(
  dueAt: number,
  completedAt: number | null,
  now: number,
) {
  if (completedAt !== null) return "Done";
  const seconds = Math.ceil(Math.abs(dueAt - now) / 1000);
  if (!seconds) return "Due now";
  const duration =
    seconds < 60
      ? "<1m"
      : seconds < 3600
        ? `${Math.ceil(seconds / 60)}m`
        : seconds < 86400
          ? `${Math.ceil(seconds / 3600)}h`
          : `${Math.ceil(seconds / 86400)}d`;
  return dueAt < now ? `Overdue · ${duration}` : `Due in ${duration}`;
}
export function localParts(instant: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minute: Number(part("hour")) * 60 + Number(part("minute")),
  };
}
/** Resolve local academic time without relying on the device timezone. */
export function zonedInstant(date: string, minute: number, timezone: string) {
  dayNumber(date);
  if (!Number.isInteger(minute) || minute < 0 || minute >= 1440)
    throw new Error("Choose a valid time.");
  const desired = Date.parse(`${date}T00:00:00Z`) + minute * 60000;
  let candidate = desired;
  for (let i = 0; i < 4; i++) {
    const local = localParts(candidate, timezone);
    const represented =
      Date.parse(`${local.date}T00:00:00Z`) + local.minute * 60000;
    candidate += desired - represented;
  }
  const matches = [-180, -120, -60, -30, 0, 30, 60, 120, 180]
    .map((offset) => candidate + offset * 60000)
    .filter((value) => {
      const local = localParts(value, timezone);
      return local.date === date && local.minute === minute;
    });
  if (!matches.length)
    throw new Error(
      "This local time does not exist because the clocks change. Choose another time.",
    );
  return Math.min(...matches);
}
export function completion(rows: { completedAt: number | null }[]) {
  const done = rows.filter((r) => r.completedAt !== null).length;
  return {
    done,
    total: rows.length,
    percent: rows.length ? (done / rows.length) * 100 : null,
  };
}
export function validatedURL(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a full http:// or https:// URL.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error("Use an HTTP or HTTPS link without embedded credentials.");
  return url.href;
}
export function linkKind(input: string): "youtube" | "drive" | "pdf" | "web" {
  try {
    const url = new URL(validatedURL(input));
    const host = url.hostname.toLowerCase();
    if (
      host === "youtu.be" ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com")
    )
      return "youtube";
    if (["drive.google.com", "docs.google.com"].includes(host)) return "drive";
    if (/\.pdf$/i.test(decodeURIComponent(url.pathname))) return "pdf";
    return "web";
  } catch {
    return "web";
  }
}
export type NoteLine = {
  text: string;
  type: "text" | "bullet" | "check";
  checked: boolean;
  index: number;
};
export function noteLines(body: string): NoteLine[] {
  return body.split("\n").map((line, index) => {
    const check = /^\s*- \[([ xX])\] (.*)$/.exec(line);
    if (check)
      return {
        text: check[2],
        type: "check",
        checked: check[1] !== " ",
        index,
      };
    const bullet = /^\s*[-*] (.*)$/.exec(line);
    return {
      text: bullet?.[1] ?? line,
      type: bullet ? "bullet" : "text",
      checked: false,
      index,
    };
  });
}
export function toggleChecklist(body: string, index: number) {
  return body
    .split("\n")
    .map((line, i) =>
      i === index
        ? line.replace(
            /^(\s*- \[)([ xX])(\] )/,
            (_, before, checked, after) =>
              `${before}${checked === " " ? "x" : " "}${after}`,
          )
        : line,
    )
    .join("\n");
}
export function formatSelection(
  body: string,
  selection: { start: number; end: number },
  format: "bold" | "bullet" | "check",
) {
  const start = Math.min(selection.start, body.length),
    end = Math.min(selection.end, body.length);
  if (format === "bold") {
    const selected = body.slice(start, end) || "bold text";
    return {
      body: `${body.slice(0, start)}**${selected}**${body.slice(end)}`,
      selection: { start: start + 2, end: start + 2 + selected.length },
    };
  }
  const lineStart = body.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const foundEnd = body.indexOf("\n", end),
    lineEnd = foundEnd === -1 ? body.length : foundEnd;
  const prefix = format === "bullet" ? "- " : "- [ ] ";
  const block = body
    .slice(lineStart, lineEnd)
    .split("\n")
    .map((line) => prefix + line.replace(/^\s*[-*] (?:\[[ xX]\] )?/, ""))
    .join("\n");
  return {
    body: body.slice(0, lineStart) + block + body.slice(lineEnd),
    selection: { start: lineStart, end: lineStart + block.length },
  };
}
export function plainNote(body: string) {
  return noteLines(body)
    .map((l) => l.text.replace(/\*\*/g, ""))
    .join(" ");
}

export type TimerRow = {
  state: "running" | "paused" | "completed" | "discarded";
  phase: "focus" | "break";
  plannedFocusSeconds: number;
  plannedBreakSeconds: number;
  activeSeconds: number;
  phaseStartedAt: number | null;
  checkpointAt: number;
};
/** activeSeconds contains checkpointed focus only; phaseStartedAt is retained across pauses. */
export function timerSnapshot(row: TimerRow, now: number) {
  const duration =
    row.phase === "focus" ? row.plannedFocusSeconds : row.plannedBreakSeconds;
  const clockAnomaly = now < row.checkpointAt;
  const elapsed =
    row.state === "running" && !clockAnomaly
      ? Math.floor((now - row.checkpointAt) / 1000)
      : 0;
  const prior =
    row.phaseStartedAt === null
      ? 0
      : Math.max(0, Math.floor((row.checkpointAt - row.phaseStartedAt) / 1000));
  const phaseElapsed = Math.min(duration, prior + elapsed);
  const credited =
    row.phase === "focus" ? Math.max(0, phaseElapsed - prior) : 0;
  return {
    remaining: Math.max(0, duration - phaseElapsed),
    activeSeconds: row.activeSeconds + credited,
    phaseElapsed,
    clockAnomaly,
  };
}
export function weeklyStudyMinutes(
  rows: { state: string; startedAt: number; activeSeconds: number }[],
  now: number,
  timezone: string,
) {
  const start = mondayAnchor(localParts(now, timezone).date),
    end = addDays(start, 7);
  return (
    rows.reduce((total, row) => {
      const date = localParts(row.startedAt, timezone).date;
      return (
        total +
        (row.state === "completed" && date >= start && date < end
          ? row.activeSeconds
          : 0)
      );
    }, 0) / 60
  );
}
