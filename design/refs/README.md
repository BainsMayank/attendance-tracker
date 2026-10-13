# Design references

Mockups for the four-tab design revamp (12 October 2026).

- **Live canvas (interactive, light/dark):** https://claude.ai/artifact/CxjU9Jda7SdwKCGWXobKri. The link is private until it's shared from the canvas's Share menu.
- **Source files:** `mockups/`. These are `.dc.html` design-canvas files. They need the canvas runtime and won't render if you open them straight in a browser, so treat them as readable references for layout, copy, data rules and interactions. `mockups/canvas.json` holds the board layout.

Colors, spacing and type match `src/ui/tokens.ts` and `docs/DESIGN.md`. Where the mockups and native conventions disagree, native conventions and DESIGN.md win.

## Screen → route map

| Mockup | Route |
|---|---|
| `Main.dc.html` (Subjects overview: rings, ± attended/missed, filter chips) | `src/app/(tabs)/(subjects)/` |
| `SubjectTopics.dc.html` (unit checklist, important stars) | `src/app/subjects/[subjectId].tsx` (Topics section) |
| `SubjectFiles.dc.html` (folders, recent files) | `src/app/subjects/[subjectId].tsx` (Files section) |
| `SubjectFilesAdd.dc.html` (Documents / Photos / Camera / New folder sheet) | Sheet inside subject detail |
| `SubjectStudy.dc.html` (deadlines, bunk planner, focus timer, notes, links) | `src/app/subjects/[subjectId].tsx` (Study section) |
| `DailyLog.dc.html` (day arrows, mark all present, holiday, Present/Absent/Neutral) | `src/app/(tabs)/daily-log/` |
| `DailyLogCalendar.dc.html` (month jump sheet) | `src/app/daily-log-calendar.tsx` |
| `Timetable.dc.html` (day chips, slots, free gaps, import banner) | `src/app/(tabs)/timetable/` |
| `TimetableSlot.dc.html` (edit class, overlap check, scope) | `src/app/timetable-slot.tsx` |
| `TimetableImport.dc.html` (external-AI steps, copy prompt) | `src/app/timetable-import.tsx` |
| `TimetableImportPaste.dc.html` (paste JSON, resolve overlap, Replace/Merge) | `src/app/timetable-import-preview.tsx` |
| `Settings.dc.html` | `src/app/(tabs)/settings/` |
| `Notifications.dc.html` | `src/app/settings-notifications.tsx` |
| `History.dc.html` | `src/app/semester-history.tsx` |
| `ResetSemester.dc.html` (backup or decline, type RESET) | `src/app/semester-reset.tsx` |

## Rules the mockups encode

- Skip / need math: can skip `floor(a / target − total)`; must attend `ceil((target·total − a) / (1 − target))`.
- Status colors: below target is red, from the target up to target + 2 points is amber, higher is green. DESIGN.md/PROGRESS.md use target + 3; the implementation should follow those docs.
- Neutral marks (cancelled, free period, excused) are left out of the totals.
- The import prompt is copied exactly from `docs/IMPORT_FORMAT.md`; no AI runs in the app.
- Sample names, rooms and numbers are placeholders.
