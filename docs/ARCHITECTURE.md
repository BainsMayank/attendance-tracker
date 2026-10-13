# Attendance Tracker architecture

Session 1 planning draft · 11 October 2026 · Expo SDK 57

**Settings implementation update (12 October 2026):** the fourth tab is a native grouped Settings hub. Thin `/settings-notifications`, `/settings-mutes`, `/settings-backup`, `/settings-export`, `/settings-appearance`, `/settings-privacy`, `/settings-about` and `/settings-licenses` routes delegate to `src/features/settings/`. Its strict setting schemas extend the existing registry without changing the 19-table database or migrations. Appearance loads before workspace presentation and uses the shared theme tokens throughout the app.

`SettingsRuntime` configures local notification categories and reconciles a seven-calendar-day window on app open/foreground, timetable/attendance/content/preference invalidation and long foreground sessions. Only the selected active semester is scheduled. The pure planner honors effective timetable versions, parity, subject/global holidays, allowed extras, cancellations, marks, muted subjects and semester-local time. Deadlines schedule at 24 hours and 1 hour before; low-attendance crossings use exact weighted totals and a persisted per-subject latch. The nearest reminders fit within 64 minus unrelated pending notifications; overflow is visible. Differential signatures avoid repeated cancel/recreate work. No push tokens, remote notification service or background remote-notification mode is used.

Class categories offer Present/Absent actions that open the app. Responses wait for app authentication, validate the original occurrence's subject/time/type/weight, reject stale/marked/archived classes, and use the existing revision-guarded Daily Log command with haptic/Undo. Rejected stale marks open Daily Log for review. A shared background timestamp prevents the response listener from racing the lock listener on foreground return. Local actions are supported in Expo Go; Face ID needs a development build. Android exact-alarm permission is configured; delivery can be delayed if the phone has not allowed Alarms & reminders.

The whole-workspace backup format is now `attendance-tracker/app`, version 1/schema 4, described in [APP_BACKUP.md](APP_BACKUP.md). It coexists with scoped semester recovery. JSON excludes file bytes; ZIP includes available files with SHA-256 verification. Preview uses a deliberately rolled-back replacement transaction; confirmed restore requires an unchanged fingerprint, a verified safety copy, fresh canonical file paths and a durable reference-aware cleanup journal before atomic row replacement. Export pauses active timer snapshots without changing the live timer. Weekly local backups keep the latest four successful copies, request OS background work and catch up when opened. No cloud account or cloud API is involved.

Semester CSV contains saved occurrences and balance adjustments, quoting fields and neutralizing spreadsheet formulas in text. `expo-print` renders an escaped A4 HTML report with weighted overall/subject totals, targets and separate monthly session counts. Reports include archived history and explicitly leave unmarked classes pending. Appearance adds light/dark/system, five contrast-conscious accent pairs and reduce transparency alongside the existing motion/haptic controls. App lock authenticates on cold launch and after at least one background minute; a full-screen cover also hides toasts and presented sheets. Authentication is required to enable, disable or Undo the lock preference. Lock and permissions are device-specific and never imported.

About reads app version/build, opens a user-reviewed feedback email and bundles searchable notices generated from installed production dependencies with `npm run settings:licenses`. The owner has not supplied a feedback address; it can be configured in About, and the email action stays disabled until configured. Privacy states that data stays on the phone and distinguishes user-directed exports/external links. App lock does not encrypt SQLite or backup files. SDK 57 documentation was checked for notifications, print, local authentication, background tasks, TaskManager, filesystem and native universal UI.

**Session 6 import/onboarding update:** the current import is an external ChatGPT/Gemini copy/paste workflow with local parsing only, defined in `IMPORT_FORMAT.md`. It has no AI backend, provider calls, uploads, or credentials. This supersedes all proposed AI-server/upload sections below. Thin routes `/timetable-import`, `/timetable-import-preview`, `/onboarding`, and `/onboarding-manual` use feature code outside `src/app`. Import creates subjects/types and a timetable version in one validated transaction. Persistent settings now include bounded `onboardingDraft` and `timetableImportDraft`; `onboardingVersion >= 1` permanently dismisses setup after Skip/Done. No schema migration was required.

**Session 3 schema update:** subject color, slot teacher and stable lineage, and superseded timetable versions are added by migration 0001. Only active versions participate in interval selection. Superseded ranges and slots retain frozen attendance references; whole-semester edits change the schedule while records remain authoritative. The schema block below reflects the current implementation.

**Session 4 schema update:** migration 0002 adds `class_notes` and slot lookup indexes. Daily Log retains holiday classes as visible neutral rows; the earlier suppression rules below continue to describe forecast capacity. Notes use stable occurrence lineage independently of attendance. The current schema has 19 tables.

**Subject-detail implementation update (12 October 2026):** Topics, Notes, Deadlines, Marks, Links and Timer now use subject-scoped SQLite queries and transactional commands in `subject-content.ts` and `study-timer.ts`. Editors share `/subject-content-editor`; note reading uses `/subject-note`. Migration 0003 adds topic `important` and expands deadline categories while retaining legacy `exam`. Subjects cards query topic-weighted syllabus completion and reuse the existing seven-day deadline chip. Commands enforce parent scope, archived read-only state, revisions, foreign keys and guarded Undo without loading the attendance ledger.

Notes store a plain-text formatting subset (`**bold**`, `- bullet`, `- [ ] checklist`) rendered in Preview and the reader; editing existing text never requires conversion. Date/time inputs resolve against the semester timezone, reject nonexistent DST times, and choose the earlier occurrence for newly selected repeated times. Unchanged deadline date/time retains its exact original instant. Marks totals are the sum of graded earned marks divided by their summed maxima; existing weight fields remain stored.

Study timers have one global running/paused session. `activeSeconds` stores checkpointed focus; `phaseStartedAt` and `checkpointAt` recover the current phase from wall-clock timestamps after backgrounding or relaunch. Credit is capped at the current phase boundary; the user starts each next phase explicitly. Breaks and pauses never add focus. Backward clock changes require Pause then Resume. Completed sessions contribute to Monday–Sunday totals by their start date in the semester timezone; discarded and active sessions are excluded. Durations default to 25/5 and reuse the most recent session's settings. No background JavaScript or timer notification scheduling is required.

**History, planner and semester implementation update (12 October 2026):** Subject History uses month-scoped frozen occurrence resolution plus a cumulative ledger trend; its `/attendance-day` link explicitly carries semester, subject and date through Daily Log and its editors. `attendance/insights.ts` provides pure schedule expansion and independent attend/skip scenarios over actual upcoming sessions and their weights, with an explicit semester-local clock. Today’s already-recorded occurrences are excluded from the UI forecast. Overall percentages remain the weighted ledger ratio, including archived subjects.

Settings > Semester owns names, inclusive bounds, global target, named holiday ranges, new-semester setup, full typed-RESET deletion and read-only archived history. `semester-commands.ts` commits lifecycle changes atomically, protects snapshots/revisions and refuses new-semester archival with an active timer. A new semester optionally copies active subjects and the currently effective weekly timetable with new IDs; saved attendance, study content, extras and holidays stay in the archived semester. Generic writes reject changes to any archived semester snapshot. Historical routes never change the active semester. No schema migration is needed.

