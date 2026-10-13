import { integer, occurrenceDelta, percentage, aggregate } from "./math";
import type { Occurrence } from "./calendar";

export function daySummary(input: {
  outside: boolean;
  configured: boolean;
  holiday: boolean;
  occurrences: Occurrence[];
}) {
  const pending = input.occurrences.filter((o) => !o.status).length;
  const values = input.occurrences
    .filter((o) => o.status)
    .map((o) => occurrenceDelta(o.status!, o.countsAs));
  const { attended, held } = aggregate(values);
  const status = input.outside
    ? "outsideSemester"
    : !input.configured
      ? "unconfigured"
      : pending
        ? "pending"
        : attended > 0 && attended < held
          ? "mixed"
          : attended > 0
            ? "present"
            : held > 0
              ? "absent"
              : input.occurrences.some((o) => o.status === "neutral")
                ? "neutral"
                : input.holiday
                  ? "holiday"
                  : "noClasses";
  return {
    status,
    pending,
    logged: input.occurrences.length - pending,
    expected: input.occurrences.length,
    percentage: percentage(attended, held),
  };
}
export function syllabusCompletion(
  completed: number,
  total: number,
): number | null {
  return percentage(completed, total);
}
export type Mark = {
  earned: number | null;
  maximum: number;
  weightBps: number | null;
};
export function marksPercentage(rows: Mark[], mode: "weighted" | "unweighted") {
  for (const r of rows) {
    if (
      !Number.isFinite(r.maximum) ||
      r.maximum <= 0 ||
      (r.earned !== null &&
        (!Number.isFinite(r.earned) || r.earned < 0 || r.earned > r.maximum))
    )
      throw new RangeError("Invalid marks");
    if (r.weightBps !== null && integer(r.weightBps) > 10000)
      throw new RangeError("Invalid assessment weight");
    if (mode === "weighted" && r.weightBps === null)
      throw new RangeError("Weighted mode requires every weight");
  }
  if (rows.reduce((s, r) => s + (r.weightBps ?? 0), 0) > 10000)
    throw new RangeError("Assessment weights exceed 100%");
  const graded = rows.filter((r) => r.earned !== null);
  const denominator = graded.reduce(
    (sum, r) => sum + (mode === "weighted" ? r.weightBps! : r.maximum),
    0,
  );
  const numerator = graded.reduce(
    (sum, r) =>
      sum +
      (mode === "weighted"
        ? (r.earned! / r.maximum) * r.weightBps!
        : r.earned!),
    0,
  );
  return {
    percentage: denominator ? (numerator / denominator) * 100 : null,
    graded: graded.length,
    total: rows.length,
    gradedWeightBps: graded.reduce((s, r) => s + (r.weightBps ?? 0), 0),
  };
}
export function overdue(
  dueAt: number,
  completedAt: number | null,
  now: number,
): boolean {
  if (
    ![dueAt, now, ...(completedAt === null ? [] : [completedAt])].every(
      Number.isFinite,
    )
  )
    throw new RangeError("Invalid instant");
  return completedAt === null && dueAt < now;
}
export function studyMinutes(
  sessions: { state: string; activeSeconds: number }[],
): number {
  return (
    sessions.reduce(
      (sum, s) =>
        sum + (s.state === "completed" ? integer(s.activeSeconds) : 0),
      0,
    ) / 60
  );
}
export function storageBytes(
  files: { state: string; sizeBytes: number }[],
): number {
  return files.reduce(
    (sum, f) => integer(sum + (f.state === "ready" ? integer(f.sizeBytes) : 0)),
    0,
  );
}
export function attendanceStatus(
  a: number,
  h: number,
  b: number,
): "noData" | "below" | "warning" | "safe" {
  // The spec's amber band is above the target; below-target always remains red.
  const p = percentage(a, h);
  integer(b);
  if (b > 10000) throw new RangeError("Invalid target");
  return p === null
    ? "noData"
    : BigInt(a) * 10000n < BigInt(b) * BigInt(h)
      ? "below"
      : BigInt(a) * 10000n <= BigInt(b + 300) * BigInt(h)
        ? "warning"
        : "safe";
}
