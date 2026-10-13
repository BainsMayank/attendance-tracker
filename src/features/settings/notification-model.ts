import { z } from "zod";
import { addDays, dayNumber } from "@/lib/attendance";
import { resolveDay, type LogData, type LogClass } from "@/lib/daily-log";
import { localParts, zonedInstant } from "@/features/subjects/content-model";
import type { ReminderRules } from "./model";

export const notificationPayload = z
  .object({
    kind: z.enum(["class", "daily", "deadline", "low", "test"]),
    semesterId: z.uuid().optional(),
    subjectId: z.uuid().optional(),
    date: z
      .string()
      .refine((v) => {
        try {
          dayNumber(v);
          return true;
        } catch {
          return false;
        }
      })
      .optional(),
    key: z.string().max(200).optional(),
    deadlineId: z.uuid().optional(),
    classStart: z.number().int().min(0).max(1439).optional(),
    classEnd: z.number().int().min(1).max(1440).optional(),
    classTypeId: z.uuid().optional(),
    classWeight: z.number().int().positive().optional(),
  })
  .strict();
export type Reminder = {
  id: string;
  at: number;
  title: string;
  body: string;
  payload: z.infer<typeof notificationPayload>;
};
export const reminderId = (kind: string, id: string) =>
  `attendance_${kind}_${id}`;
export function planReminders(
  data: LogData,
  deadlines: {
    id: string;
    subjectId: string;
    dueAt: number;
    completedAt: number | null;
    title: string;
  }[],
  rules: ReminderRules,
  now: number,
  capacity = 64,
) {
  const start = localParts(now, data.semester.timezone).date;
  const end = addDays(start, 7);
  const candidates: Reminder[] = [];
  const warnings: string[] = [];
  if (data.semester.archivedAt !== null)
    return { reminders: [], overflow: 0, warnings };
  const horizon = zonedInstant(end, 0, data.semester.timezone);
  const add = (r: Reminder) => {
    if (r.at > now && r.at < horizon) candidates.push(r);
  };
  const active = new Map(
    data.subjects.filter((s) => s.archivedAt === null).map((s) => [s.id, s]),
  );
  // Include tomorrow's class when its lead time lands inside the window.
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const day = resolveDay(data, date);
    if (day.outside) continue;
    const eligible = day.classes.filter(
      (c) => active.has(c.subjectId) && !c.holiday && !c.cancelled,
    );
    if (rules.classes)
      for (const row of eligible) {
        if (rules.mutedSubjects.includes(row.subjectId) || row.status !== null)
          continue;
        try {
          const at =
            zonedInstant(date, row.startMinute, data.semester.timezone) -
            rules.leadMinutes * 60000;
          add({
            id: reminderId("class", row.key),
            at,
            title: active.get(row.subjectId)!.name,
            body: `${row.typeName}${row.room ? ` · ${row.room}` : ""} starts in ${rules.leadMinutes} minutes.`,
            payload: {
              kind: "class",
              semesterId: data.semester.id,
              subjectId: row.subjectId,
              date,
              key: row.key,
              classStart: row.startMinute,
              classEnd: row.endMinute,
              classTypeId: row.typeId,
              classWeight: row.countsAs,
            },
          });
        } catch {
          warnings.push(
            `Class time unavailable on ${date} because the clocks change.`,
          );
        }
      }
    if (
      rules.daily &&
      !day.holiday &&
      eligible.some((c) => c.status === null)
    ) {
      try {
        add({
          id: reminderId("daily", `${data.semester.id}_${date}`),
          at: zonedInstant(date, rules.dailyMinute, data.semester.timezone),
          title: "Log today's attendance",
          body: "You still have classes to mark. Open Daily Log to finish today.",
          payload: { kind: "daily", semesterId: data.semester.id, date },
        });
      } catch {
        warnings.push(
          `Daily reminder skipped on ${date}: that time does not exist.`,
        );
      }
    }
  }
  if (rules.deadlines)
    for (const deadline of deadlines) {
      if (deadline.completedAt !== null || !active.has(deadline.subjectId))
        continue;
      for (const minutes of [1440, 60])
        add({
          id: reminderId("deadline", `${deadline.id}_${minutes}`),
          at: deadline.dueAt - minutes * 60000,
          title: deadline.title,
          body: `${active.get(deadline.subjectId)!.name} · Due in ${minutes === 1440 ? "1 day" : "1 hour"}`,
          payload: {
            kind: "deadline",
            semesterId: data.semester.id,
            subjectId: deadline.subjectId,
            deadlineId: deadline.id,
          },
        });
    }
  candidates.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const limit = Math.max(0, Math.floor(capacity));
  return {
    reminders: candidates.slice(0, limit),
    overflow: Math.max(0, candidates.length - limit),
    warnings,
  };
}
export function belowTarget(attended: number, held: number, targetBps: number) {
  return (
    held > 0 && BigInt(attended) * 10000n < BigInt(held) * BigInt(targetBps)
  );
}

export function matchesReminderClass(
  row: LogClass,
  payload: z.infer<typeof notificationPayload>,
) {
  return (
    row.key === payload.key &&
    row.subjectId === payload.subjectId &&
    row.startMinute === payload.classStart &&
    row.endMinute === payload.classEnd &&
    row.typeId === payload.classTypeId &&
    row.countsAs === payload.classWeight
  );
}