A semester backup is a strict, versioned JSON row inventory plus ready attachment bytes, capped at 50 MiB of attachment content; export and recovery verify size and SHA-256. Recovery adds the original deleted semester as read-only history and never replaces existing IDs. This scoped restore supersedes the proposed whole-dataset replacement below for this implementation. Reset removes all data belonging to its semester, keeps other semesters/preferences and restarts setup. Lifecycle operations serialize with the attachment queue and settle deferred deletes/imports first. A durable file cleanup manifest is written before reset/restore; bootstrap deletes only paths with no surviving database reference, so rollback preserves original bytes and interrupted cleanup resumes safely.

## Authority and scope

**Session 2 implementation note:** SPEC is now present. The approved foundation uses `src/app/` and NativeTabs **Subjects, Daily Log, Timetable, Settings**, superseding the proposed navigation inventory below. The documented 18-table schema and formulas are implemented; other feature screens and external services remain proposals outside this session. SPEC excludes paid APIs, AI calls, analytics, and ads. See `PROGRESS.md` for verified implementation scope.

`AGENTS.md` and `/Users/mayank/.codex/RTK.md` were read fully. `docs/SPEC.md` was absent when these documents were prepared. This architecture covers every feature named in the planning request and a proposed supporting screen inventory; it cannot certify coverage of an unavailable SPEC. Decisions marked **proposed** must be reconciled with that document in Session 2. No application code, dependency manifests, native directories, or configuration are changed by this plan. The schema below is a complete proposed schema inside documentation, not an installed migration.

## System boundaries

- **Local first:** SQLite is the durable source of truth. Drizzle repositories own persistence; pure domain functions own attendance, schedule expansion, projections, and study statistics. Screens do not calculate independent versions of these values.
- **Offline core:** scheduling, attendance, subjects, notes, marks, deadlines, files already copied locally, study sessions, and insights work without an account or network. AI import and optional account services expose explicit offline/error states.
- **Commands and queries:** a feature command validates its whole change, writes one transaction, then invalidates affected queries and notification schedules. Do not optimistically dismiss editors before persistence succeeds.
- **AI boundary:** a server adapter owns provider credentials, validation, request limits, and uploaded-content retention. AI produces a draft; only user-reviewed rows enter academic tables. No provider secret ships in the app. Backend deployment is a separate deliverable from the static Expo web export.
- **Files boundary:** SQLite stores metadata and relative paths; the app document directory stores bytes. Use staged copies and recovery manifests to reconcile file operations with DB transactions. OS picker URIs are not durable attachment storage.
- **Optional accounts:** Session 11 is gated. Local-only release remains valid. Auth, cloud backup, and multi-device sync are distinct features; unrestricted sync requires a separate conflict/tombstone design and is not implied by login.

## Proposed folder structure

```text
docs/
  ARCHITECTURE.md
  DESIGN.md
  ROADMAP.md
  PROGRESS.md
src/
  app/                          # Route screens and navigator layouts only
    _layout.tsx                 # Root Stack; bootstrap/loading/migration boundary
    (tabs)/
      _layout.tsx               # NativeTabs: Today, Subjects, Files, Insights
      index.tsx
      subjects.tsx
      files.tsx
      insights.tsx
    subjects/[subjectId]/
      index.tsx                 # Subject detail with in-screen segments
      notes/[noteId].tsx
    timetable/index.tsx
    daily-log/[date].tsx
    files/folders/[folderId].tsx
    files/[fileId].tsx
    study/index.tsx
    study/session/[sessionId].tsx
    deadlines/index.tsx
    semesters/index.tsx
    semesters/[semesterId].tsx
    settings/index.tsx
    settings/notifications.tsx
    settings/backup.tsx
    settings/appearance.tsx
    settings/privacy.tsx
    onboarding/_layout.tsx
    onboarding/index.tsx
    onboarding/semester.tsx
    onboarding/subjects.tsx
    onboarding/timetable.tsx
    onboarding/review.tsx
    import/_layout.tsx
    import/index.tsx
    import/review.tsx
    account/index.tsx
    account/sign-in.tsx
    account/manage.tsx
    (sheets)/                   # Registered as root Stack formSheet routes
      subject-editor.tsx
      class-type-editor.tsx
      timetable-version.tsx
      timetable-slot.tsx
      extra-class.tsx
      holiday.tsx
      attendance.tsx
      adjustment.tsx
      attendance-history.tsx
      target.tsx
      unit-editor.tsx
      topic-editor.tsx
      note-editor.tsx
      deadline-editor.tsx
      marks-editor.tsx
      link-editor.tsx
      folder-editor.tsx
      file-import.tsx
      file-move.tsx
      file-details.tsx
      study-setup.tsx
      study-summary.tsx
      semester-editor.tsx
      semester-switcher.tsx
      backup-restore.tsx
  components/
    ui/                         # Shared native controls and accessible states
    attendance/
    timetable/
    subjects/
    files/
    study/
    charts/
  features/
    attendance/                 # Queries, commands, view models
    timetable/
    subjects/
    import/
    files/
    study/
    insights/
    semesters/
    settings/
    onboarding/
    accounts/
  domain/
    attendance.ts               # Exact arithmetic; no UI or database imports
    calendar.ts                 # Local date/week arithmetic
    schedule.ts                 # Versions, parity, holidays, extras
    projections.ts
    study.ts
  db/
    schema.ts                   # Future implementation of documented schema
    client.ts
    migrations/
    repositories/
  services/
    ai-import/
    attachments/
    notifications/
    backup/
    accounts/
  hooks/
  theme/                        # Colors, typography, spacing, motion, surfaces
  constants/
  types/
  utils/
tests/
  domain/
  db/
  integration/
assets/
```

Preserve and migrate the starter deliberately in Session 2; this tree is a target, not a request to restructure it now. Keep platform-specific components outside `src/app/`. Use `@/*` aliases already configured. All navigation uses Expo Router (`Link`, `router`, `useLocalSearchParams`); `_layout.tsx` owns navigators. Never hand-edit generated `ios/` or `android/` directories. npm is the current package manager (`package-lock.json`, no `bun.lock`); use `npx expo install` for SDK-compatible packages. Shell commands use the RTK prefix.

## Proposed route and presentation map

The four tab labels are an assumption because the SPEC is missing. Root tab routes stay mounted; root Stack pushes details above tabs. Subject sections are segments, not extra tabs. Native headers and platform back behavior own hierarchy. The root Stack owns route-based form sheets; `@expo/ui` owns small local action menus and pickers. Do not present both mechanisms for the same editor.

