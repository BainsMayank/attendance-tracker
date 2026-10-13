import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { links as table } from "../schema";
import { getDatabase } from "../client";
import { write, StaleRevisionError } from "./write";
type Create = Omit<
  typeof table.$inferInsert,
  "id" | "createdAt" | "updatedAt" | "revision"
>;
type Patch = Partial<Create>;
export const linksRepository = {
  list: () => getDatabase().select().from(table).all(),
  get: (id: string) =>
    getDatabase().select().from(table).where(eq(table.id, id)).get(),
  create: (input: Create) =>
    write((db) => {
      const now = Date.now();
      return db
        .insert(table)
        .values({
          ...input,
          id: randomUUID(),
          createdAt: now,
          updatedAt: now,
          revision: 1,
        })
        .returning()
        .get();
    }),
  update: (id: string, expectedRevision: number, patch: Patch) =>
    write((db) => {
      const row = db
        .update(table)
        .set({
          ...patch,
          updatedAt: Date.now(),
          revision: sql`${table.revision} + 1`,
        })
        .where(and(eq(table.id, id), eq(table.revision, expectedRevision)))
        .returning()
        .get();
      if (!row) throw new StaleRevisionError();
      return row;
    }),
  remove: (id: string, expectedRevision: number) =>
    write((db) => {
      const row = db
        .delete(table)
        .where(and(eq(table.id, id), eq(table.revision, expectedRevision)))
        .returning()
        .get();
      if (!row) throw new StaleRevisionError();
      return row;
    }),
};
