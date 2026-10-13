# App backup format and recovery

Implemented 12 October 2026. Settings > Backup & restore exports the whole workspace. The older `attendance-tracker/semester` format remains separate: Semester recovery adds a deleted semester as archived history; it does not replace an existing workspace.

## Envelope

```json
{
  "format": "attendance-tracker/app",
  "version": 1,
  "schemaVersion": 4,
  "createdAt": 1791808200000,
  "activeSemesterId": null,
  "attachments": "omitted",
  "rows": {},
  "preferences": {}
}
```

The example shows envelope fields only. `rows` must contain **every** academic table below, even when its array is empty. Schema version 4 means migrations 0000–0003; no database migration was needed for Settings. Future formats require explicit migration support rather than silently accepting a newer version.

Parent-first inventory: `semesters`, `subjects`, `classTypes`, `timetableVersions`, `timetableSlots`, `extraClasses`, `holidays`, `attendanceRecords`, `classNotes`, `units`, `topics`, `notes`, `deadlines`, `marks`, `links`, `folders`, `files`, `studySessions`.

Zod validates the strict envelope, complete column shapes, UUIDs, duplicate IDs, portable preferences, file metadata and path safety. The preview then runs the actual SQLite replacement, foreign keys, CHECK constraints and semantic/prefix validation inside a transaction that deliberately rolls back. Preview never changes saved academic data.

Portable preferences: theme, accent, haptics, reduce effects, reduce transparency, subject sort, reminder rules, weekly backup preferences and feedback email. App lock, notification permission/token state, reminder deduplication, last-backup status, account metadata and unfinished onboarding/import drafts are not exported. Restore preserves this phone's app lock, account metadata and already configured feedback address. It resets onboarding/import drafts and notification runtime state.

Running/paused timers are exported paused at the captured elapsed value. Time spent on another phone or outside the exported snapshot is never credited. Deadline notification IDs are cleared; the local schedule is rebuilt from current rows and permissions.

## JSON and ZIP

- JSON contains rows and attachment metadata, with `attachments: "omitted"`. Restored file entries become `missing` and can be reimported. JSON does not embed base64 files.
- ZIP contains UTF-8 `backup.json` with `attachments: "zip"`, plus one `files/<file UUID>` entry for every ready attachment. Entries marked missing retain metadata and have no byte entry. Staged/error entries must be resolved before a ZIP backup.
- ZIP stores entries without compression to avoid expensive deflate work on the UI thread. Every included file is checked against its recorded byte length and SHA-256 before export, during preview and after writing restored bytes.
- Unknown or duplicate ZIP entries, unsafe names, incomplete/extra attachment inventories, unsupported versions, duplicate rows and checksum mismatches are rejected. Extraction never writes archive-provided paths.
- Limits: 20 MiB JSON, 50 MiB available attachment content, 71 MiB archive/expanded content, 100,000 academic rows in total, 10,000 file entries and 10,001 ZIP entries including the manifest.

Restore always writes fresh paths inside `subjects/<subject UUID>/files/` (or a semester directory for semester-level metadata). These stay compatible with the existing file deletion/Undo lifecycle.

## Commit and interruption safety

1. Pick a local JSON/ZIP through the system document picker. Preview validates structure, bytes and database constraints, and displays date, format, semester/subject/attendance/file counts and omitted/unavailable files.
2. The final destructive confirmation explains whole-workspace replacement. A fingerprint guard refuses changes made after preview.
3. The attachment queue settles pending imports and deferred deletes. A verified ZIP safety copy of the existing dataset and available attachments is written before replacement. Corrupt ready files or insufficient storage stop the restore before academic changes.
4. A durable cleanup journal records old and fresh file paths before writing incoming bytes. New bytes are verified before the database transaction commits.
5. SQLite atomically replaces academic rows and portable preferences. Folder parent links and timetable lineage are restored in a second pass with foreign keys enabled. Semantic validation and foreign-key checks must pass.
6. Cleanup deletes only paths with no surviving database reference. Rollback preserves old bytes; commit preserves new bytes; interrupted cleanup is retried on launch. Appearance is reloaded and reminders are reconciled after success.

The latest safety copy is accessible in Backup & restore. A later restore replaces the previous safety copy only after a new one has been verified. Restoring a safety copy itself uses the same preview and confirmation flow.

## Weekly local copies

Weekly backup is enabled by default, including available files. A serialized check runs on app open/foreground and while the app remains open. Overdue work creates one successful copy; it does not invent missed weeks. Only the last four successful weekly files are retained. Failure does not advance the success timestamp and is visible in Settings.

`expo-background-task` requests a minimum seven-day interval when TaskManager is available. Execution is OS-controlled and may be delayed or stopped after force-quit. Opening the app catches up. A physical device and development/production build are needed to verify background execution; Expo Go has TaskManager limitations. Backups work locally without account credentials or a network request.

Copies live under the app document directory's `app-backups/`. Manual backups and the latest safety copy are separate from four-copy weekly retention. Uninstalling removes local copies. Use the share sheet to save an external JSON/ZIP to Files, iCloud Drive or an installed Google Drive provider. These exports are not encrypted.

## SDK references

- [Expo SDK 57 filesystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/), [sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/), [document picker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/), [crypto](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/).
- [BackgroundTask](https://docs.expo.dev/versions/v57.0.0/sdk/background-task/), [TaskManager availability](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/#taskmanagerisavailableasync).