| Route | Screen / entry point | Presentation and return |
|---|---|---|
| `/` | Today; default NativeTab | Tab, preserve selected day |
| `/subjects` | Subjects NativeTab | Tab, preserve search/filter |
| `/files` | Files NativeTab | Tab, preserve scope and sort |
| `/insights` | Insights NativeTab | Tab, preserve range |
| `/subjects/[subjectId]` | Overview, Attendance, Syllabus, Notes, Deadlines, Marks, Links, Files, Study segments | Push from Today/Subjects/Insights; return to caller |
| `/subjects/[subjectId]/notes/[noteId]` | Full note reader | Push; edit opens note sheet |
| `/timetable` | Week timetable and version history | Push from Today |
| `/daily-log/[date]` | Historical day log/calendar selection | Push from Today/Insights; ISO local date |
| `/files/folders/[folderId]` | Folder contents | Push from Files or subject Files segment |
| `/files/[fileId]` | File preview | Push; unsupported MIME uses OS open/share |
| `/study` | Study overview/history | Push from Today or subject Study |
| `/study/session/[sessionId]` | Active timer | Full screen push; returning does not terminate timer |
| `/deadlines` | All deadlines | Push from Today/Insights |
| `/semesters` | Semester list | Push from Settings/Insights |
| `/semesters/[semesterId]` | Semester summary/archive | Push; archived data remains readable |
| `/settings` | Settings hub | Push from header action |
| `/settings/notifications` | Reminder rules and permissions | Push |
| `/settings/backup` | Backup/export/import | Push |
| `/settings/appearance` | Theme, haptics, accessibility preferences | Push |
| `/settings/privacy` | AI disclosure, local data, account privacy | Push |
| `/onboarding`, `/onboarding/semester`, `/onboarding/subjects`, `/onboarding/timetable`, `/onboarding/review` | Setup flow | Full-screen root flow; resumable draft; commit on review |
| `/import`, `/import/review` | AI source selection/progress and correction/review | Modal Stack; close preserves draft; atomic commit |
| `/account`, `/account/sign-in`, `/account/manage` | Optional account status, auth, management | Push; auth callback returns to originating screen |

All IDs are validated against the active or explicitly selected semester. Invalid/deleted IDs show a recoverable unavailable state. Links to archived semesters must not silently change the active semester. Direct links into sheets anchor to the relevant detail or tab; dismiss returns to that anchor. Dates in route parameters use `YYYY-MM-DD`, never locale display strings.

### Every proposed sheet and local modal

| Root sheet route | Fields/actions | Entry / sizing |
|---|---|---|
| `/subject-editor` | Name, code, teacher, credits, icon, archive | Subjects/detail; full form |
| `/class-type-editor` | Name, default countsAs, active/archive | Timetable/settings; compact form |
| `/timetable-version` | Effective date, clone prior slots, label, change preview | Timetable; full form |
| `/timetable-slot` | Subject, class type, weekday, parity, time, room, countsAs | Timetable; full form |
| `/extra-class` | Subject/type/date/time/weight, allow on holiday | Today/timetable; full form |
| `/holiday` | Inclusive date range, optional subject scope, reason | Calendar/timetable; compact form |
| `/attendance` | Present/absent/neutral, snapshot, note, reset to unmarked | Class row; compact/full accessible detents |
| `/adjustment` | Signed attended/held deltas, date, reason, before/after preview | Subject attendance; full form |
| `/attendance-history` | Ledger rows, corrections, filters | Subject attendance; full list |
| `/target` | Semester default or subject override, 0–100% | Subject/semester/settings; compact form |
| `/unit-editor`, `/topic-editor` | Title/order; topic unit and completion | Subject syllabus; compact form |
| `/note-editor` | Title/body, optional unit/topic | Notes/reader; full editor |
| `/deadline-editor` | Title/type, due time, reminder, completed | Deadlines/subject; full form |
| `/marks-editor` | Assessment, earned/max, optional weight | Subject marks; compact form |
| `/link-editor` | Title, URL, label | Subject links; compact form |
| `/folder-editor` | Name, parent, subject scope | Files; compact form |
| `/file-import` | Source picker, destination, progress, retry | Files/subject; full form |
| `/file-move` | Destination tree, validation | File actions; full list |
| `/file-details` | MIME, size, source, rename, share, delete | Preview/context menu; compact form |
| `/study-setup` | Subject/topic, focus/break durations | Study/subject; compact form |
| `/study-summary` | Active time, interruptions, note, save/discard | Completed timer; compact form |
| `/semester-editor` | Name, dates, timezone, week anchor, target | Setup/semesters; full form |
| `/semester-switcher` | Semester list and create action | Semester header; compact list |
| `/backup-restore` | Manifest, compatibility, counts, replace preview | Backup; full review |

Local native presentations: date/time pickers, subject/type/semester selectors, parity selector, sort/filter menus, attachment source picker, file actions, delete/archive confirmations, discard-draft confirmation, reset-attendance confirmation, mark-day batch preview, notification permission rationale/system prompt, AI upload consent, import cancellation, restore replacement confirmation, semester archive confirmation, sign-out/account-deletion confirmation (optional). These are component states, not additional routes. System document/image pickers, share sheet, notification permissions, and auth browser are OS presentations. Deletion and restore are confirmed only after a concrete impact preview. Match this entire list against the SPEC when supplied.

## Persistence contract

- UUID text IDs are generated by the application; timestamps are UTC epoch milliseconds supplied on writes. ISO local dates and minutes since midnight express academic calendar time in the semester's fixed IANA timezone. Dates must pass real calendar validation, not just string length.
- Target values are integer basis points: 7500 = 75%, 1 = 0.01%, 10000 = 100%. Weight (`countsAs`) is a positive integer of attendance units. Credits and marks are separate from attendance weights.
- Enable `PRAGMA foreign_keys = ON` for every connection before migrations; use WAL and transactions. Apply generated, reviewed migrations before exposing repositories. Back up before destructive migrations; never wipe a failed migration automatically. Foreign keys below default to restrictive deletion; archive referenced academic entities.
- All mutable rows carry `revision` for stale-editor detection. Writes use an expected revision and increment it in the transaction. UUIDs/revisions support a future sync design but do not constitute sync.
- SQL CHECKs validate row-local invariants. Cross-row and interval rules listed after the schema must run inside serialized write transactions and be covered by DB integration tests. TypeScript enum annotations alone do not enforce valid SQLite values.

## Full proposed Drizzle schema

The single TypeScript block below is the proposed future `src/db/schema.ts`. It defines all 18 requested tables, concrete columns, indexes, foreign keys, uniqueness constraints, and row checks. It is planning content only; Drizzle is not installed in this session.

