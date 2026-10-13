import { z } from "zod";
import { dayNumber } from "@/lib/attendance";

export const onboardingDraftSchema = z.strictObject({
  step: z.enum(["welcome", "semester", "target", "choice", "done"]),
  name: z.string().max(120),
  startsOn: z.string(),
  endsOn: z.string(),
  timezone: z.string().max(100),
  target: z.string().max(10),
  semesterId: z.uuid().nullable(),
});
export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;
export const importPasteSchema = z.strictObject({
  semesterId: z.uuid().nullable(),
  raw: z.string().max(512000),
});
export function validateSemesterDraft(draft: OnboardingDraft) {
  if (!draft.name.trim()) throw new Error("Enter a semester name.");
  if (draft.name.trim().length > 120)
    throw new Error("Semester name must be 120 characters or fewer.");
  try {
    dayNumber(draft.startsOn);
    dayNumber(draft.endsOn);
  } catch {
    throw new Error("Choose valid semester start and end dates.");
  }
  if (draft.endsOn < draft.startsOn)
    throw new Error("Semester end must be on or after its start.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: draft.timezone });
  } catch {
    throw new Error("Enter a valid timezone, such as Asia/Kolkata.");
  }
}
export function targetBasisPoints(value: string) {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(value.trim()) || Number(value) > 100)
    throw new Error("Target must be 0–100%, with up to two decimal places.");
  return Math.round(Number(value) * 100);
}
export function shouldOnboard(
  version: unknown,
  hasSemester: boolean,
  hasDraft: boolean,
) {
  return (
    !(typeof version === "number" && version >= 1) && (!hasSemester || hasDraft)
  );
}
