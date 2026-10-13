import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { semestersRepository, settingsRepository } from "@/db/repositories";
import {
  timetableData,
  type TimetableData,
} from "@/db/repositories/timetable-commands";
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Could not save. Please try again.";
const listeners = new Set<() => void>();
export const subscribeTimetable = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function invalidateTimetable() {
  for (const listener of listeners) listener();
}
export function useTimetable(semesterId?: string) {
  const [data, setData] = useState<TimetableData>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    try {
      const active = settingsRepository.get("activeSemesterId")?.value;
      const id =
        semesterId ||
        (typeof active === "string"
          ? active
          : semestersRepository.list().find((s) => s.archivedAt === null)?.id);
      setData(id ? timetableData(id) : undefined);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [semesterId]);
  useFocusEffect(reload);
  useEffect(() => subscribeTimetable(reload), [reload]);
  return { data, error, loading, reload };
}
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 30000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return now;
}
export function dateInTimezone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}