```ts
import { sql } from 'drizzle-orm';
import {
  sqliteTable, text, integer, real, index, uniqueIndex, check,
  foreignKey, type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

const meta = () => ({
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  revision: integer('revision').notNull().default(1),
});

export const semesters = sqliteTable('semesters', {
  ...meta(), name: text('name').notNull(),
  startsOn: text('starts_on').notNull(), endsOn: text('ends_on').notNull(),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  weekAnchor: text('week_anchor').notNull(),
  targetBps: integer('target_bps').notNull().default(7500),
  archivedAt: integer('archived_at'),
}, t => [
  index('semesters_dates_idx').on(t.startsOn, t.endsOn),
  index('semesters_archive_idx').on(t.archivedAt),
  check('semester_dates_ck', sql`${t.startsOn} <= ${t.endsOn}`),
  check('semester_target_ck', sql`${t.targetBps} BETWEEN 0 AND 10000`),
]);

export const subjects = sqliteTable('subjects', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  name: text('name').notNull(), normalizedName: text('normalized_name').notNull(),
  code: text('code'), teacher: text('teacher'), icon: text('icon'),
  color: text('color').notNull().default('#4144D8'),
  credits: real('credits'), targetBps: integer('target_bps'),
  sortOrder: integer('sort_order').notNull().default(0), archivedAt: integer('archived_at'),
}, t => [
  uniqueIndex('subjects_sem_name_uq').on(t.semesterId, t.normalizedName),
  uniqueIndex('subjects_id_sem_uq').on(t.id, t.semesterId),
  index('subjects_sem_order_idx').on(t.semesterId, t.archivedAt, t.sortOrder),
  check('subject_target_ck', sql`${t.targetBps} IS NULL OR ${t.targetBps} BETWEEN 0 AND 10000`),
  check('subject_credits_ck', sql`${t.credits} IS NULL OR ${t.credits} >= 0`),
]);

export const classTypes = sqliteTable('class_types', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  name: text('name').notNull(), normalizedName: text('normalized_name').notNull(),
  defaultCountsAs: integer('default_counts_as').notNull().default(1),
  archivedAt: integer('archived_at'),
}, t => [
  uniqueIndex('types_sem_name_uq').on(t.semesterId, t.normalizedName),
  uniqueIndex('types_id_sem_uq').on(t.id, t.semesterId),
  check('types_weight_ck', sql`${t.defaultCountsAs} > 0`),
]);

export const timetableVersions = sqliteTable('timetable_versions', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  label: text('label').notNull(), effectiveFrom: text('effective_from').notNull(),
  effectiveUntil: text('effective_until'), // exclusive; null = through semester end
  supersededAt: integer('superseded_at'), // retained for frozen attendance references
}, t => [
  uniqueIndex('versions_sem_start_uq').on(t.semesterId, t.effectiveFrom).where(sql`${t.supersededAt} IS NULL`),
  uniqueIndex('versions_id_sem_uq').on(t.id, t.semesterId),
  index('versions_lookup_idx').on(t.semesterId, t.effectiveFrom, t.effectiveUntil),
  check('versions_range_ck', sql`${t.effectiveUntil} IS NULL OR ${t.effectiveUntil} > ${t.effectiveFrom}`),
]);

export const timetableSlots = sqliteTable('timetable_slots', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  versionId: text('version_id').notNull(), subjectId: text('subject_id').notNull(),
  classTypeId: text('class_type_id').notNull(),
  weekday: integer('weekday').notNull(), // Monday=1 ... Sunday=7
  parity: text('parity', { enum: ['all', 'odd', 'even'] }).notNull().default('all'),
  startMinute: integer('start_minute').notNull(), endMinute: integer('end_minute').notNull(),
  room: text('room'), teacher: text('teacher'),
  lineageId: text('lineage_id'), // original slot ID, stable through version clones
  countsAs: integer('counts_as').notNull().default(1),
}, t => [
  foreignKey({ columns: [t.versionId, t.semesterId], foreignColumns: [timetableVersions.id, timetableVersions.semesterId] }),
  foreignKey({ columns: [t.subjectId, t.semesterId], foreignColumns: [subjects.id, subjects.semesterId] }),
  foreignKey({ columns: [t.classTypeId, t.semesterId], foreignColumns: [classTypes.id, classTypes.semesterId] }),
  uniqueIndex('slots_id_subject_sem_uq').on(t.id, t.subjectId, t.semesterId),
  uniqueIndex('slots_exact_uq').on(t.versionId, t.subjectId, t.classTypeId, t.weekday, t.parity, t.startMinute, t.endMinute),
  index('slots_sem_idx').on(t.semesterId),
  index('slots_lineage_idx').on(t.semesterId, t.lineageId),
  index('slots_week_idx').on(t.versionId, t.weekday, t.startMinute),
  index('slots_subject_idx').on(t.subjectId),
  index('slots_type_idx').on(t.classTypeId),
  check('slots_day_ck', sql`${t.weekday} BETWEEN 1 AND 7`),
  check('slots_parity_ck', sql`${t.parity} IN ('all','odd','even')`),
  check('slots_time_ck', sql`${t.startMinute} >= 0 AND ${t.startMinute} < ${t.endMinute} AND ${t.endMinute} <= 1440`),
  check('slots_weight_ck', sql`${t.countsAs} > 0`),
]);

export const extraClasses = sqliteTable('extra_classes', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  subjectId: text('subject_id').notNull(), classTypeId: text('class_type_id').notNull(),
  onDate: text('on_date').notNull(), startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(), room: text('room'),
  countsAs: integer('counts_as').notNull().default(1),
  allowOnHoliday: integer('allow_on_holiday', { mode: 'boolean' }).notNull().default(false),
  cancelledAt: integer('cancelled_at'),
}, t => [
  foreignKey({ columns: [t.subjectId, t.semesterId], foreignColumns: [subjects.id, subjects.semesterId] }),
  foreignKey({ columns: [t.classTypeId, t.semesterId], foreignColumns: [classTypes.id, classTypes.semesterId] }),
  uniqueIndex('extras_id_subject_sem_uq').on(t.id, t.subjectId, t.semesterId),
  index('extras_day_idx').on(t.semesterId, t.onDate, t.startMinute),
  index('extras_subject_idx').on(t.subjectId, t.onDate),
  index('extras_type_idx').on(t.classTypeId),
  check('extras_time_ck', sql`${t.startMinute} >= 0 AND ${t.startMinute} < ${t.endMinute} AND ${t.endMinute} <= 1440`),
  check('extras_weight_ck', sql`${t.countsAs} > 0`),
  check('extras_override_ck', sql`${t.allowOnHoliday} IN (0,1)`),
]);

export const holidays = sqliteTable('holidays', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  subjectId: text('subject_id'), // null = whole semester
  startsOn: text('starts_on').notNull(), endsOn: text('ends_on').notNull(),
  title: text('title').notNull(),
}, t => [
  foreignKey({ columns: [t.subjectId, t.semesterId], foreignColumns: [subjects.id, subjects.semesterId] }),
  index('holidays_range_idx').on(t.semesterId, t.startsOn, t.endsOn),
  index('holidays_subject_idx').on(t.subjectId, t.startsOn),
  check('holidays_dates_ck', sql`${t.startsOn} <= ${t.endsOn}`),
]);

export const attendanceRecords = sqliteTable('attendance_records', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  subjectId: text('subject_id').notNull(), onDate: text('on_date').notNull(),
  kind: text('kind', { enum: ['occurrence', 'adjustment'] }).notNull(),
  occurrenceKey: text('occurrence_key'), // slot:<id>:<date> or extra:<id>
  slotId: text('slot_id'), extraClassId: text('extra_class_id'),
  classTypeId: text('class_type_id'), classTypeName: text('class_type_name'),
  startMinute: integer('start_minute'), endMinute: integer('end_minute'), room: text('room'),
  countsAs: integer('counts_as'), // frozen snapshot; null on adjustments
  status: text('status', { enum: ['present', 'absent', 'neutral'] }),
  attendedDelta: integer('attended_delta').notNull(), heldDelta: integer('held_delta').notNull(),
  reason: text('reason'),
  source: text('source', { enum: ['manual', 'import'] }).notNull().default('manual'),
}, t => [
  foreignKey({ columns: [t.subjectId, t.semesterId], foreignColumns: [subjects.id, subjects.semesterId] }),
  foreignKey({ columns: [t.slotId, t.subjectId, t.semesterId], foreignColumns: [timetableSlots.id, timetableSlots.subjectId, timetableSlots.semesterId] }),
  foreignKey({ columns: [t.extraClassId, t.subjectId, t.semesterId], foreignColumns: [extraClasses.id, extraClasses.subjectId, extraClasses.semesterId] }),
  foreignKey({ columns: [t.classTypeId, t.semesterId], foreignColumns: [classTypes.id, classTypes.semesterId] }),
  uniqueIndex('attendance_occurrence_uq').on(t.occurrenceKey),
  index('attendance_subject_date_idx').on(t.subjectId, t.onDate, t.createdAt, t.id),
  index('attendance_sem_day_idx').on(t.semesterId, t.onDate),
  index('attendance_slot_idx').on(t.slotId), index('attendance_extra_idx').on(t.extraClassId),
  index('attendance_type_idx').on(t.classTypeId),
  check('attendance_source_ck', sql`${t.source} IN ('manual','import')`),
  check('attendance_shape_ck', sql`(
    ${t.kind} = 'occurrence' AND ${t.occurrenceKey} IS NOT NULL
    AND ((${t.slotId} IS NOT NULL AND ${t.extraClassId} IS NULL)
      OR (${t.slotId} IS NULL AND ${t.extraClassId} IS NOT NULL))
    AND ${t.classTypeId} IS NOT NULL AND ${t.classTypeName} IS NOT NULL
    AND ${t.startMinute} IS NOT NULL AND ${t.endMinute} IS NOT NULL
    AND ${t.startMinute} >= 0 AND ${t.startMinute} < ${t.endMinute} AND ${t.endMinute} <= 1440
    AND ${t.countsAs} IS NOT NULL AND ${t.countsAs} > 0
    AND ${t.status} IS NOT NULL AND (
      (${t.status} = 'present' AND ${t.attendedDelta} = ${t.countsAs} AND ${t.heldDelta} = ${t.countsAs}) OR
      (${t.status} = 'absent' AND ${t.attendedDelta} = 0 AND ${t.heldDelta} = ${t.countsAs}) OR
      (${t.status} = 'neutral' AND ${t.attendedDelta} = 0 AND ${t.heldDelta} = 0)
    )
  ) OR (
    ${t.kind} = 'adjustment' AND ${t.occurrenceKey} IS NULL
    AND ${t.slotId} IS NULL AND ${t.extraClassId} IS NULL AND ${t.classTypeId} IS NULL
    AND ${t.classTypeName} IS NULL AND ${t.startMinute} IS NULL AND ${t.endMinute} IS NULL
    AND ${t.room} IS NULL AND ${t.countsAs} IS NULL AND ${t.status} IS NULL
    AND ${t.reason} IS NOT NULL AND length(trim(${t.reason})) > 0
    AND (${t.attendedDelta} != 0 OR ${t.heldDelta} != 0)
  )`),
]);

// Notes are independent of marks; clearing attendance preserves the class note.
export const classNotes = sqliteTable('class_notes', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  subjectId: text('subject_id').notNull(), onDate: text('on_date').notNull(),
  occurrenceKey: text('occurrence_key').notNull(), body: text('body').notNull(),
}, t => [
  foreignKey({ columns: [t.subjectId, t.semesterId], foreignColumns: [subjects.id, subjects.semesterId] }),
  uniqueIndex('class_notes_occurrence_uq').on(t.occurrenceKey),
  index('class_notes_sem_day_idx').on(t.semesterId, t.onDate),
]);

export const units = sqliteTable('units', {
  ...meta(), subjectId: text('subject_id').notNull().references(() => subjects.id),
  title: text('title').notNull(), sortOrder: integer('sort_order').notNull().default(0),
}, t => [
  uniqueIndex('units_id_subject_uq').on(t.id, t.subjectId),
  index('units_subject_order_idx').on(t.subjectId, t.sortOrder),
]);

export const topics = sqliteTable('topics', {
  ...meta(), subjectId: text('subject_id').notNull().references(() => subjects.id),
  unitId: text('unit_id').notNull(), title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0), completedAt: integer('completed_at'),
  important: integer('important', { mode: 'boolean' }).notNull().default(false),
}, t => [
  foreignKey({ columns: [t.unitId, t.subjectId], foreignColumns: [units.id, units.subjectId] }),
  uniqueIndex('topics_id_subject_uq').on(t.id, t.subjectId),
  index('topics_unit_order_idx').on(t.unitId, t.sortOrder),
  index('topics_subject_done_idx').on(t.subjectId, t.completedAt),
  check('topics_important_ck', sql`${t.important} IN (0,1)`),
]);

export const notes = sqliteTable('notes', {
  ...meta(), subjectId: text('subject_id').notNull().references(() => subjects.id),
  unitId: text('unit_id'), topicId: text('topic_id'), title: text('title').notNull(),
  body: text('body').notNull().default(''), pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
}, t => [
  foreignKey({ columns: [t.unitId, t.subjectId], foreignColumns: [units.id, units.subjectId] }),
  foreignKey({ columns: [t.topicId, t.subjectId], foreignColumns: [topics.id, topics.subjectId] }),
  index('notes_subject_idx').on(t.subjectId, t.pinned, t.updatedAt),
  index('notes_unit_idx').on(t.unitId), index('notes_topic_idx').on(t.topicId),
  check('notes_pin_ck', sql`${t.pinned} IN (0,1)`),
]);

export const deadlines = sqliteTable('deadlines', {
  ...meta(), subjectId: text('subject_id').notNull().references(() => subjects.id),
  title: text('title').notNull(), description: text('description'),
  category: text('category', { enum: ['assignment', 'quiz', 'mid-sem', 'end-sem', 'exam', 'other'] }).notNull().default('assignment'),
  dueAt: integer('due_at').notNull(), completedAt: integer('completed_at'),
  reminderMinutes: integer('reminder_minutes'), notificationId: text('notification_id'),
}, t => [
  index('deadlines_subject_due_idx').on(t.subjectId, t.dueAt),
  index('deadlines_due_open_idx').on(t.completedAt, t.dueAt),
  check('deadlines_type_ck', sql`${t.category} IN ('assignment','quiz','mid-sem','end-sem','exam','other')`),
  check('deadlines_reminder_ck', sql`${t.reminderMinutes} IS NULL OR ${t.reminderMinutes} >= 0`),
]);

export const marks = sqliteTable('marks', {
  ...meta(), subjectId: text('subject_id').notNull().references(() => subjects.id),
  title: text('title').notNull(), onDate: text('on_date'),
  earned: real('earned'), maximum: real('maximum').notNull(), weightBps: integer('weight_bps'),
  note: text('note'),
}, t => [
  index('marks_subject_date_idx').on(t.subjectId, t.onDate),
  check('marks_max_ck', sql`${t.maximum} > 0`),
  check('marks_earned_ck', sql`${t.earned} IS NULL OR (${t.earned} >= 0 AND ${t.earned} <= ${t.maximum})`),
  check('marks_weight_ck', sql`${t.weightBps} IS NULL OR ${t.weightBps} BETWEEN 0 AND 10000`),
]);

export const links = sqliteTable('links', {
  ...meta(), subjectId: text('subject_id').notNull().references(() => subjects.id),
  title: text('title').notNull(), url: text('url').notNull(), label: text('label'),
  sortOrder: integer('sort_order').notNull().default(0),
}, t => [index('links_subject_order_idx').on(t.subjectId, t.sortOrder)]);

export const folders = sqliteTable('folders', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  subjectId: text('subject_id'), parentId: text('parent_id').references((): AnySQLiteColumn => folders.id),
  name: text('name').notNull(), normalizedName: text('normalized_name').notNull(),
}, t => [
  foreignKey({ columns: [t.subjectId, t.semesterId], foreignColumns: [subjects.id, subjects.semesterId] }),
  uniqueIndex('folders_id_sem_uq').on(t.id, t.semesterId),
  // Expression keys make NULL roots/scopes participate in uniqueness.
  uniqueIndex('folders_sibling_uq').on(t.semesterId, sql`coalesce(${t.subjectId}, '')`, sql`coalesce(${t.parentId}, '')`, t.normalizedName),
  index('folders_parent_idx').on(t.parentId), index('folders_subject_idx').on(t.subjectId),
  check('folders_self_ck', sql`${t.parentId} IS NULL OR ${t.parentId} != ${t.id}`),
]);

export const files = sqliteTable('files', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  subjectId: text('subject_id'), folderId: text('folder_id'),
  name: text('name').notNull(), mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(), sha256: text('sha256').notNull(),
  relativePath: text('relative_path').notNull(), sourceName: text('source_name'),
  state: text('state', { enum: ['staged', 'ready', 'missing', 'error'] }).notNull().default('staged'),
}, t => [
  foreignKey({ columns: [t.subjectId, t.semesterId], foreignColumns: [subjects.id, subjects.semesterId] }),
  foreignKey({ columns: [t.folderId, t.semesterId], foreignColumns: [folders.id, folders.semesterId] }),
  uniqueIndex('files_path_uq').on(t.relativePath),
  index('files_folder_idx').on(t.folderId, t.name),
  index('files_scope_idx').on(t.semesterId, t.subjectId, t.updatedAt),
  index('files_hash_idx').on(t.sha256),
  check('files_size_ck', sql`${t.sizeBytes} >= 0`),
  check('files_state_ck', sql`${t.state} IN ('staged','ready','missing','error')`),
]);

export const studySessions = sqliteTable('study_sessions', {
  ...meta(), semesterId: text('semester_id').notNull().references(() => semesters.id),
  subjectId: text('subject_id'), topicId: text('topic_id'),
  startedAt: integer('started_at').notNull(), endedAt: integer('ended_at'),
  state: text('state', { enum: ['running', 'paused', 'completed', 'discarded'] }).notNull(),
  plannedFocusSeconds: integer('planned_focus_seconds').notNull(),
  plannedBreakSeconds: integer('planned_break_seconds').notNull().default(300),
  activeSeconds: integer('active_seconds').notNull().default(0),
  phase: text('phase', { enum: ['focus', 'break'] }).notNull().default('focus'),
  phaseStartedAt: integer('phase_started_at'), checkpointAt: integer('checkpoint_at').notNull(),
  note: text('note'),
}, t => [
  foreignKey({ columns: [t.subjectId, t.semesterId], foreignColumns: [subjects.id, subjects.semesterId] }),
  foreignKey({ columns: [t.topicId, t.subjectId], foreignColumns: [topics.id, topics.subjectId] }),
  index('study_sem_start_idx').on(t.semesterId, t.startedAt),
  index('study_subject_idx').on(t.subjectId, t.startedAt), index('study_topic_idx').on(t.topicId),
  uniqueIndex('study_one_active_uq').on(sql`1`).where(sql`${t.state} IN ('running','paused')`),
  check('study_state_ck', sql`${t.state} IN ('running','paused','completed','discarded')`),
  check('study_phase_ck', sql`${t.phase} IN ('focus','break')`),
  check('study_topic_scope_ck', sql`${t.topicId} IS NULL OR ${t.subjectId} IS NOT NULL`),
  check('study_seconds_ck', sql`${t.plannedFocusSeconds} > 0 AND ${t.plannedBreakSeconds} >= 0 AND ${t.activeSeconds} >= 0`),
  check('study_end_ck', sql`(${t.state} IN ('running','paused') AND ${t.endedAt} IS NULL)
    OR (${t.state} IN ('completed','discarded') AND ${t.endedAt} IS NOT NULL AND ${t.endedAt} >= ${t.startedAt})`),
]);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(), value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  updatedAt: integer('updated_at').notNull(), revision: integer('revision').notNull().default(1),
});
```

