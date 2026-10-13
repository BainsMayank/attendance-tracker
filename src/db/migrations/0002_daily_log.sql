CREATE TABLE `class_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`semester_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`on_date` text NOT NULL,
	`occurrence_key` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`,`semester_id`) REFERENCES `subjects`(`id`,`semester_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_notes_occurrence_uq` ON `class_notes` (`occurrence_key`);--> statement-breakpoint
CREATE INDEX `class_notes_sem_day_idx` ON `class_notes` (`semester_id`,`on_date`);--> statement-breakpoint
CREATE INDEX `slots_sem_idx` ON `timetable_slots` (`semester_id`);--> statement-breakpoint
CREATE INDEX `slots_lineage_idx` ON `timetable_slots` (`semester_id`,`lineage_id`);