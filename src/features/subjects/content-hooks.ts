import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  subjectContent,
  type ContentData,
  type SubjectScope,
} from "@/db/repositories/subject-content";
import { errorMessage, subscribeTimetable } from "@/features/timetable/hooks";

export function useSubjectContent(scope: SubjectScope) {
  const { semesterId, subjectId } = scope;
  const [data, setData] = useState<ContentData>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    try {
      setData(subjectContent({ semesterId, subjectId }));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [semesterId, subjectId]);
  useFocusEffect(reload);
  useEffect(() => subscribeTimetable(reload), [reload]);
  return { data, error, loading, reload };
}
