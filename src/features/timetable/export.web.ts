import type { TimetableData } from "@/db/repositories/timetable-commands";
import { buildTimetableExport } from "./export-format";
export async function shareTimetable(data: TimetableData) {
  const file = new File(
    [JSON.stringify(buildTimetableExport(data), null, 2)],
    "timetable.json",
    { type: "application/json" },
  );
  if (navigator.canShare?.({ files: [file] }))
    await navigator.share({ files: [file], title: "Timetable" });
  else {
    const url = URL.createObjectURL(file),
      a = document.createElement("a");
    a.href = url;
    a.download = "timetable.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