### Required transaction-level constraints and lifecycle rules

1. Validate UUIDs, finite numbers, nonblank labels, actual Gregorian dates, IANA timezone, and safe integer bounds. Normalize names with Unicode normalization, trimming, and a documented case fold. Do not silently clamp bad input.
2. Version intervals lie within the semester (exclusive upper bound can be end + 1 day), cannot overlap, and must be contiguous from the first configured date. A gap means “no timetable configured,” not zero classes. Changing a version splits intervals atomically; historical versions/slots with records are immutable. Reject retroactive changes that would conflict with a recorded occurrence unless the user completes an explicit correction preview.
3. Semester weekAnchor is the Monday on or before startsOn. Dates for occurrences, extras, holidays, and adjustments lie within inclusive semester bounds; no future attendance beyond local today. Historical semester changes must preserve recorded dates or be rejected with an impact preview.
4. Slot/extra overlap detection uses weekday, effective interval, parity, and times. Identical duplicates are rejected; genuine conflicting classes require an explicit conflict review. Class-type default weights are copied when creating slots/extras; later default edits do not propagate to existing rows.
5. Attendance key must equal its canonical source key. Source row/date/version/weekday/parity must match at creation. All snapshots are copied at first mark. Editing a status retains weight/time snapshots; correcting weight requires an explicit preview. Repeated taps upsert the same record, never duplicate it.
6. Validate aggregate attendance after every attendance insert/edit/reset, adjustment, bulk import, restore, and deletion: for each affected subject and each chronological ledger prefix, `0 <= A <= H`. Order is `(onDate, createdAt, id)`; use deterministic import creation order. Reject the entire transaction if any prefix fails. This prevents negative historical totals as well as invalid current totals. An opening balance adjustment must precede later negative corrections it supports. Imported historical balances can be dated at semester start.
7. Adding a holiday or cancelling an extra with marked attendance shows the affected records. Proposed default: require explicit conversion of those occurrences to neutral in the same transaction; no silent deletion or retroactive percentage change. Holiday removal leaves explicit neutral records for user review. Inherited cancellation is not a separate ledger entry.
8. Notes with both unit and topic must select the topic's actual unit. Folder parent and child must share semester and subject scope (including null); recursively reject cycles. Moving a folder must validate all descendants. Files inherit destination scope explicitly; cross-subject moves require user review and update metadata atomically.
9. Archive semesters/subjects/types rather than deleting referenced history. A hard delete requires an impact preview and explicit child-first transaction. Folder delete defaults to empty-only; attachments require a separate reviewed operation. UUIDs may not be empty (the root uniqueness index reserves empty string for null).
10. `settings` is a typed key registry validated at the service boundary: `activeSemesterId` (FK-like reference checked in the transaction), `theme` (`system|light|dark`), `hapticsEnabled`, `reduceEffects`, `onboardingVersion`, `reminderRules`, `notificationPermissionSnapshot`, `backupPreferences`, and optional `accountMetadata`. Check `activeSemesterId` on every bootstrap/restore. Tokens/passwords never live here; use SecureStore for credentials.
11. Marks reject non-finite values. Weight totals above 10000 within one subject's configured assessment set are invalid. Missing marks stay ungraded. No GPA conversion without a user-approved institutional scale.
12. SQLite metadata and filesystem writes cannot share one atomic transaction: stage bytes, hash/validate, commit staged row, promote bytes, mark ready; bootstrap reconciles interrupted states. Backup restore follows a separate validated staging database/file tree and rollback protocol.

