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
