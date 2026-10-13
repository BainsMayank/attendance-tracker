import type {
  TimetableData,
  SlotRow,
} from "@/db/repositories/timetable-commands";
import { formatTime } from "@/lib/timetable";

export function slotLabel(data: TimetableData, slot: SlotRow) {
  const subject = data.subjects.find((s) => s.id === slot.subjectId)!;
  const type = data.types.find((t) => t.id === slot.classTypeId)!;
  return `${subject.name}, ${type.name}, ${formatTime(slot.startMinute)} to ${formatTime(slot.endMinute)}, ${slot.parity === "all" ? "every week" : `${slot.parity} weeks`}${slot.room ? `, ${slot.room}` : ""}${slot.teacher ? `, ${slot.teacher}` : ""}`;
}
