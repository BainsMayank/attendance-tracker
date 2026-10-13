import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { TimetableData } from "@/db/repositories/timetable-commands";
import { buildTimetableExport } from "./export-format";
export async function shareTimetable(data: TimetableData) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable on this device.");
  const file = new File(
    Paths.cache,
    `timetable-${data.semester.id}-${Date.now()}.json`,
  );
  file.create();
  file.write(JSON.stringify(buildTimetableExport(data), null, 2));
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    UTI: "public.json",
    dialogTitle: "Export timetable",
  });
}
