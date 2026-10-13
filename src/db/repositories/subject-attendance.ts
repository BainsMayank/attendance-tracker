import { and, eq, gte, lte, isNull, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { getDatabase, type Database } from "../client";
import * as s from "../schema";
import { localToday } from "../validation";
import { ledgerTotals, totals } from "@/lib/attendance";
import { logRange, subjectTotals } from "./daily-log";
import { StaleRevisionError } from "./write";
import { subjectsRepository } from "./subjects";

export function subjectsData(semesterId: string, now: Date) {
  const db = getDatabase();
  const semester = db
    .select()
    .from(s.semesters)
    .where(eq(s.semesters.id, semesterId))
    .get();
  if (!semester) throw new Error("Semester unavailable.");
  // Read schedule metadata without loading the entire attendance history.
  const data = logRange(
    semesterId,
    semester.startsOn,
    semester.endsOn,
    db,
    false,
  );
  // Only today's pre-marked classes can overlap the future planner horizon.
  const loggedToday = db
    .select()
    .from(s.attendanceRecords)
    .where(
      and(
        eq(s.attendanceRecords.semesterId, semesterId),
        eq(s.attendanceRecords.onDate, localToday(semester.timezone)),
        eq(s.attendanceRecords.kind, "occurrence"),
      ),
    )
    .all();
  const deadlines = db
    .select()
    .from(s.deadlines)
    .innerJoin(s.subjects, eq(s.deadlines.subjectId, s.subjects.id))
    .where(
      and(
        eq(s.subjects.semesterId, semesterId),
        isNull(s.deadlines.completedAt),
        gte(s.deadlines.dueAt, now.getTime()),
        lte(s.deadlines.dueAt, now.getTime() + 7 * 86400000),
      ),
    )
    .all()
    .map((row) => row.deadlines);
  return {
    data,
    loggedToday,
    totals: subjectTotals(
      semesterId,
      semester.archivedAt !== null
        ? semester.endsOn
        : localToday(semester.timezone),
    ),
    deadlines,
    syllabus: db
      .select({
        subjectId: s.topics.subjectId,
        total: sql<number>`count(*)`,
        done: sql<number>`sum(case when ${s.topics.completedAt} is not null then 1 else 0 end)`,
      })
      .from(s.topics)
      .innerJoin(s.subjects, eq(s.topics.subjectId, s.subjects.id))
      .where(eq(s.subjects.semesterId, semesterId))
      .groupBy(s.topics.subjectId)
      .all(),
  };
}

function ledger(db: Database, subjectId: string) {
  return db
    .select()
    .from(s.attendanceRecords)
    .where(eq(s.attendanceRecords.subjectId, subjectId))
    .orderBy(
      s.attendanceRecords.onDate,
      s.attendanceRecords.createdAt,
      s.attendanceRecords.id,
    )
    .all();
}
function editable(db: Database, semesterId: string, subjectId: string) {
  const semester = db
    .select()
    .from(s.semesters)
    .where(eq(s.semesters.id, semesterId))
    .get();
  const subject = db
    .select()
    .from(s.subjects)
    .where(eq(s.subjects.id, subjectId))
    .get();
  if (!semester || !subject || subject.semesterId !== semesterId)
    throw new Error("Subject unavailable in this semester.");
  if (semester.archivedAt !== null || subject.archivedAt !== null)
    throw new Error("Archived subjects and semesters are read-only.");
  const today = localToday(semester.timezone);
  if (today < semester.startsOn)
    throw new Error(
      "Attendance adjustments are available once the semester starts.",
    );
  return { subject, date: today > semester.endsOn ? semester.endsOn : today };
}

/** Append a one-unit correction; counters and original class marks are never edited. */
export function adjustSubject(input: {
  semesterId: string;
  subjectId: string;
  subjectRevision: number;
  field: "attended" | "missed";
  direction: 1 | -1;
  expected: { attended: number; held: number };
}) {
  if (
    !["attended", "missed"].includes(input.field) ||
    ![1, -1].includes(input.direction)
  )
    throw new Error("Invalid adjustment.");
  const db = getDatabase();
  const saved = db.transaction((tx) => {
    const { subject, date } = editable(tx, input.semesterId, input.subjectId);
    if (subject.revision !== input.subjectRevision)
      throw new StaleRevisionError();
    const before = ledger(tx, input.subjectId);
    const current = ledgerTotals(before);
    if (
      current.attended !== input.expected.attended ||
      current.held !== input.expected.held
    )
      throw new StaleRevisionError();
    const attendedDelta = input.field === "attended" ? input.direction : 0;
    try {
      totals(current.attended + attendedDelta, current.held + input.direction);
    } catch {
      throw new Error(
        `Cannot remove ${input.field}: the total would become negative.`,
      );
    }
    // Strictly order same-day taps even within a single millisecond.
    const createdAt = before.reduce(
      (latest, r) =>
        r.onDate === date ? Math.max(latest, r.createdAt + 1) : latest,
      Date.now(),
    );
    const record = tx
      .insert(s.attendanceRecords)
      .values({
        id: randomUUID(),
        semesterId: input.semesterId,
        subjectId: input.subjectId,
        onDate: date,
        kind: "adjustment",
        createdAt,
        updatedAt: Date.now(),
        attendedDelta,
        heldDelta: input.direction,
        reason: `Subjects: ${input.direction === 1 ? "add" : "remove"} 1 ${input.field} attendance unit`,
      })
      .returning()
      .get();
    const after = ledger(tx, input.subjectId);
    ledgerTotals(after);
    return { record, fingerprint: JSON.stringify(after) };
  });
  let used = false;
  return {
    record: saved.record,
    undo: () => {
      db.transaction((tx) => {
        if (used) throw new Error("This adjustment was already undone.");
        editable(tx, input.semesterId, input.subjectId);
        if (JSON.stringify(ledger(tx, input.subjectId)) !== saved.fingerprint)
          throw new Error(
            "This subject's attendance changed. Newer data was preserved.",
          );
        tx.delete(s.attendanceRecords)
          .where(eq(s.attendanceRecords.id, saved.record.id))
          .run();
        ledgerTotals(ledger(tx, input.subjectId));
      });
      used = true;
    },
  };
}

export function changeSubject(
  subject: typeof s.subjects.$inferSelect,
  patch: { color?: string; archivedAt?: number | null },
) {
  const db = getDatabase();
  const semester = db
    .select()
    .from(s.semesters)
    .where(eq(s.semesters.id, subject.semesterId))
    .get();
  if (!semester || semester.archivedAt !== null)
    throw new Error("Archived semesters are read-only.");
  const saved = subjectsRepository.update(subject.id, subject.revision, patch);
  return {
    undo: () => {
      const currentSemester = db
        .select()
        .from(s.semesters)
        .where(eq(s.semesters.id, subject.semesterId))
        .get();
      if (!currentSemester || currentSemester.archivedAt !== null)
        throw new Error("Archived semesters are read-only.");
      subjectsRepository.update(saved.id, saved.revision, {
        color: subject.color,
        archivedAt: subject.archivedAt,
      });
    },
  };
}
/** Neutral marks are excluded from totals; the detail view still reports how many exist. */
export function neutralCount(semesterId: string, subjectId: string) {
  return getDatabase()
    .select({ id: s.attendanceRecords.id })
    .from(s.attendanceRecords)
    .where(
      and(
        eq(s.attendanceRecords.semesterId, semesterId),
        eq(s.attendanceRecords.subjectId, subjectId),
        eq(s.attendanceRecords.status, "neutral"),
      ),
    )
    .all().length;
}
