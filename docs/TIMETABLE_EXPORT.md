# Timetable JSON export — Session 3

**Session 6 reconciliation:** `IMPORT_FORMAT.md` now defines the external-AI import contract. The import is a compact subject/slot draft with readable days/times; this export remains a separate format containing linked versions and minute-based times. Import deliberately rejects these export files. Full export re-import/backup restoration remains outside this feature; no round-trip compatibility is claimed. The former import placeholder is now a functional local copy/paste workflow.

`docs/IMPORT_FORMAT.md` did not exist when Session 3 was implemented. This is the provisional export contract; Session 6 must reconcile it with the reviewed AI/manual import format before claiming import/export round-trip compatibility.

On iOS and Android, **Export JSON** writes a UTF-8 `.json` file into the app cache and opens the OS share sheet (`application/json`, iOS UTI `public.json`). The OS manages the cached file. Web uses file sharing where supported and otherwise downloads the file.

The top-level object has:

| Field           | Contents                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `format`        | `"attendance-tracker/timetable"`                                                                                                    |
| `formatVersion` | `1`                                                                                                                                 |
| `semester`      | `name`, `startsOn`, `endsOn`, `timezone`, `weekAnchor`, `targetBps`                                                                 |
| `subjects`      | `id`, `name`, `code`, `color`, `icon`, `targetBps`, `teacher`, `archived`                                                           |
| `classTypes`    | `id`, `name`, `countsAs`, `archived`                                                                                                |
| `versions`      | `id`, `effectiveFrom`, `effectiveUntil`, `label`                                                                                    |
| `slots`         | `id`, `versionId`, `subjectId`, `classTypeId`, `weekday`, `weekPattern`, `startMinute`, `endMinute`, `venue`, `teacher`, `countsAs` |

- Dates are `YYYY-MM-DD` in the semester's IANA timezone. The semester end is inclusive; a version's `effectiveUntil` is exclusive. `null` means through semester end.
- Weekdays use Monday `1` through Sunday `7`. Week patterns are `every`, `odd`, or `even`; parity is anchored to `weekAnchor` and does not reset at a version boundary.
- Times are whole minutes after midnight. Starts are `0–1439`; ends are `1–1440`, strictly after the start. Overnight classes must be split into separate days.
- Targets use basis points: `7500` = 75%. A subject's `null` override uses the semester target. Optional codes, icons, teachers, and venues can be `null`. Colors are six-digit hex strings.
- `countsAs` is a positive integer. A class type supplies the default for new slots; each exported slot retains its own saved weight.
- IDs link slots to their version, subject, and class type. All semester subjects/types are included, including archived entries referenced by existing slots. Only active, non-superseded timetable versions and their slots are exported.
- Attendance, historical superseded versions, internal slot lineage, holidays, extra classes, other subject content, and repository revision metadata are excluded. This file exports a timetable, not a full application backup.

Session 6 should define schema validation, ID remapping, preview/conflict review, and migration of future format versions before accepting these files as imports. **Import with AI** currently shows the Session 6 placeholder only.
