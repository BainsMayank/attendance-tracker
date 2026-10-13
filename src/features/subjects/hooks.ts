import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { semestersRepository, settingsRepository } from "@/db/repositories";
import { subjectsData } from "@/db/repositories/subject-attendance";
import {
  dateInTimezone,
  errorMessage,
  subscribeTimetable,
  useClock,
} from "@/features/timetable/hooks";
import { nextClasses, subjectModels, type SubjectSort } from "@/lib/subjects";

export function useSubjects(semesterId?: string) {
  const now = useClock();
  const [snapshot, setSnapshot] = useState<ReturnType<typeof subjectsData>>();
  const [sort, setSort] = useState<SubjectSort>("name");
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
      setSnapshot(id ? subjectsData(id, now) : undefined);
      const saved = settingsRepository.get("subjectSort")?.value;
      setSort(saved === "percentage" || saved === "nextClass" ? saved : "name");
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [semesterId, now]);
  useFocusEffect(reload);
  useEffect(() => subscribeTimetable(reload), [reload]);
  const models = useMemo(() => {
    if (!snapshot) return [];
    const local = dateInTimezone(now, snapshot.data.semester.timezone);
    return subjectModels(
      snapshot.data,
      snapshot.totals,
      nextClasses(snapshot.data, local.date, local.minute),
    );
  }, [snapshot, now]);
  return { ...snapshot, models, sort, now, error, loading, reload };
}
