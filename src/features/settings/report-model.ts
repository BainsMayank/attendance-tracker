import type { SemesterRows } from "@/db/repositories/semester-data";
import { ledgerTotals } from "@/lib/attendance";
const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  // Spreadsheet formula injection applies even to quoted CSV fields.
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
};
export function attendanceCSV(rows: SemesterRows) {
  const subject = new Map(rows.subjects.map((s) => [s.id, s]));
  const header = [
    "Semester",
    "Timezone",
    "Date",
    "Subject",
    "Code",
    "Kind",
    "Status",
    "Class type",
    "Start minute",
    "End minute",
    "Weight",
    "Attended delta",
    "Held delta",
    "Reason",
    "Record ID",
  ];
  return (
    "\uFEFF" +
    [
      header,
      ...[...rows.attendanceRecords]
        .sort(
          (a, b) =>
            a.onDate.localeCompare(b.onDate) ||
            a.createdAt - b.createdAt ||
            a.id.localeCompare(b.id),
        )
        .map((r) => [
          rows.semesters[0].name,
          rows.semesters[0].timezone,
          r.onDate,
          subject.get(r.subjectId)?.name,
          subject.get(r.subjectId)?.code,
          r.kind,
          r.status,
          r.classTypeName,
          r.startMinute,
          r.endMinute,
          r.countsAs,
          r.attendedDelta,
          r.heldDelta,
          r.reason,
          r.id,
        ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n") +
    "\r\n"
  );
}
export const escapeHTML = (text: unknown) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const percentage = (a: number, h: number) =>
  h ? `${((a / h) * 100).toFixed(1)}%` : "No counted classes";
export function attendanceReport(rows: SemesterRows, now: number) {
  const sem = rows.semesters[0];
  const overall = rows.attendanceRecords.reduce(
    (t, r) => ({ a: t.a + r.attendedDelta, h: t.h + r.heldDelta }),
    { a: 0, h: 0 },
  );
  const subjects = rows.subjects
    .map((subject) => {
      const total = ledgerTotals(
        rows.attendanceRecords.filter((r) => r.subjectId === subject.id),
      );
      const target = subject.targetBps ?? sem.targetBps;
      return `<tr><td>${escapeHTML(subject.name)}${subject.archivedAt !== null ? " (archived)" : ""}<small>${escapeHTML(subject.code)}</small></td><td>${total.attended}</td><td>${total.held - total.attended}</td><td>${total.held}</td><td>${percentage(total.attended, total.held)}</td><td>${(target / 100).toFixed(2)}%</td></tr>`;
    })
    .join("");
  const months = [
    ...new Set(rows.attendanceRecords.map((r) => r.onDate.slice(0, 7))),
  ]
    .sort()
    .map((month) => {
      const records = rows.attendanceRecords.filter((r) =>
        r.onDate.startsWith(month),
      );
      const occurrences = records.filter((r) => r.kind === "occurrence");
      return `<tr><td>${month}</td><td>${occurrences.filter((r) => r.status === "present").length}</td><td>${occurrences.filter((r) => r.status === "absent").length}</td><td>${occurrences.filter((r) => r.status === "neutral").length}</td><td>${records.filter((r) => r.kind === "adjustment").length}</td></tr>`;
    })
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  @page { size: A4; margin: 18mm; } body { font-family: -apple-system, Arial, sans-serif; color: #171923; font-size: 11pt; line-height:1.5; } h1 {font-size:28px;margin:0 0 4px} h2 {font-size:16px;margin:28px 0 8px} p {margin:6px 0;color:#52586A} .summary {border-top:3px solid #4144D8;padding:14px 0;margin-top:22px} .number{font-size:32px;font-weight:700;color:#171923} table{border-collapse:collapse;width:100%;table-layout:fixed} th{text-align:left;background:#ECEEF5;font-size:9pt} td,th{padding:8px 6px;border-bottom:1px solid #D9DDE8;overflow-wrap:anywhere} td:first-child,th:first-child{width:30%} thead{display:table-header-group} tr{break-inside:avoid} small{display:block;color:#62697C} footer{margin-top:28px;border-top:1px solid #D9DDE8;padding-top:10px;color:#62697C} </style></head><body>
  <h1>Attendance report</h1><p>${escapeHTML(sem.name)}${sem.archivedAt !== null ? " · Archived semester" : ""}</p><p>${sem.startsOn} – ${sem.endsOn} · ${escapeHTML(sem.timezone)}</p>
  <div class="summary"><div class="number">${percentage(overall.a, overall.h)}</div><p>${overall.a} attended / ${overall.h} held attendance units · Semester target ${(sem.targetBps / 100).toFixed(2)}%</p></div>
  <h2>By subject</h2><table><thead><tr><th>Subject</th><th>Attended</th><th>Missed</th><th>Held</th><th>Attendance</th><th>Target</th></tr></thead><tbody>${subjects || '<tr><td colspan="6">No subjects in this semester.</td></tr>'}</tbody></table>
  <h2>Monthly logging</h2><p>Session counts below are separate from weighted attendance units.</p><table><thead><tr><th>Month</th><th>Present</th><th>Absent</th><th>Neutral</th><th>Adjustments</th></tr></thead><tbody>${months || '<tr><td colspan="5">No attendance recorded.</td></tr>'}</tbody></table>
  <footer>Based on saved records only; unmarked classes remain pending. Neutral classes are excluded from attendance. Balance adjustments are included in subject and overall totals. Archived subject history remains included.<br>Generated ${escapeHTML(new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: sem.timezone }).format(new Date(now)))}. Your data stays on your phone unless you choose to share this report.</footer></body></html>`;
}
