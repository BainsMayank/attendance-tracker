import * as a from "..";

describe("exact attendance arithmetic", () => {
  test.each([
    [0, 0, 7500, 1],
    [6, 8, 7500, 0],
    [7, 8, 7500, 0],
    [5, 8, 7500, 4],
    [0, 0, 0, 0],
    [0, 0, 10000, 1],
    [8, 8, 10000, 0],
    [0, 8, 0, 0],
    [1, 3, 3334, 1],
  ])("needed(%i/%i, %i) = %i", (attended, held, bps, needed) => {
    expect(a.classesNeeded(attended, held, bps)).toMatchObject({
      kind: "finite",
      units: needed,
    });
  });
  test("100% after an absence is unreachable exactly", () =>
    expect(a.classesNeeded(8, 10, 10000)).toEqual({
      kind: "unreachableExactly",
    }));
  test.each([
    [6, 8, 7500, 0],
    [7, 8, 7500, 1],
    [5, 8, 7500, 0],
    [0, 0, 7500, 0],
    [8, 8, 10000, 0],
  ])("skip(%i/%i, %i) = %i", (attended, held, bps, skip) =>
    expect(a.canSkip(attended, held, bps)).toMatchObject({
      kind: "finite",
      units: skip,
    }),
  );
  test("zero target is unbounded even with no history", () =>
    expect(a.canSkip(0, 0, 0)).toEqual({ kind: "unbounded" }));
  test("no history and below-target reasons are explicit", () => {
    expect(a.canSkip(0, 0, 7500)).toHaveProperty("reason", "noHistory");
    expect(a.canSkip(5, 8, 7500)).toHaveProperty("reason", "belowTarget");
  });
  test("undefined denominator differs from 0%", () => {
    expect(a.percentage(0, 0)).toBeNull();
    expect(a.percentage(0, 5)).toBe(0);
    expect(a.meetsTarget(0, 0, 0)).toBeNull();
    expect(a.meetsTarget(0, 5, 0)).toBe(true);
  });
  test("display never claims rounded 100 or rounded zero", () => {
    expect(a.formatPercentage(99999, 100000)).toBe("<100%");
    expect(a.formatPercentage(1, 100000)).toBe("<0.1%");
    expect(a.formatPercentage(0, 0)).toBe("—");
    expect(a.formatPercentage(6, 8)).toBe("75.0%");
    expect(a.formatPercentage(1, 1)).toBe("100.0%");
  });
  test("eligibility uses exact basis points", () => {
    expect(a.meetsTarget(74999, 100000, 7500)).toBe(false);
    expect(a.meetsTarget(75000, 100000, 7500)).toBe(true);
    expect(
      a.meetsTarget(
        Number.MAX_SAFE_INTEGER - 1,
        Number.MAX_SAFE_INTEGER,
        10000,
      ),
    ).toBe(false);
  });
  test("subject overrides include zero", () => {
    expect(a.resolveTarget(null, 7500)).toBe(7500);
    expect(a.resolveTarget(0, 7500)).toBe(0);
  });
  test.each([-1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "invalid unit %s rejects",
    (value) => expect(() => a.totals(value, 10)).toThrow(RangeError),
  );
  test("invalid target and attended > held reject", () => {
    expect(() => a.target(10001)).toThrow();
    expect(() => a.target(-1)).toThrow();
    expect(() => a.totals(2, 1)).toThrow();
    expect(() => a.classesNeeded(1, 1, 10001)).toThrow();
    expect(() => a.canSkip(1, 1, -1)).toThrow();
  });
  test("overflow in integer outputs is rejected", () => {
    expect(() => a.classesNeeded(0, Number.MAX_SAFE_INTEGER, 9999)).toThrow();
    expect(() =>
      a.aggregate([
        { attended: 1, held: Number.MAX_SAFE_INTEGER },
        { attended: 1, held: 1 },
      ]),
    ).toThrow();
    expect(() => a.forecast(1, Number.MAX_SAFE_INTEGER, 1)).toThrow();
  });
  test("weighted aggregate is a ratio, never a mean", () => {
    const sum = a.aggregate([
      { attended: 1, held: 1 },
      { attended: 0, held: 9 },
    ]);
    expect(a.percentage(sum.attended, sum.held)).toBe(10);
    expect(a.missed(sum.attended, sum.held)).toBe(9);
    expect(a.aggregate([])).toEqual({ attended: 0, held: 0 });
  });
  test("present, absent and neutral deltas", () => {
    expect(a.occurrenceDelta("present", 2)).toEqual({ attended: 2, held: 2 });
    expect(a.occurrenceDelta("absent", 1)).toEqual({ attended: 0, held: 1 });
    expect(a.occurrenceDelta("neutral", 2)).toEqual({ attended: 0, held: 0 });
    expect(() => a.occurrenceDelta("invalid" as "present", 1)).toThrow();
    expect(() => a.occurrenceDelta("present", 0)).toThrow();
  });
  const row = (
    id: string,
    onDate: string,
    attendedDelta: number,
    heldDelta: number,
    createdAt = 1,
  ) => ({ id, onDate, attendedDelta, heldDelta, createdAt });
  test("ledger includes opening balance and signed corrections chronologically", () => {
    const rows = [
      row("b", "2026-10-02", 1, 0),
      row("a", "2026-10-01", 8, 10),
      row("c", "2026-10-03", 0, -1),
    ];
    expect(a.ledgerTotals(rows)).toEqual({ attended: 9, held: 9 });
    expect(a.ledgerTotals(rows, "2026-10-01")).toEqual({
      attended: 8,
      held: 10,
    });
    expect(rows[0].id).toBe("b");
  });
  test("ledger ordering uses creation time then id", () => {
    expect(
      a.ledgerTotals([
        row("c", "2026-01-01", 0, -1, 2),
        row("b", "2026-01-01", 0, -1),
        row("a", "2026-01-01", 0, 2),
      ]),
    ).toEqual({ attended: 0, held: 0 });
  });
  test.each([
    [1, 2, 0, -2],
    [0, 0, -1, -1],
    [0, 0, 0, -1],
  ])(
    "invalid ledger prefix rejects (%i,%i,%i,%i)",
    (attended, held, da, dh) => {
      expect(() =>
        a.ledgerTotals([
          row("a", "2026-01-01", attended, held),
          row("b", "2026-01-02", da, dh),
        ]),
      ).toThrow("Invalid ledger prefix");
    },
  );
  test("later opening balance cannot repair an invalid earlier prefix", () =>
    expect(() =>
      a.ledgerTotals([
        row("a", "2026-01-01", -1, -1),
        row("b", "2026-01-02", 8, 10),
      ]),
    ).toThrow());
  test("weighted future sessions and capacity", () => {
    expect(a.sessionsNeeded({ kind: "finite", units: 4 }, [1, 2, 2])).toEqual({
      sessions: 3,
      units: 5,
    });
    expect(a.sessionsNeeded({ kind: "finite", units: 0 }, [])).toEqual({
      sessions: 0,
      units: 0,
    });
    expect(a.sessionsNeeded({ kind: "finite", units: 4 }, [2])).toBeNull();
    expect(a.sessionsNeeded({ kind: "unreachableExactly" }, [2])).toBeNull();
    expect(() => a.sessionsNeeded({ kind: "finite", units: 1 }, [0])).toThrow();
    expect(a.canSkipOccurrence(a.canSkip(7, 8, 7500), 2)).toBe(false);
    expect(a.canSkipOccurrence(a.canSkip(7, 8, 7500), 1)).toBe(true);
    expect(a.canSkipOccurrence({ kind: "unbounded" }, 9)).toBe(true);
    expect(a.canSkipOccurrence({ kind: "unreachableExactly" }, 1)).toBe(false);
    expect(a.cappedSkip({ kind: "unbounded" }, [2, 3])).toBe(5);
    expect(a.cappedSkip({ kind: "finite", units: 7 }, [2, 3])).toBe(5);
    expect(a.cappedSkip({ kind: "finite", units: 1 }, [2, 3])).toBe(1);
    expect(a.cappedSkip({ kind: "unreachableExactly" }, [])).toBe(0);
  });
  test("term-end and selected absence forecasts", () => {
    expect(a.forecast(5, 8, 4)).toBe(75);
    expect(a.forecast(5, 8, 4, 2)).toBeCloseTo(64.2857);
    expect(a.forecast(0, 0, 0)).toBeNull();
    expect(a.reachable(5, 8, 7500, 3)).toBe(false);
    expect(a.reachable(5, 8, 7500, 4)).toBe(true);
    expect(a.reachable(8, 10, 10000, 10000)).toBe(false);
  });
  test("recommendations satisfy minimality across a range of totals and targets", () => {
    for (let h = 1; h <= 20; h++)
      for (let n = 0; n <= h; n++)
        for (const b of [1, 3333, 7500, 9999]) {
          const needed = a.classesNeeded(n, h, b);
          if (needed.kind === "finite") {
            expect(a.meetsTarget(n + needed.units, h + needed.units, b)).toBe(
              true,
            );
            if (needed.units)
              expect(
                a.meetsTarget(n + needed.units - 1, h + needed.units - 1, b),
              ).toBe(false);
          }
          const skip = a.canSkip(n, h, b);
          if (skip.kind === "finite" && a.meetsTarget(n, h, b)) {
            expect(a.meetsTarget(n, h + skip.units, b)).toBe(true);
            expect(a.meetsTarget(n, h + skip.units + 1, b)).toBe(false);
          }
        }
  });
});
