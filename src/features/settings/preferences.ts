import { z } from "zod";
import { getDatabase } from "@/db/client";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateSettings } from "@/db/validation";
import { invalidateTimetable } from "@/features/timetable/hooks";
import { usePreferences } from "@/ui/theme-provider";

export function readPreference<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  const row = getDatabase()
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  return row ? schema.parse(row.value) : fallback;
}
/** A setting write validates only its own value; it never scans the academic ledger. */
export function savePreference(key: string, value: unknown, notify = true) {
  const db = getDatabase();
  let old: typeof settings.$inferSelect | undefined;
  let saved: typeof settings.$inferSelect;
  db.transaction((tx) => {
    validateSettings(key, value, tx);
    old = tx.select().from(settings).where(eq(settings.key, key)).get();
    saved = {
      key,
      value,
      updatedAt: Date.now(),
      revision: (old?.revision ?? 0) + 1,
    };
    tx.insert(settings)
      .values(saved)
      .onConflictDoUpdate({ target: settings.key, set: saved })
      .run();
  });
  syncAppearance();
  if (notify) invalidateTimetable();
  return {
    undo: () => {
      db.transaction((tx) => {
        const current = tx
          .select()
          .from(settings)
          .where(eq(settings.key, key))
          .get();
        if (current?.revision !== saved.revision)
          throw new Error(
            "This preference changed. Newer settings were preserved.",
          );
        if (old)
          tx.update(settings)
            .set({
              value: old.value,
              revision: saved.revision + 1,
              updatedAt: Date.now(),
            })
            .where(eq(settings.key, key))
            .run();
        else tx.delete(settings).where(eq(settings.key, key)).run();
      });
      syncAppearance();
      invalidateTimetable();
    },
  };
}
export function syncAppearance() {
  const rows = Object.fromEntries(
    getDatabase()
      .select()
      .from(settings)
      .all()
      .map((r) => [r.key, r.value]),
  );
  usePreferences.setState({
    mode: (rows.theme ?? "system") as "system" | "light" | "dark",
    hapticsEnabled: (rows.hapticsEnabled ?? true) as boolean,
    reduceEffects: (rows.reduceEffects ?? false) as boolean,
    reduceTransparencyPreference: (rows.reduceTransparency ?? false) as boolean,
    accent: (rows.accent ?? "indigo") as
      "indigo" | "blue" | "teal" | "rose" | "violet",
  });
}
