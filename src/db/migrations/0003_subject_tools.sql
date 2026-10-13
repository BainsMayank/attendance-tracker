CREATE TABLE `__new_deadlines` (
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
	CONSTRAINT "deadlines_type_ck" CHECK("__new_deadlines"."category" IN ('assignment','quiz','mid-sem','end-sem','exam','other')),
	CONSTRAINT "deadlines_reminder_ck" CHECK("__new_deadlines"."reminder_minutes" IS NULL OR "__new_deadlines"."reminder_minutes" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_deadlines`("id", "created_at", "updated_at", "revision", "subject_id", "title", "description", "category", "due_at", "completed_at", "reminder_minutes", "notification_id") SELECT "id", "created_at", "updated_at", "revision", "subject_id", "title", "description", "category", "due_at", "completed_at", "reminder_minutes", "notification_id" FROM `deadlines`;--> statement-breakpoint
DROP TABLE `deadlines`;--> statement-breakpoint
ALTER TABLE `__new_deadlines` RENAME TO `deadlines`;--> statement-breakpoint
CREATE INDEX `deadlines_subject_due_idx` ON `deadlines` (`subject_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `deadlines_due_open_idx` ON `deadlines` (`completed_at`,`due_at`);--> statement-breakpoint
ALTER TABLE `topics` ADD `important` integer DEFAULT 0 NOT NULL CONSTRAINT topics_important_ck CHECK (important IN (0,1));
