import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "expo-crypto";
import { getDatabase, type Database } from "../client";
import * as s from "../schema";
import { StaleRevisionError } from "./write";
import { dayNumber, marksPercentage } from "@/lib/attendance";
import { validatedURL } from "@/features/subjects/content-model";

export type ContentKind =
  "unit" | "topic" | "note" | "deadline" | "mark" | "link";
export type SubjectScope = { semesterId: string; subjectId: string };
export function contentScope(
  scope: SubjectScope,
  db = getDatabase(),
  writable = false,
) {
  const subject = db
    .select()
    .from(s.subjects)
    .where(eq(s.subjects.id, scope.subjectId))
    .get();
  const semester = db
    .select()
    .from(s.semesters)
    .where(eq(s.semesters.id, scope.semesterId))
    .get();
  if (!subject || !semester || subject.semesterId !== semester.id)
    throw new Error("Subject unavailable in this semester.");
  if (writable && (subject.archivedAt !== null || semester.archivedAt !== null))
    throw new Error("Archived subjects and semesters are read-only.");
  return { subject, semester };
}
export function subjectContent(scope: SubjectScope) {
  const db = getDatabase();
  contentScope(scope, db);
  return {
    units: db
      .select()
      .from(s.units)
      .where(eq(s.units.subjectId, scope.subjectId))
      .orderBy(s.units.sortOrder, s.units.id)
      .all(),
    topics: db
      .select()
      .from(s.topics)
      .where(eq(s.topics.subjectId, scope.subjectId))
      .orderBy(s.topics.sortOrder, s.topics.id)
      .all(),
    notes: db
      .select()
      .from(s.notes)
      .where(eq(s.notes.subjectId, scope.subjectId))
      .orderBy(
        sql`${s.notes.pinned} DESC`,
        sql`${s.notes.updatedAt} DESC`,
        s.notes.id,
      )
      .all(),
    deadlines: db
      .select()
      .from(s.deadlines)
      .where(eq(s.deadlines.subjectId, scope.subjectId))
      .orderBy(s.deadlines.dueAt, s.deadlines.id)
      .all(),
    marks: db
      .select()
      .from(s.marks)
      .where(eq(s.marks.subjectId, scope.subjectId))
      .orderBy(sql`${s.marks.onDate} DESC`, s.marks.id)
      .all(),
    links: db
      .select()
      .from(s.links)
      .where(eq(s.links.subjectId, scope.subjectId))
      .orderBy(s.links.sortOrder, s.links.id)
      .all(),
  };
}
export type ContentData = ReturnType<typeof subjectContent>;
type Base = {
  id: string;
  subjectId: string;
  revision: number;
  title: string;
  createdAt: number;
  updatedAt: number;
};
type Repo<Row extends Base, Input> = {
  get: (id: string) => Row | undefined;
  create: (input: Input) => Row;
  update: (id: string, revision: number, patch: Partial<Input>) => Row;
  remove: (id: string, revision: number) => Row;
};
type ContentTable =
  | typeof s.units
  | typeof s.topics
  | typeof s.notes
  | typeof s.deadlines
  | typeof s.marks
  | typeof s.links;
/** Content writes touch only the selected subject, never its attendance ledger. */
function repository<T extends ContentTable>(selected: T) {
  const table: ContentTable = selected;
  type Row = T["$inferSelect"];
  type Input = Omit<
    T["$inferInsert"],
    "id" | "createdAt" | "updatedAt" | "revision"
  >;
  return {
    get: (id: string) =>
      getDatabase().select().from(table).where(eq(table.id, id)).get() as
        Row | undefined,
    create: (input: Input) =>
      getDatabase()
        .insert(table)
        .values({
          ...input,
          id: randomUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          revision: 1,
        } as ContentTable["$inferInsert"])
        .returning()
        .get() as Row,
    update: (id: string, revision: number, patch: Partial<Input>) => {
      const row = getDatabase()
        .update(table)
        .set({
          ...patch,
          updatedAt: Date.now(),
          revision: sql`${table.revision} + 1`,
        })
        .where(and(eq(table.id, id), eq(table.revision, revision)))
        .returning()
        .get();
      if (!row) throw new StaleRevisionError();
      return row as Row;
    },
    remove: (id: string, revision: number) => {
      const row = getDatabase()
        .delete(table)
        .where(and(eq(table.id, id), eq(table.revision, revision)))
        .returning()
        .get();
      if (!row) throw new StaleRevisionError();
      return row as Row;
    },
  };
}
const unitsRepository = repository(s.units),
  topicsRepository = repository(s.topics),
  notesRepository = repository(s.notes),
  deadlinesRepository = repository(s.deadlines),
  marksRepository = repository(s.marks),
  linksRepository = repository(s.links);
