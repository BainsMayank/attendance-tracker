import {
  shouldOnboard,
  targetBasisPoints,
  validateSemesterDraft,
  type OnboardingDraft,
} from "../model";
const draft: OnboardingDraft = {
  step: "semester",
  name: "Semester 3",
  startsOn: "2026-01-05",
  endsOn: "2026-05-20",
  timezone: "Asia/Kolkata",
  target: "75",
  semesterId: null,
};
test("first launch gate excludes completed, skipped and existing installs", () => {
  expect(shouldOnboard(undefined, false, false)).toBe(true);
  expect(shouldOnboard(undefined, true, true)).toBe(true);
  expect(shouldOnboard(undefined, true, false)).toBe(false);
  expect(shouldOnboard(1, false, false)).toBe(false);
  expect(shouldOnboard(1, true, true)).toBe(false);
});
test("validates real dates, timezone and range", () => {
  expect(() => validateSemesterDraft(draft)).not.toThrow();
  expect(() =>
    validateSemesterDraft({ ...draft, startsOn: "2026-02-30" }),
  ).toThrow("valid semester");
  expect(() =>
    validateSemesterDraft({ ...draft, endsOn: "2025-01-01" }),
  ).toThrow("on or after");
  expect(() =>
    validateSemesterDraft({ ...draft, timezone: "Moon/Base" }),
  ).toThrow("timezone");
  expect(() => validateSemesterDraft({ ...draft, name: " " })).toThrow("name");
});
test("target accepts endpoints and hundredths without clamping", () => {
  expect(targetBasisPoints("0")).toBe(0);
  expect(targetBasisPoints("100")).toBe(10000);
  expect(targetBasisPoints("75.25")).toBe(7525);
  for (const value of ["", "-1", "100.01", "75.123", "NaN", "75%", "1e2"])
    expect(() => targetBasisPoints(value)).toThrow("Target");
});
