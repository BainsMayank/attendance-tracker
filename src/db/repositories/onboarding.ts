import { eq } from "drizzle-orm";
import { getDatabase, type Database } from "../client";
import * as s from "../schema";
import { write } from "./write";
import { createTimetableSemesterInTransaction } from "./timetable-commands";
import {
  onboardingDraftSchema,
  importPasteSchema,
  validateSemesterDraft,
  targetBasisPoints,
  type OnboardingDraft,
} from "@/features/onboarding/model";

function putSetting(db: Database, key: string, value: unknown) {
  const previous = db
    .select()
    .from(s.settings)
    .where(eq(s.settings.key, key))
    .get();
  db.insert(s.settings)
    .values({ key, value, updatedAt: Date.now(), revision: 1 })
    .onConflictDoUpdate({
      target: s.settings.key,
      set: {
        value,
        updatedAt: Date.now(),
        revision: (previous?.revision ?? 0) + 1,
      },
    })
    .run();
}

export function saveSetupDraft(draft: OnboardingDraft) {
  onboardingDraftSchema.parse(draft);
  // Draft-only writes validate their bounded schema without scanning attendance on each keystroke.
  return getDatabase().transaction((db) =>
    putSetting(db, "onboardingDraft", draft),
  );
}
export function savePasteDraft(raw: string, semesterId: string | null) {
  const value = importPasteSchema.parse({ raw, semesterId });
  return getDatabase().transaction((db) =>
    putSetting(db, "timetableImportDraft", value),
  );
}
export function prepareSetup(
  draft: OnboardingDraft,
  manual: boolean,
): OnboardingDraft {
  onboardingDraftSchema.parse(draft);
  validateSemesterDraft(draft);
  const target = targetBasisPoints(draft.target);
  return write((db) => {
    const saved = db
      .select()
      .from(s.settings)
      .where(eq(s.settings.key, "onboardingDraft"))
      .get()?.value as OnboardingDraft | undefined;
    if (saved?.semesterId) {
      if (saved.semesterId !== draft.semesterId)
        throw new Error("Setup changed. Reopen onboarding before continuing.");
      const row = db
        .select()
        .from(s.semesters)
        .where(eq(s.semesters.id, saved.semesterId))
        .get();
      if (!row || row.archivedAt !== null)
        throw new Error(
          "Your setup semester is unavailable. Skip setup and create a semester from Timetable.",
        );
      const next: OnboardingDraft = {
        ...saved,
        step: manual ? "done" : "choice",
      };
      putSetting(db, "onboardingDraft", next);
      return next;
    }
    const { semester } = createTimetableSemesterInTransaction(
      draft.name,
      draft.startsOn,
      draft.endsOn,
      draft.timezone,
      target,
      db,
    );
    const next: OnboardingDraft = {
      ...draft,
      semesterId: semester.id,
      step: manual ? "done" : "choice",
    };
    putSetting(db, "onboardingDraft", next);
    return next;
  });
}
export function finishSetup() {
  return write((db) => {
    putSetting(db, "onboardingVersion", 1);
    db.delete(s.settings).where(eq(s.settings.key, "onboardingDraft")).run();
  });
}