function validateContent(scope: SubjectScope, db: Database) {
  const notes = db
    .select()
    .from(s.notes)
    .where(eq(s.notes.subjectId, scope.subjectId))
    .all();
  const topics = db
    .select()
    .from(s.topics)
    .where(eq(s.topics.subjectId, scope.subjectId))
    .all();
  if (
    notes.some(
      (n) =>
        n.unitId &&
        n.topicId &&
        topics.find((t) => t.id === n.topicId)?.unitId !== n.unitId,
    )
  )
    throw new Error(
      "The topic is linked to a note in its current unit. Update that association before moving it.",
    );
  marksPercentage(
    db
      .select()
      .from(s.marks)
      .where(eq(s.marks.subjectId, scope.subjectId))
      .all(),
    "unweighted",
  );
}
function change<Row extends Base, Input>(
  repo: Repo<Row, Input>,
  scope: SubjectScope,
  input: Input,
  id?: string,
  revision?: number,
) {
  const db = getDatabase();
  const { before, saved } = db.transaction((tx) => {
    contentScope(scope, tx, true);
    const before = id ? repo.get(id) : undefined;
    if (
      id &&
      (!before ||
        before.subjectId !== scope.subjectId ||
        before.revision !== revision)
    )
      throw new StaleRevisionError();
    const saved = before
      ? repo.update(before.id, before.revision, input)
      : repo.create(input);
    validateContent(scope, tx);
    return { before, saved };
  });
  let used = false;
  return {
    row: saved,
    undo: () => {
      db.transaction((tx) => {
        contentScope(scope, tx, true);
        if (used || repo.get(saved.id)?.revision !== saved.revision)
          throw new StaleRevisionError();
        if (before) {
          // Metadata is managed by the repository; never move a revision backwards.
          const patch = { ...before } as Record<string, unknown>;
          for (const key of ["id", "createdAt", "updatedAt", "revision"])
            delete patch[key];
          repo.update(saved.id, saved.revision, patch as Partial<Input>);
        } else repo.remove(saved.id, saved.revision);
        validateContent(scope, tx);
      });
      used = true;
    },
  };
}
const title = z
  .string()
  .trim()
  .min(1, "Enter a title.")
  .max(200, "Use at most 200 characters.");
