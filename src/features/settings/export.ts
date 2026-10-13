import { File, Directory, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { semesterRows } from "@/db/repositories/semester-data";
import { attendanceCSV, attendanceReport } from "./report-model";
export async function exportAttendance(
  semesterId: string,
  format: "csv" | "pdf",
) {
  const rows = semesterRows(semesterId);
  if (rows.semesters.length !== 1)
    throw new Error("Select an available semester.");
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is unavailable on this device.");
  const directory = new Directory(
    Paths.cache,
    "attendance-reports",
    randomUUID(),
  );
  directory.create({ intermediates: true });
  const file = new File(
    directory,
    `attendance-${rows.semesters[0].startsOn}.${format}`,
  );
  try {
    if (format === "csv") file.write(attendanceCSV(rows));
    else {
      const pdf = await Print.printToFileAsync({
        html: attendanceReport(rows, Date.now()),
        width: 595,
        height: 842,
      });
      new File(pdf.uri).move(file);
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: format === "pdf" ? "application/pdf" : "text/csv",
      UTI:
        format === "pdf"
          ? "com.adobe.pdf"
          : "public.comma-separated-values-text",
      dialogTitle: `Share ${rows.semesters[0].name} attendance`,
    });
  } finally {
    if (directory.exists) directory.delete();
  }
}
