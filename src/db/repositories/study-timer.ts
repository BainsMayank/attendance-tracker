import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { z } from "zod";
import { getDatabase } from "../client";
import { studySessions as table } from "../schema";
import { contentScope, type SubjectScope } from "./subject-content";
import { StaleRevisionError } from "./write";
import { timerSnapshot } from "@/features/subjects/content-model";

export function studyData(scope: SubjectScope) {
  const db = getDatabase();
  contentScope(scope, db);
  return {
    sessions: db
      .select()
      .from(table)
      .where(eq(table.subjectId, scope.subjectId))
      .orderBy(sql`${table.startedAt} DESC`, table.id)
      .all(),
    active: db
      .select()
      .from(table)
      .where(inArray(table.state, ["running", "paused"]))
      .get(),
  };
}
export function startStudy(
  scope: SubjectScope,
  focusMinutes: number,
  breakMinutes: number,
  topicId: string | null = null,
  now = Date.now(),
) {
  const durations = { focusMinutes, breakMinutes };
  if (!Number.isInteger(focusMinutes) || focusMinutes < 1 || focusMinutes > 180)
    throw new Error("Focus must be a whole number from 1 to 180 minutes.");
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 60)
    throw new Error("Break must be a whole number from 0 to 60 minutes.");
  z.number().int().safe().nonnegative().parse(now);
  const db = getDatabase();
  const row = db.transaction((tx) => {
    contentScope(scope, tx, true);
    if (
      tx
        .select()
        .from(table)
        .where(inArray(table.state, ["running", "paused"]))
        .get()
    )
      throw new Error("A timer is already active. Resume or finish it first.");
    return tx
      .insert(table)
      .values({
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        semesterId: scope.semesterId,
        subjectId: scope.subjectId,
        topicId,
        startedAt: now,
        state: "running",
        phase: "focus",
        plannedFocusSeconds: durations.focusMinutes * 60,
        plannedBreakSeconds: durations.breakMinutes * 60,
        phaseStartedAt: now,
        checkpointAt: now,
      })
      .returning()
      .get();
  });
  let used = false;
  return {
    row,
    undo: () => {
      db.transaction((tx) => {
        contentScope(scope, tx, true);
        if (
          used ||
          tx.select().from(table).where(eq(table.id, row.id)).get()
            ?.revision !== row.revision
        )
          throw new StaleRevisionError();
        tx.delete(table).where(eq(table.id, row.id)).run();
      });
      used = true;
    },
  };
}
export type StudyAction = "pause" | "resume" | "next" | "finish" | "discard";
export function updateStudy(
  scope: SubjectScope,
  id: string,
  revision: number,
  action: StudyAction,
  now = Date.now(),
) {
  z.number().int().safe().nonnegative().parse(now);
  if (!["pause", "resume", "next", "finish", "discard"].includes(action))
    throw new Error("Invalid timer action.");
  const db = getDatabase();
  const result = db.transaction((tx) => {
    contentScope(scope, tx, true);
    const before = tx
      .select()
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.subjectId, scope.subjectId),
          eq(table.semesterId, scope.semesterId),
        ),
      )
      .get();
    if (!before || before.revision !== revision) throw new StaleRevisionError();
    if (!["running", "paused"].includes(before.state))
      throw new Error("This session is already finished.");
    const snapshot = timerSnapshot(before, now);
    if (snapshot.clockAnomaly && action !== "discard" && action !== "pause")
      throw new Error(
        "The device clock moved backwards. Pause, then resume to confirm a new time reference.",
      );
    if (
      (action === "pause" && before.state !== "running") ||
      (action === "resume" && before.state !== "paused")
    )
      throw new Error("Timer state changed. Reload and try again.");
    if (action === "next" && snapshot.remaining > 0)
      throw new Error("Finish this phase before starting the next one.");
    const nextPhase =
      before.phase === "focus" && before.plannedBreakSeconds > 0
        ? "break"
        : "focus";
    const patch = {
      activeSeconds: snapshot.activeSeconds,
      phase: action === "next" ? nextPhase : before.phase,
      phaseStartedAt:
        action === "next" ? now : now - snapshot.phaseElapsed * 1000,
      checkpointAt: now,
      state:
        action === "finish"
          ? ("completed" as const)
          : action === "discard"
            ? ("discarded" as const)
            : action === "pause"
              ? ("paused" as const)
              : ("running" as const),
      endedAt:
        action === "finish" || action === "discard"
          ? Math.max(now, before.startedAt)
          : null,
      revision: before.revision + 1,
      updatedAt: now,
    };
    const row = tx
      .update(table)
      .set(patch)
      .where(eq(table.id, id))
      .returning()
      .get();
    return { before, row, snapshot };
  });
  let used = false;
  return {
    row: result.row,
    undo: () => {
      db.transaction((tx) => {
        contentScope(scope, tx, true);
        if (
          used ||
          tx.select().from(table).where(eq(table.id, id)).get()?.revision !==
            result.row.revision
        )
          throw new StaleRevisionError();
        if (
          tx
            .select()
            .from(table)
            .where(
              and(
                ne(table.id, id),
                inArray(table.state, ["running", "paused"]),
              ),
            )
            .get()
        )
          throw new Error(
            "Another timer is active. Finish it before restoring this session.",
          );
        const at = Date.now();
        // Undo restores the previous state without counting the interval spent in the new state.
        tx.update(table)
          .set({
            ...result.before,
            activeSeconds: result.snapshot.activeSeconds,
            phaseStartedAt: at - result.snapshot.phaseElapsed * 1000,
            checkpointAt: at,
            updatedAt: at,
            revision: result.row.revision + 1,
          })
          .where(eq(table.id, id))
          .run();
      });
      used = true;
    },
  };
}
