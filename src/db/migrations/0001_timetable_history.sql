DROP INDEX `versions_sem_start_uq`;--> statement-breakpoint
ALTER TABLE `timetable_versions` ADD `superseded_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `versions_sem_start_uq` ON `timetable_versions` (`semester_id`,`effective_from`) WHERE "timetable_versions"."superseded_at" IS NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `color` text DEFAULT '#4144D8' NOT NULL;--> statement-breakpoint
ALTER TABLE `timetable_slots` ADD `teacher` text;--> statement-breakpoint
ALTER TABLE `timetable_slots` ADD `lineage_id` text;