import {
  percentToBps,
  selectVersion,
  slotsOverlap,
  validateSlots,
} from "../timetable";
const ranges = [
  {
    id: "old",
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
    supersededAt: 1,
  },
  { id: "one", effectiveFrom: "2026-01-01", effectiveUntil: "2026-03-01" },
  { id: "two", effectiveFrom: "2026-03-01", effectiveUntil: "2026-07-01" },
];
test.each([
  ["2025-12-31", undefined],
  ["2026-01-01", "one"],
  ["2026-02-28", "one"],
  ["2026-03-01", "two"],
  ["2026-06-30", "two"],
  ["2026-07-01", undefined],
])(
  "version selection on %s has inclusive start and exclusive end",
  (date, id) => {
    expect(selectVersion(ranges, date)?.id).toBe(id);
  },
);
test("open-ended ranges work and overlapping active versions reject", () => {
  expect(
    selectVersion(
      [{ id: "v", effectiveFrom: "2026-01-01", effectiveUntil: null }],
      "2026-12-01",
    )?.id,
  ).toBe("v");
  expect(() =>
    selectVersion(
      [
        ...ranges,
        { id: "bad", effectiveFrom: "2026-02-01", effectiveUntil: null },
      ],
      "2026-03-01",
    ),
  ).toThrow("Overlapping");
});
const slot = {
  weekday: 1,
  parity: "all" as const,
  startMinute: 540,
  endMinute: 600,
};
test.each([
  ["all", "all", true],
  ["all", "odd", true],
  ["odd", "all", true],
  ["all", "even", true],
  ["even", "all", true],
  ["odd", "odd", true],
  ["even", "even", true],
  ["odd", "even", false],
  ["even", "odd", false],
] as const)("overlap pattern %s/%s", (a, b, expected) => {
  expect(slotsOverlap({ ...slot, parity: a }, { ...slot, parity: b })).toBe(
    expected,
  );
});
test("overlap accepts adjacent slots and different days; rejects contained intervals", () => {
  expect(
    slotsOverlap(slot, { ...slot, startMinute: 600, endMinute: 660 }),
  ).toBe(false);
  expect(
    slotsOverlap(slot, { ...slot, endMinute: 540, startMinute: 480 }),
  ).toBe(false);
  expect(slotsOverlap(slot, { ...slot, weekday: 2 })).toBe(false);
  expect(
    slotsOverlap(slot, { ...slot, startMinute: 550, endMinute: 560 }),
  ).toBe(true);
  expect(() =>
    validateSlots([slot, { ...slot, startMinute: 590, endMinute: 660 }]),
  ).toThrow("Monday");
  expect(() =>
    validateSlots([slot, { ...slot, startMinute: 600, endMinute: 1440 }]),
  ).not.toThrow();
});
test.each([
  { startMinute: -1 },
  { endMinute: 540 },
  { endMinute: 1441 },
  { startMinute: 540.5 },
  { weekday: 0 },
  { weekday: 8 },
  { parity: "bad" },
])("invalid slot %j rejects", (patch) => {
  expect(() => validateSlots([{ ...slot, ...patch } as typeof slot])).toThrow();
});
test("target override allows blank and exact 0/100 endpoints", () => {
  expect(percentToBps(" ")).toBeNull();
  expect(percentToBps("0")).toBe(0);
  expect(percentToBps("100")).toBe(10000);
  expect(percentToBps("75.25")).toBe(7525);
  for (const value of ["101", "-1", "no", "75.255"])
    expect(() => percentToBps(value)).toThrow();
});