## Canonical calendar and occurrence expansion

Use date-only arithmetic for calendar days; never add 86,400,000 milliseconds to step a local day across DST. Semester timezone remains fixed even if the device travels. A requested date outside the semester produces `outsideSemester`, zero expected occurrences, and a read-only day. For dates in range:

1. Select the one version whose `effectiveFrom <= d < effectiveUntil`, treating null upper bound as semester end + one local day.
2. `weekIndex(d) = floor(calendarDaysBetween(weekAnchor, d) / 7) + 1`. Odd means index modulo 2 = 1; even = 0. Week parity never restarts when a new version begins. It is semester-relative, not ISO week-number parity.
3. Expand slots matching weekday and parity. A normal occurrence key is `slot:<slotId>:<YYYY-MM-DD>`.
4. Suppress occurrences covered by semester-wide or matching subject holidays. Holidays combine by union, so overlaps never subtract twice.
5. Add non-cancelled extra classes on d, using `extra:<extraClassId>`. Extras ignore recurring parity/version. A holiday suppresses an extra unless `allowOnHoliday` is explicitly true. An extra adds a session; it does not replace a slot implicitly. Both count if both are held.
6. Overlay attendance by key. A recorded snapshot remains authoritative for historical logs, even if an explicit reviewed calendar correction has altered the live expansion. Merge by key so the snapshot and generated row never count twice. Cancelled/holiday-neutral rows may remain visible as excluded history.

