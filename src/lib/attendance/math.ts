export type Totals = { attended: number; held: number };
export type Recommendation =
  | {
      kind: "finite";
      units: number;
      reason?: "belowTarget" | "noHistory" | "firstClass";
    }
  | { kind: "unbounded" | "unreachableExactly" };

export function integer(value: number, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new RangeError("Expected a safe integer");
  return value;
}
export function totals(attended: number, held: number): Totals {
  integer(attended);
  integer(held);
  if (attended > held) throw new RangeError("Attended cannot exceed held");
  return { attended, held };
}
export function target(value: number): number {
  integer(value);
  if (value > 10000)
    throw new RangeError("Target must be 0–10000 basis points");
  return value;
}
function safe(value: bigint): number {
  const result = Number(value);
  return integer(result);
}
export function resolveTarget(
  override: number | null,
  semester: number,
): number {
  return target(override ?? semester);
}
export function percentage(a: number, h: number): number | null {
  totals(a, h);
  return h === 0 ? null : (a / h) * 100;
}
export function formatPercentage(a: number, h: number): string {
  const p = percentage(a, h);
  if (p === null) return "—";
  if (a < h && p >= 99.95) return "<100%";
  if (a > 0 && p < 0.05) return "<0.1%";
  return `${p.toFixed(1)}%`;
}
export function meetsTarget(a: number, h: number, b: number): boolean | null {
  totals(a, h);
  target(b);
  return h === 0 ? null : BigInt(a) * 10000n >= BigInt(b) * BigInt(h);
}
export function classesNeeded(a: number, h: number, b: number): Recommendation {
  totals(a, h);
  target(b);
  if (b === 0) return { kind: "finite", units: 0 };
  if (h === 0) return { kind: "finite", units: 1, reason: "firstClass" };
  if (meetsTarget(a, h, b)) return { kind: "finite", units: 0 };
  if (b === 10000) return { kind: "unreachableExactly" };
  const numerator = BigInt(b) * BigInt(h) - 10000n * BigInt(a);
  const denominator = BigInt(10000 - b);
  return {
    kind: "finite",
    units: safe((numerator + denominator - 1n) / denominator),
  };
}
export function canSkip(a: number, h: number, b: number): Recommendation {
  totals(a, h);
  target(b);
  if (b === 0) return { kind: "unbounded" };
  if (h === 0) return { kind: "finite", units: 0, reason: "noHistory" };
  const numerator = 10000n * BigInt(a) - BigInt(b) * BigInt(h);
  if (numerator < 0n)
    return { kind: "finite", units: 0, reason: "belowTarget" };
  return { kind: "finite", units: safe(numerator / BigInt(b)) };
}
export function aggregate(rows: Totals[]): Totals {
  let a = 0n,
    h = 0n;
  for (const row of rows) {
    totals(row.attended, row.held);
    a += BigInt(row.attended);
    h += BigInt(row.held);
  }
  return totals(safe(a), safe(h));
}
export function missed(a: number, h: number): number {
  totals(a, h);
  return h - a;
}
export function occurrenceDelta(
  status: "present" | "absent" | "neutral",
  weight: number,
): Totals {
  integer(weight, 1);
  if (!["present", "absent", "neutral"].includes(status))
    throw new RangeError("Invalid status");
  return {
    attended: status === "present" ? weight : 0,
    held: status === "neutral" ? 0 : weight,
  };
}
export type LedgerRow = {
  id: string;
  onDate: string;
  createdAt: number;
  attendedDelta: number;
  heldDelta: number;
};
export function ledgerTotals(
  rows: LedgerRow[],
  through = "9999-12-31",
): Totals {
  let a = 0,
    h = 0;
  const ordered = [...rows]
    .filter((r) => r.onDate <= through)
    .sort(
      (x, y) =>
        x.onDate.localeCompare(y.onDate) ||
        x.createdAt - y.createdAt ||
        x.id.localeCompare(y.id),
    );
  for (const r of ordered) {
    integer(r.attendedDelta, -Number.MAX_SAFE_INTEGER);
    integer(r.heldDelta, -Number.MAX_SAFE_INTEGER);
    a += r.attendedDelta;
    h += r.heldDelta;
    try {
      totals(a, h);
    } catch {
      throw new RangeError(`Invalid ledger prefix at ${r.onDate} (${r.id})`);
    }
  }
  return totals(a, h);
}
export function sessionsNeeded(
  needed: Recommendation,
  weights: number[],
): { sessions: number; units: number } | null {
  weights.forEach((w) => integer(w, 1));
  if (needed.kind !== "finite") return null;
  integer(needed.units);
  let units = 0,
    sessions = 0;
  while (units < needed.units && sessions < weights.length)
    units = integer(units + weights[sessions++]);
  return units >= needed.units ? { sessions, units } : null;
}
export function canSkipOccurrence(
  budget: Recommendation,
  weight: number,
): boolean {
  integer(weight, 1);
  return (
    budget.kind === "unbounded" ||
    (budget.kind === "finite" && integer(budget.units) >= weight)
  );
}
export function forecast(
  a: number,
  h: number,
  present: number,
  absent = 0,
): number | null {
  totals(a, h);
  integer(present);
  integer(absent);
  return percentage(integer(a + present), integer(h + present + absent));
}
export function reachable(
  a: number,
  h: number,
  b: number,
  remaining: number,
): boolean {
  totals(a, h);
  target(b);
  integer(remaining);
  return (
    meetsTarget(integer(a + remaining), integer(h + remaining), b) === true
  );
}
export function cappedSkip(budget: Recommendation, weights: number[]): number {
  weights.forEach((w) => integer(w, 1));
  const capacity = weights.reduce((sum, w) => integer(sum + w), 0);
  return budget.kind === "unbounded"
    ? capacity
    : budget.kind === "finite"
      ? Math.min(integer(budget.units), capacity)
      : 0;
}
