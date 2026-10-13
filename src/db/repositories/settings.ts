import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "../client";
import { settings as table } from "../schema";
import { write, StaleRevisionError } from "./write";
import { validateSettings } from "../validation";
export const settingsRepository = {
  list: () => getDatabase().select().from(table).all(),
  get: (key: string) =>
    getDatabase().select().from(table).where(eq(table.key, key)).get(),
  set: (key: string, value: unknown, expectedRevision: number | null) =>
    write((db) => {
      validateSettings(key, value, db);
      if (expectedRevision === null)
        return db
          .insert(table)
          .values({ key, value, updatedAt: Date.now(), revision: 1 })
          .returning()
          .get();
      const row = db
        .update(table)
        .set({
          value,
          updatedAt: Date.now(),
          revision: sql`${table.revision} + 1`,
        })
        .where(and(eq(table.key, key), eq(table.revision, expectedRevision)))
        .returning()
        .get();
      if (!row) throw new StaleRevisionError();
      return row;
    }),
  remove: (key: string, expectedRevision: number) =>
    write((db) => {
      const row = db
        .delete(table)
        .where(and(eq(table.key, key), eq(table.revision, expectedRevision)))
        .returning()
        .get();
      if (!row) throw new StaleRevisionError();
      return row;
    }),
};