Unmarked expected rows are not attendance ledger rows. Past unmarked classes remain pending; passing midnight does not mark them absent. Batch “mark day” presents the exact pending occurrences and weights before saving in one transaction. Schedule uncertainty and missing logs are shown alongside projections.

## Computed attendance statistics

All formulas use attendance units, not visible session count. Let a selected subject's records through local date d contribute `a_i = attendedDelta`, `h_i = heldDelta`. Include adjustment rows through d. Let `A = sum(a_i)`, `H = sum(h_i)`, `B = targetBps` (subject override if non-null, else semester target), `t = B/10000`. Invariants require integer `A,H`, `0 <= A <= H`; calculations use exact integer cross-multiplication and guarded integer division. Display rounding is never used to decide eligibility.

Default attendance display uses one decimal, with exact A/H alongside it; target input/detail supports two decimal percent precision. If a value strictly below 100% would round to 100.0%, display “<100%” instead. Eligibility and warnings always use exact totals. Show small positive values that round to zero as “<0.1%” rather than implying no attendance.

| Statistic | Definition | Empty/boundary behavior |
|---|---|---|
| Attended / held / missed | `A`, `H`, `H-A` | Zero when no ledger; adjustments are labeled separately from visible sessions |
| Percentage | `100*A/H` | If `H=0`, display “— · No counted classes”; never 0% or 100% |
| Meets target | `10000*A >= B*H`, only when `H>0` | Empty is “No data”; 0% is met after any counted class |
| Classes needed | Smallest nonnegative integer n with `(A+n)/(H+n) >= t` | Units under an all-present future assumption; see cases below |
| Can skip | Largest nonnegative integer k with `A/(H+k) >= t` | Units under an all-absent future assumption; see cases below |
| Overall percentage | `100*sum(A_s)/sum(H_s)` across all subjects in the semester | Weighted ratio, never mean of percentages; empty denominator displays “—” |
| Overall target | Semester target applied to aggregate totals | Keep separate from each subject's override; overall success does not imply every subject meets its target |

### Classes needed and skip boundaries

- For `0 < B < 10000`, `needed = max(0, ceil((B*H - 10000*A)/(10000-B)))`, except `H=0`: return 1 unit to establish a defined percentage (shown as “Attend your first class”), not 0. Use exact positive ceiling division after the max decision.
- For `B=0`, `needed=0` even with zero history; empty percentage remains undefined and the UI says “No minimum target.”
- For `B=10000`: if `H=0`, `needed=1` to establish 100%; if `A=H>0`, `needed=0`; if `A<H`, return `unreachableExactly` because any finite all-present sequence remains below 100%. A rounded 100.0% does not change that result.
- For `0<B<=10000` with `H>0`, `canSkip = max(0, floor((10000*A - B*H)/B))`. If already below target, return 0 with a below-target reason. For `H=0` and a positive target, return 0 with “No history yet”; do not advertise a skip allowance.
- For `B=0`, skip allowance is unbounded by percentage. Show “No minimum target,” not infinity. The actionable recommendation is still capped by known future weighted occurrences.
- Needed and skip results are **weighted units**. A lab with `countsAs=2` is one session and two units. Do not promise one session per unit. For a known upcoming sequence `w1,w2,...`, find the first prefix whose cumulative weight reaches `needed`; show session count plus units. If a future absence consumes weight w, allow it only if `w <= canSkip`. A skip budget of 1 cannot cover a 2-unit lab.
- Projected term end with known remaining units R and all present: `(A+R)/(H+R)` when denominator is positive. If `needed>R`, show “Not reachable with the current timetable.” Never cap the theoretical needed result silently. Forecasts exclude holidays/cancellations, include eligible extras, and carry a “pending logs” warning.
- For a proposed selection of future missed units K and attended units P, forecast is `(A+P)/(H+P+K)`. Recompute from selected occurrences, not rounded current percentage. Adjustments are part of current totals, never future timetable capacity.

### Neutral, holidays, adjustments, and historical edits