const instant = z.number().int().safe();
export function saveContent(...args: Parameters<typeof saveContentInput>) {
  try {
    return saveContentInput(...args);
  } catch (e) {
    if (e instanceof z.ZodError) {
      const issue = e.issues[0];
      throw new Error(`${issue.path.join(" ") || "Input"}: ${issue.message}`);
    }
    throw e;
  }
}
function saveContentInput(
  scope: SubjectScope,
  kind: ContentKind,
  raw: unknown,
  id?: string,
  revision?: number,
) {
  const base = { subjectId: scope.subjectId };
  const optional = z.number().int().safe().nonnegative().nullable();
  switch (kind) {
    case "unit": {
      const rows = subjectContent(scope).units;
      return change(
        unitsRepository,
        scope,
        {
          ...base,
          ...(!id
            ? { sortOrder: Math.max(-1, ...rows.map((r) => r.sortOrder)) + 1 }
            : {}),
          ...z.object({ title }).parse(raw),
        },
        id,
        revision,
      );
    }
    case "topic": {
      const input = z
        .object({
          title,
          unitId: z.uuid(),
          important: z.boolean(),
          completedAt: optional,
        })
        .parse(raw);
      const rows = subjectContent(scope).topics.filter(
        (t) => t.unitId === input.unitId,
      );
      const current = id ? topicsRepository.get(id) : undefined;
      return change(
        topicsRepository,
        scope,
        {
          ...base,
          ...(!id || current?.unitId !== input.unitId
            ? { sortOrder: Math.max(-1, ...rows.map((r) => r.sortOrder)) + 1 }
            : {}),
          ...input,
        },
        id,
        revision,
      );
    }
    case "note":
      return change(
        notesRepository,
        scope,
        {
          ...base,
          ...z
            .object({
              title,
              body: z.string().max(200000, "Note is too long."),
              pinned: z.boolean(),
            })
            .parse(raw),
        },
        id,
        revision,
      );
    case "deadline":
      return change(
        deadlinesRepository,
        scope,
        {
          ...base,
          ...z
            .object({
              title,
              category: z.enum([
                "assignment",
                "quiz",
                "mid-sem",
                "end-sem",
                "other",
                "exam",
              ]),
              dueAt: instant,
              completedAt: optional,
            })
            .parse(raw),
        },
        id,
        revision,
      );
    case "mark": {
      const input = z
        .object({
          title,
          earned: z.number().finite().nonnegative(),
          maximum: z.number().finite().positive(),
          onDate: z.string(),
        })
        .parse(raw);
      dayNumber(input.onDate);
      if (input.earned > input.maximum)
        throw new Error("Marks cannot exceed maximum marks.");
      return change(
        marksRepository,
        scope,
        { ...base, ...input },
        id,
        revision,
      );
    }
    case "link": {
      const input = z.object({ title, url: z.string() }).parse(raw);
      return change(
        linksRepository,
        scope,
        { ...base, ...input, url: validatedURL(input.url) },
        id,
        revision,
      );
    }
    default:
      throw new Error("Unknown subject content type.");
  }
}
export function deleteContent(
  scope: SubjectScope,
  kind: ContentKind,
  id: string,
  revision: number,
) {
  function remove<Row extends Base, Input>(repo: Repo<Row, Input>) {
    contentScope(scope, getDatabase(), true);
    const before = repo.get(id);
    if (
      !before ||
      before.subjectId !== scope.subjectId ||
      before.revision !== revision
    )
      throw new StaleRevisionError();
    const db = getDatabase();
    db.transaction((tx) => {
      contentScope(scope, tx, true);
      if (
        kind === "unit" &&
        (tx.select().from(s.topics).where(eq(s.topics.unitId, id)).get() ||
          tx.select().from(s.notes).where(eq(s.notes.unitId, id)).get())
      )
        throw new Error(
          "This unit has topics or linked notes. Move or remove them first.",
        );
      if (
        kind === "topic" &&
        (tx.select().from(s.notes).where(eq(s.notes.topicId, id)).get() ||
          tx
            .select()
            .from(s.studySessions)
            .where(eq(s.studySessions.topicId, id))
            .get())
      )
        throw new Error(
          "This topic is linked to notes or study sessions and must be retained.",
        );
      repo.remove(id, revision);
    });
    let used = false;
    return {
      undo: () => {
        contentScope(scope, getDatabase(), true);
        if (used || repo.get(id)) throw new StaleRevisionError();
        const db = getDatabase();
        const table = {
          unit: s.units,
          topic: s.topics,
          note: s.notes,
          deadline: s.deadlines,
          mark: s.marks,
          link: s.links,
        }[kind];
        db.transaction((tx) => {
          tx.insert(table)
            .values({
              ...before,
              revision: before.revision + 1,
            } as typeof table.$inferInsert)
            .run();
          validateContent(scope, tx);
        });
        used = true;
      },
    };
  }
  switch (kind) {
    case "unit":
      return remove(unitsRepository);
    case "topic":
      return remove(topicsRepository);
    case "note":
      return remove(notesRepository);
    case "deadline":
      return remove(deadlinesRepository);
    case "mark":
      return remove(marksRepository);
    case "link":
      return remove(linksRepository);
  }
}
export function orderFingerprint(
  rows: { id: string; revision: number; sortOrder: number }[],
) {
  return JSON.stringify(rows.map((r) => [r.id, r.revision, r.sortOrder]));
}
export function reorderContent(
  scope: SubjectScope,
  kind: "unit" | "topic",
  orderedIds: string[],
  expected: string,
  unitId?: string,
) {
  const db = getDatabase();
  const table = kind === "unit" ? s.units : s.topics;
  const read = (tx: Database) =>
    kind === "unit"
      ? tx
          .select()
          .from(s.units)
          .where(eq(s.units.subjectId, scope.subjectId))
          .orderBy(s.units.sortOrder, s.units.id)
          .all()
      : tx
          .select()
          .from(s.topics)
          .where(
            and(
              eq(s.topics.subjectId, scope.subjectId),
              eq(s.topics.unitId, unitId ?? ""),
            ),
          )
          .orderBy(s.topics.sortOrder, s.topics.id)
          .all();
  const result = db.transaction((tx) => {
    contentScope(scope, tx, true);
    const before = read(tx);
    if (orderFingerprint(before) !== expected) throw new StaleRevisionError();
    if (
      orderedIds.length !== before.length ||
      new Set(orderedIds).size !== before.length ||
      before.some((r) => !orderedIds.includes(r.id))
    )
      throw new Error("Reorder must contain every sibling exactly once.");
    orderedIds.forEach((id, i) =>
      tx
        .update(table)
        .set({
          sortOrder: i,
          revision: sql`${table.revision} + 1`,
          updatedAt: Date.now(),
        })
        .where(eq(table.id, id))
        .run(),
    );
    return { before, after: orderFingerprint(read(tx)) };
  });
  let used = false;
  return {
    undo: () => {
      db.transaction((tx) => {
        contentScope(scope, tx, true);
        if (used || orderFingerprint(read(tx)) !== result.after)
          throw new StaleRevisionError();
        result.before.forEach((r) =>
          tx
            .update(table)
            .set({
              sortOrder: r.sortOrder,
              revision: sql`${table.revision} + 1`,
              updatedAt: Date.now(),
            })
            .where(eq(table.id, r.id))
            .run(),
        );
      });
      used = true;
    },
  };
}
