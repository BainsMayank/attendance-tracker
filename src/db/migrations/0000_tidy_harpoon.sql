CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`on_date` text NOT NULL,
	`kind` text NOT NULL,
	`occurrence_key` text,
	`slot_id` text,
	`extra_class_id` text,
	`class_type_id` text,
	`class_type_name` text,
	`start_minute` integer,
	`end_minute` integer,
	`room` text,
	`counts_as` integer,
	`status` text,
	`attended_delta` integer NOT NULL,
	`held_delta` integer NOT NULL,
	`reason` text,
	`source` text DEFAULT 'manual' NOT NULL,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`,`semester_id`) REFERENCES `subjects`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`slot_id`,`subject_id`,`semester_id`) REFERENCES `timetable_slots`(`id`,`subject_id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`extra_class_id`,`subject_id`,`semester_id`) REFERENCES `extra_classes`(`id`,`subject_id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_type_id`,`semester_id`) REFERENCES `class_types`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attendance_source_ck" CHECK("attendance_records"."source" IN ('manual','import')),
	CONSTRAINT "attendance_shape_ck" CHECK((
    "attendance_records"."kind" = 'occurrence' AND "attendance_records"."occurrence_key" IS NOT NULL
    AND (("attendance_records"."slot_id" IS NOT NULL AND "attendance_records"."extra_class_id" IS NULL)
      OR ("attendance_records"."slot_id" IS NULL AND "attendance_records"."extra_class_id" IS NOT NULL))
    AND "attendance_records"."class_type_id" IS NOT NULL AND "attendance_records"."class_type_name" IS NOT NULL
    AND "attendance_records"."start_minute" IS NOT NULL AND "attendance_records"."end_minute" IS NOT NULL
    AND "attendance_records"."start_minute" >= 0 AND "attendance_records"."start_minute" < "attendance_records"."end_minute" AND "attendance_records"."end_minute" <= 1440
    AND "attendance_records"."counts_as" IS NOT NULL AND "attendance_records"."counts_as" > 0
    AND "attendance_records"."status" IS NOT NULL AND (
      ("attendance_records"."status" = 'present' AND "attendance_records"."attended_delta" = "attendance_records"."counts_as" AND "attendance_records"."held_delta" = "attendance_records"."counts_as") OR
      ("attendance_records"."status" = 'absent' AND "attendance_records"."attended_delta" = 0 AND "attendance_records"."held_delta" = "attendance_records"."counts_as") OR
      ("attendance_records"."status" = 'neutral' AND "attendance_records"."attended_delta" = 0 AND "attendance_records"."held_delta" = 0)
    )
  ) OR (
    "attendance_records"."kind" = 'adjustment' AND "attendance_records"."occurrence_key" IS NULL
    AND "attendance_records"."slot_id" IS NULL AND "attendance_records"."extra_class_id" IS NULL AND "attendance_records"."class_type_id" IS NULL
    AND "attendance_records"."class_type_name" IS NULL AND "attendance_records"."start_minute" IS NULL AND "attendance_records"."end_minute" IS NULL
    AND "attendance_records"."room" IS NULL AND "attendance_records"."counts_as" IS NULL AND "attendance_records"."status" IS NULL
    AND "attendance_records"."reason" IS NOT NULL AND length(trim("attendance_records"."reason")) > 0
    AND ("attendance_records"."attended_delta" != 0 OR "attendance_records"."held_delta" != 0)
  ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_occurrence_uq` ON `attendance_records` (`occurrence_key`);--> statement-breakpoint
CREATE INDEX `attendance_subject_date_idx` ON `attendance_records` (`subject_id`,`on_date`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `attendance_sem_day_idx` ON `attendance_records` (`semester_id`,`on_date`);--> statement-breakpoint
CREATE INDEX `attendance_slot_idx` ON `attendance_records` (`slot_id`);--> statement-breakpoint
CREATE INDEX `attendance_extra_idx` ON `attendance_records` (`extra_class_id`);--> statement-breakpoint
CREATE INDEX `attendance_type_idx` ON `attendance_records` (`class_type_id`);--> statement-breakpoint
CREATE TABLE `class_types` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`default_counts_as` integer DEFAULT 1 NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "types_weight_ck" CHECK("class_types"."default_counts_as" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `types_sem_name_uq` ON `class_types` (`semester_id`,`normalized_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `types_id_sem_uq` ON `class_types` (`id`,`semester_id`);--> statement-breakpoint
CREATE TABLE `deadlines` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`subject_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'assignment' NOT NULL,
	`due_at` integer NOT NULL,
	`completed_at` integer,
	`reminder_minutes` integer,
	`notification_id` text,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "deadlines_type_ck" CHECK("deadlines"."category" IN ('assignment','exam','other')),
	CONSTRAINT "deadlines_reminder_ck" CHECK("deadlines"."reminder_minutes" IS NULL OR "deadlines"."reminder_minutes" >= 0)
);
--> statement-breakpoint
CREATE INDEX `deadlines_subject_due_idx` ON `deadlines` (`subject_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `deadlines_due_open_idx` ON `deadlines` (`completed_at`,`due_at`);--> statement-breakpoint
CREATE TABLE `extra_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`class_type_id` text NOT NULL,
	`on_date` text NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`room` text,
	`counts_as` integer DEFAULT 1 NOT NULL,
	`allow_on_holiday` integer DEFAULT false NOT NULL,
	`cancelled_at` integer,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`,`semester_id`) REFERENCES `subjects`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_type_id`,`semester_id`) REFERENCES `class_types`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "extras_time_ck" CHECK("extra_classes"."start_minute" >= 0 AND "extra_classes"."start_minute" < "extra_classes"."end_minute" AND "extra_classes"."end_minute" <= 1440),
	CONSTRAINT "extras_weight_ck" CHECK("extra_classes"."counts_as" > 0),
	CONSTRAINT "extras_override_ck" CHECK("extra_classes"."allow_on_holiday" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `extras_id_subject_sem_uq` ON `extra_classes` (`id`,`subject_id`,`semester_id`);--> statement-breakpoint
CREATE INDEX `extras_day_idx` ON `extra_classes` (`semester_id`,`on_date`,`start_minute`);--> statement-breakpoint
CREATE INDEX `extras_subject_idx` ON `extra_classes` (`subject_id`,`on_date`);--> statement-breakpoint
CREATE INDEX `extras_type_idx` ON `extra_classes` (`class_type_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`subject_id` text,
	`folder_id` text,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`relative_path` text NOT NULL,
	`source_name` text,
	`state` text DEFAULT 'staged' NOT NULL,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`,`semester_id`) REFERENCES `subjects`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`folder_id`,`semester_id`) REFERENCES `folders`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "files_size_ck" CHECK("files"."size_bytes" >= 0),
	CONSTRAINT "files_state_ck" CHECK("files"."state" IN ('staged','ready','missing','error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_path_uq` ON `files` (`relative_path`);--> statement-breakpoint
CREATE INDEX `files_folder_idx` ON `files` (`folder_id`,`name`);--> statement-breakpoint
CREATE INDEX `files_scope_idx` ON `files` (`semester_id`,`subject_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `files_hash_idx` ON `files` (`sha256`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`subject_id` text,
	`parent_id` text,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`,`semester_id`) REFERENCES `subjects`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "folders_self_ck" CHECK("folders"."parent_id" IS NULL OR "folders"."parent_id" != "folders"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folders_id_sem_uq` ON `folders` (`id`,`semester_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `folders_sibling_uq` ON `folders` (`semester_id`,coalesce("subject_id", ''),coalesce("parent_id", ''),`normalized_name`);--> statement-breakpoint
CREATE INDEX `folders_parent_idx` ON `folders` (`parent_id`);--> statement-breakpoint
CREATE INDEX `folders_subject_idx` ON `folders` (`subject_id`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`subject_id` text,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`title` text NOT NULL,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`,`semester_id`) REFERENCES `subjects`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "holidays_dates_ck" CHECK("holidays"."starts_on" <= "holidays"."ends_on")
);
--> statement-breakpoint
CREATE INDEX `holidays_range_idx` ON `holidays` (`semester_id`,`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `holidays_subject_idx` ON `holidays` (`subject_id`,`starts_on`);--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`subject_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`label` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `links_subject_order_idx` ON `links` (`subject_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `marks` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`subject_id` text NOT NULL,
	`title` text NOT NULL,
	`on_date` text,
	`earned` real,
	`maximum` real NOT NULL,
	`weight_bps` integer,
	`note` text,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "marks_max_ck" CHECK("marks"."maximum" > 0),
	CONSTRAINT "marks_earned_ck" CHECK("marks"."earned" IS NULL OR ("marks"."earned" >= 0 AND "marks"."earned" <= "marks"."maximum")),
	CONSTRAINT "marks_weight_ck" CHECK("marks"."weight_bps" IS NULL OR "marks"."weight_bps" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE INDEX `marks_subject_date_idx` ON `marks` (`subject_id`,`on_date`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`subject_id` text NOT NULL,
	`unit_id` text,
	`topic_id` text,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`,`subject_id`) REFERENCES `units`(`id`,`subject_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`,`subject_id`) REFERENCES `topics`(`id`,`subject_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "notes_pin_ck" CHECK("notes"."pinned" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `notes_subject_idx` ON `notes` (`subject_id`,`pinned`,`updated_at`);--> statement-breakpoint
CREATE INDEX `notes_unit_idx` ON `notes` (`unit_id`);--> statement-breakpoint
CREATE INDEX `notes_topic_idx` ON `notes` (`topic_id`);--> statement-breakpoint
CREATE TABLE `semesters` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`week_anchor` text NOT NULL,
	`target_bps` integer DEFAULT 7500 NOT NULL,
	`archived_at` integer,
	CONSTRAINT "semester_dates_ck" CHECK("semesters"."starts_on" <= "semesters"."ends_on"),
	CONSTRAINT "semester_target_ck" CHECK("semesters"."target_bps" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE INDEX `semesters_dates_idx` ON `semesters` (`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `semesters_archive_idx` ON `semesters` (`archived_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`subject_id` text,
	`topic_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`state` text NOT NULL,
	`planned_focus_seconds` integer NOT NULL,
	`planned_break_seconds` integer DEFAULT 300 NOT NULL,
	`active_seconds` integer DEFAULT 0 NOT NULL,
	`phase` text DEFAULT 'focus' NOT NULL,
	`phase_started_at` integer,
	`checkpoint_at` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`,`semester_id`) REFERENCES `subjects`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`,`subject_id`) REFERENCES `topics`(`id`,`subject_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "study_state_ck" CHECK("study_sessions"."state" IN ('running','paused','completed','discarded')),
	CONSTRAINT "study_phase_ck" CHECK("study_sessions"."phase" IN ('focus','break')),
	CONSTRAINT "study_topic_scope_ck" CHECK("study_sessions"."topic_id" IS NULL OR "study_sessions"."subject_id" IS NOT NULL),
	CONSTRAINT "study_seconds_ck" CHECK("study_sessions"."planned_focus_seconds" > 0 AND "study_sessions"."planned_break_seconds" >= 0 AND "study_sessions"."active_seconds" >= 0),
	CONSTRAINT "study_end_ck" CHECK(("study_sessions"."state" IN ('running','paused') AND "study_sessions"."ended_at" IS NULL)
    OR ("study_sessions"."state" IN ('completed','discarded') AND "study_sessions"."ended_at" IS NOT NULL AND "study_sessions"."ended_at" >= "study_sessions"."started_at"))
);
--> statement-breakpoint
CREATE INDEX `study_sem_start_idx` ON `study_sessions` (`semester_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `study_subject_idx` ON `study_sessions` (`subject_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `study_topic_idx` ON `study_sessions` (`topic_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `study_one_active_uq` ON `study_sessions` (1) WHERE "study_sessions"."state" IN ('running','paused');--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`code` text,
	`teacher` text,
	`icon` text,
	`credits` real,
	`target_bps` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "subject_target_ck" CHECK("subjects"."target_bps" IS NULL OR "subjects"."target_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "subject_credits_ck" CHECK("subjects"."credits" IS NULL OR "subjects"."credits" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_sem_name_uq` ON `subjects` (`semester_id`,`normalized_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_id_sem_uq` ON `subjects` (`id`,`semester_id`);--> statement-breakpoint
CREATE INDEX `subjects_sem_order_idx` ON `subjects` (`semester_id`,`archived_at`,`sort_order`);--> statement-breakpoint
CREATE TABLE `timetable_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`version_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`class_type_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`parity` text DEFAULT 'all' NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`room` text,
	`counts_as` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`,`semester_id`) REFERENCES `timetable_versions`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`,`semester_id`) REFERENCES `subjects`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_type_id`,`semester_id`) REFERENCES `class_types`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "slots_day_ck" CHECK("timetable_slots"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "slots_parity_ck" CHECK("timetable_slots"."parity" IN ('all','odd','even')),
	CONSTRAINT "slots_time_ck" CHECK("timetable_slots"."start_minute" >= 0 AND "timetable_slots"."start_minute" < "timetable_slots"."end_minute" AND "timetable_slots"."end_minute" <= 1440),
	CONSTRAINT "slots_weight_ck" CHECK("timetable_slots"."counts_as" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slots_id_subject_sem_uq` ON `timetable_slots` (`id`,`subject_id`,`semester_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `slots_exact_uq` ON `timetable_slots` (`version_id`,`subject_id`,`class_type_id`,`weekday`,`parity`,`start_minute`,`end_minute`);--> statement-breakpoint
CREATE INDEX `slots_week_idx` ON `timetable_slots` (`version_id`,`weekday`,`start_minute`);--> statement-breakpoint
CREATE INDEX `slots_subject_idx` ON `timetable_slots` (`subject_id`);--> statement-breakpoint
CREATE INDEX `slots_type_idx` ON `timetable_slots` (`class_type_id`);--> statement-breakpoint
CREATE TABLE `timetable_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`label` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "versions_range_ck" CHECK("timetable_versions"."effective_until" IS NULL OR "timetable_versions"."effective_until" > "timetable_versions"."effective_from")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `versions_sem_start_uq` ON `timetable_versions` (`semester_id`,`effective_from`);--> statement-breakpoint
CREATE UNIQUE INDEX `versions_id_sem_uq` ON `timetable_versions` (`id`,`semester_id`);--> statement-breakpoint
CREATE INDEX `versions_lookup_idx` ON `timetable_versions` (`semester_id`,`effective_from`,`effective_until`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`subject_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`,`subject_id`) REFERENCES `units`(`id`,`subject_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_id_subject_uq` ON `topics` (`id`,`subject_id`);--> statement-breakpoint
CREATE INDEX `topics_unit_order_idx` ON `topics` (`unit_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `topics_subject_done_idx` ON `topics` (`subject_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`subject_id` text NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `units_id_subject_uq` ON `units` (`id`,`subject_id`);--> statement-breakpoint
CREATE INDEX `units_subject_order_idx` ON `units` (`subject_id`,`sort_order`);