Present weight w contributes `(w,w)`; absent contributes `(0,w)`; neutral contributes `(0,0)` and is visibly excluded. A holiday contributes no occurrence/denominator unless an explicit holiday override extra is held. “Neutral” means excluded/cancelled, not half credit. There is no implicit partial attendance; countsAs is the whole occurrence weight.

Adjustment `(deltaA,deltaH)` may be positive or negative with a mandatory reason. For example, correcting an absent unit to present is `(+1,0)`, removing a mistaken absent unit is `(0,-1)`, and opening history of 8/10 is `(+8,+10)`. Reject any adjustment/edit that makes current **or any affected historical prefix** have `A<0`, `H<0`, or `A>H`; show before/after totals and the earliest invalid date. Do not clamp totals or silently change the adjustment. Direct correction of a known occurrence is preferable to an unexplained balance adjustment.

Changing a timetable mid-semester creates a new version; earlier dates continue to resolve through the old one. Snapshot weights isolate existing attendance from class-type/slot changes. Backdating a target recomputes goal indicators, not recorded attendance. Subject archives do not remove their recorded contributions from semester overall percentage; “active subjects” filters are labeled and do not redefine the canonical semester total.

### Per-day status and precedence

Day status uses occurrence outcomes, not adjustments or the subject's cumulative target. Count only effective non-neutral outcomes after holiday/cancellation resolution. A weighted occurrence is still one row for completeness; use units for the day's percentage.

1. Outside semester → `outsideSemester`, read-only, no mark actions.
2. Timetable gap → `unconfigured`, with any explicit extras/recorded rows still visible; do not claim a complete day.
3. Any eligible expected occurrence unmarked → `pending`; include “x of y logged.” Past dates remain pending, future dates display “Upcoming.”
4. All resolved, with positive present and absent units → `mixed`.
5. Positive present units only → `present`; positive absent units only → `absent`.
6. No counted units and one or more explicit neutral outcomes → `neutral`.
7. No eligible occurrences and a semester-wide holiday applies → `holiday`.
8. Otherwise no eligible occurrences → `noClasses`.

A subject-only holiday cannot label the entire day holiday while other subjects are scheduled. A holiday with a held override extra gets that extra's outcome/pending status plus a holiday badge. Adjustment-only dates get a “Balance adjusted” badge and their ordinary calendar status; adjustments do not create a fictional class. Day percentage is present units divided by present + absent units, undefined if both are zero; display any adjustment separately from that occurrence-based day percentage.

### Other derived values

- Syllabus completion = completed topics / total topics × 100; zero topics gives “No topics,” not completed. Unit completion uses its topics; no topics yields undefined. Counts are topic-weighted, not a mean of unit percentages.
- Unweighted marks = sum graded earned / sum corresponding maxima × 100. Exclude `earned=null`. Weighted marks = `sum((earned/max)*weight)/sum(graded weights)` only in explicitly weighted mode with valid non-null weights; label partial grading/coverage. Do not mix weighted and unweighted rows silently. No graded rows means undefined.
- Overdue deadline = incomplete and `dueAt < now`; equality is due now. Group display dates in semester timezone; store precise instants. Completed items do not generate reminders.
- Study minutes = completed sessions' active focus seconds / 60; exclude breaks, paused time, and discarded sessions. Accumulate focus intervals at checkpoints, persist on pause/background, and restore from phase timestamps. Do not depend on JS timers continuing in the background. A restored uncertain interval requests confirmation rather than inventing studied time. Daily attribution splits intervals at semester-timezone midnight; implementation must store interval checkpoints (a validated JSON interval log in a future schema migration if cross-midnight detail is required) or explicitly attribute to start date in v1. **Proposed v1: start-date attribution**, labeled in insights.
- File storage = sum ready local file sizes; missing/staged files shown separately. No hash-based automatic deletion of duplicates; offer a reviewed duplicate warning.

### Calculation acceptance examples

| Input | Expected |
|---|---|
| A=0,H=0,B=7500 | Percentage undefined; needed 1; skip 0 |
| A=6,H=8,B=7500 | 75%; needed 0; skip 0 |
| A=7,H=8,B=7500 | 87.5%; needed 0; skip 1; cannot skip a 2-unit lab |
| A=5,H=8,B=7500 | 62.5%; needed 4 units; skip 0 |
| A=8,H=10,B=10000 | 80%; exact target unreachable by finite attendance |
| A=8,H=8,B=10000 | 100%; needed 0; skip 0 |
| A=0,H=0,B=0 | Percentage undefined; needed 0; no minimum target |
| 2-unit present, 1-unit absent | A=2,H=3; 66.666…%; one of two sessions attended |
| Add neutral or holiday | A,H unchanged |
| A=1,H=2; adjustment (0,-2) | Reject because A>H |
| A=0,H=0; adjustment (-1,-1) | Reject negative totals |
| Subjects 1/1 and 0/9 | Overall 10%, not 50% |
| Monday weekAnchor; new version in week 2 | Parity remains even after version change |

## Backup, notifications, and bootstrap

Bootstrap sequence: open DB → enable constraints → run reviewed migrations → load validated settings → reconcile staged attachments → restore active study state → expose routes → reconcile reminder schedules. A migration/storage failure gets recovery UI with export/diagnostics; no onboarding overwrite.

Backup is a versioned manifest + consistent SQLite snapshot + ready attachment bytes/checksums. Include schema version, creation time, timezone, row counts, and required app version; exclude auth tokens, temporary AI uploads, and caches. Restore validates checksums, file sizes/paths, all relationships, dates, prefixes, and migrations in staging, previews replacement, then swaps with a recoverable previous copy. Reject unknown newer formats. Proposed v1 restore replaces the local dataset; merge is deferred.

Local notifications are derived from active semester schedule, deadline reminder offsets, and user rules. Reconcile on timetable/holiday/attendance/setting/deadline/timezone changes; notification IDs are delivery handles, not source data. Respect permissions, quiet hours, platform scheduling limits, stale IDs, and elapsed reminder times. Generate a bounded horizon and refresh on app open; never promise perpetual exact background scheduling. Payloads use validated routes. The study timer's saved timestamps work independently of background notifications.

## Verification and references

Session 2 must compile the documented schema against the chosen Drizzle version and execute generated migrations in fresh SQLite. Cover FK rejection, expression/partial indexes, interval overlap, chronological aggregate validation, duplicate occurrence upserts, rollback, restore, and cross-semester writes. Domain tests cover every example and edge above, DST/calendar arithmetic, parity and version boundaries. Run lint and typecheck in each implementation session.

Primary references checked for this draft:

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) and [Expo documentation index](https://docs.expo.dev/llms.txt).
- [Expo Router NativeTabs](https://docs.expo.dev/router/advanced/native-tabs/) — native tab navigation; API remains version-sensitive.
- [Expo SQLite, SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) and [Drizzle Expo SQLite adapter](https://orm.drizzle.team/docs/sqlite/connect-expo-sqlite) — persistence integration.
- [Drizzle schema declaration](https://orm.drizzle.team/docs/sql-schema-declaration) and [indexes/constraints](https://orm.drizzle.team/docs/indexes-constraints) — schema syntax reference.
