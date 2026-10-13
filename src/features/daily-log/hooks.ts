import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { semestersRepository, settingsRepository } from "@/db/repositories";
import { logRange, subjectTotals } from "@/db/repositories/daily-log";
import { localToday } from "@/db/validation";
import { monthBounds, resolveDay, type LogData } from "@/lib/daily-log";
import { addDays } from "@/lib/attendance";
import {
  errorMessage,
  subscribeTimetable,
  invalidateTimetable,
} from "@/features/timetable/hooks";
import { haptic, useToast } from "@/ui";

type Snapshot = { data: LogData; totals: ReturnType<typeof subjectTotals> };
const cache = new Map<string, Snapshot>();
subscribeTimetable(() => cache.clear());
function load(semesterId: string, date: string) {
  const bounds = monthBounds(date),
    key = `${semesterId}:${bounds.start}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const data = logRange(
    semesterId,
    addDays(bounds.start, -1),
    addDays(bounds.end, 1),
  );
  const snapshot = {
    data,
    totals: subjectTotals(semesterId, localToday(data.semester.timezone)),
  };
  cache.set(key, snapshot);
  if (cache.size > 6) cache.delete(cache.keys().next().value!);
  return snapshot;
}
/** Nearest earlier/later date with classes, within the semester; falls back to the adjacent day. */
export function adjacentClassDay(
  semesterId: string,
  date: string,
  direction: 1 | -1,
) {
  const { data } = load(semesterId, date);
  for (let i = 1; i <= 21; i++) {
    const next = addDays(date, i * direction);
    if (next < data.semester.startsOn || next > data.semester.endsOn) break;
    if (resolveDay(load(semesterId, next).data, next).classes.length)
      return next;
  }
  return addDays(date, direction);
}
export function useLogData(date: string, semesterId?: string) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    try {
      const active = settingsRepository.get("activeSemesterId")?.value;
      const id =
        semesterId ??
        (typeof active === "string"
          ? active
          : semestersRepository.list().find((s) => s.archivedAt === null)?.id);
      setSnapshot(id ? load(id, date) : undefined);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [date, semesterId]);
  useFocusEffect(reload);
  useEffect(() => subscribeTimetable(reload), [reload]);
  useEffect(() => {
    if (!snapshot) return;
    const frame = requestAnimationFrame(() => {
      try {
        const { previous, next } = monthBounds(date);
        load(snapshot.data.semester.id, previous);
        load(snapshot.data.semester.id, next);
      } catch {
        /* Adjacent prefetch is optional; foreground queries expose errors. */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [snapshot, date]);
  return { ...snapshot, error, loading, reload };
}
export function useLogMutation() {
  const toast = useToast(),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (
    operation: () => { undo: () => void },
    message: string,
  ) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    try {
      const result = operation();
      invalidateTimetable();
      void haptic("light");
      toast({
        message,
        undo: () => {
          result.undo();
          invalidateTimetable();
        },
      });
      return true;
    } catch (e) {
      setError(errorMessage(e));
      void haptic("error");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { run, busy, error };
}
