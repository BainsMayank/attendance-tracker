import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import * as s from "../schema";
import { normalizeName } from "../validation";
import { write, StaleRevisionError } from "./write";
import {
  timetableData,
  scheduleFingerprint,
  saveTimetableInTransaction,
} from "./timetable-commands";
import { parseImport } from "@/features/timetable/import/parser";
import {
  buildImportPreview,
  type ImportMode,
} from "@/features/timetable/import/preview";
import { importEffectiveFrom } from "@/features/timetable/import/scope";
import { onboardingDraftSchema } from "@/features/onboarding/model";

export function importTimetable(input: {
  raw: string;
  semesterId: string;
  expectedFingerprint: string;
  mode: ImportMode;
  scope: "today" | "semester";
  onboarding?: boolean;
}) {
  const draft = parseImport(input.raw);
  return write((db) => {
    const before = timetableData(input.semesterId, db);
    if (scheduleFingerprint(before) !== input.expectedFingerprint)
      throw new StaleRevisionError();
    if (before.semester.archivedAt !== null)
      throw new Error("This semester is archived.");
    const setupRow = input.onboarding
      ? db
          .select()
          .from(s.settings)
          .where(eq(s.settings.key, "onboardingDraft"))
          .get()
      : undefined;
    if (input.onboarding) {
      const setup = onboardingDraftSchema.safeParse(setupRow?.value);
      if (!setup.success || setup.data.semesterId !== input.semesterId)
        throw new Error(
          "Setup changed. Return to onboarding or import from Timetable.",
        );
    }
    const from = importEffectiveFrom(before.semester, input.scope);
    const preview = buildImportPreview(draft, before, input.mode, from);
    if (preview.errors.length) throw new Error(preview.errors[0]);
    if (preview.conflicts.size)
      throw new Error(
        "Resolve the flagged overlaps before saving. Edit the pasted JSON or choose Replace timetable.",
      );
    const createdSubjects: string[] = [],
      createdTypes: string[] = [];
    const ids = new Map<string, string>();
    const meta = () => ({
      id: randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revision: 1,
    });
    for (const subject of preview.subjects) {
      if (subject.existing) {
        ids.set(subject.id, subject.id);
        continue;
      }
      const row = db
        .insert(s.subjects)
        .values({
          ...meta(),
          semesterId: input.semesterId,
          name: subject.name,
          normalizedName: normalizeName(subject.name),
          code: subject.code || null,
          teacher: subject.teacher || null,
          sortOrder: before.subjects.length + createdSubjects.length,
        })
        .returning()
        .get();
      ids.set(subject.id, row.id);
      createdSubjects.push(row.id);
    }
    for (const type of preview.types) {
      if (type.existing) {
        ids.set(type.id, type.id);
        continue;
      }
      const row = db
        .insert(s.classTypes)
        .values({
          ...meta(),
          semesterId: input.semesterId,
          name: type.name,
          normalizedName: normalizeName(type.name),
          defaultCountsAs: 1,
        })
        .returning()
        .get();
      ids.set(type.id, row.id);
      createdTypes.push(row.id);
    }
    const saved = saveTimetableInTransaction(
      {
        semesterId: input.semesterId,
        expectedFingerprint: scheduleFingerprint(
          timetableData(input.semesterId, db),
        ),
        sourceVersionId: preview.sourceVersionId,
        scope: input.scope,
        slots: preview.slots.map(
          ({ label, subjectName, classTypeName, imported, ...slot }) => ({
            ...slot,
            subjectId: ids.get(slot.subjectId) ?? slot.subjectId,
            classTypeId: ids.get(slot.classTypeId) ?? slot.classTypeId,
          }),
        ),
      },
      db,
    );
    if (setupRow) {
      db.update(s.settings)
        .set({
          value: { ...(setupRow.value as object), step: "done" },
          revision: setupRow.revision + 1,
          updatedAt: Date.now(),
        })
        .where(eq(s.settings.key, "onboardingDraft"))
        .run();
    }
    return {
      version: saved.version,
      undo: () =>
        write((tx) => {
          saved.undoInTransaction(tx);
          for (const id of createdSubjects)
            tx.delete(s.subjects).where(eq(s.subjects.id, id)).run();
          for (const id of createdTypes)
            tx.delete(s.classTypes).where(eq(s.classTypes.id, id)).run();
        }),
    };
  });
}
