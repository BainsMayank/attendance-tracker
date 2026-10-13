The schema is copied verbatim from `docs/ARCHITECTURE.md`. Generate migrations with
`rtk npx drizzle-kit generate`, then review and execute them against fresh SQLite.

Drizzle Kit 0.31.11 misquotes the two `coalesce` expressions in `folders_sibling_uq`
as identifiers. The first migration corrects its generated statement to:

```sql
CREATE UNIQUE INDEX folders_sibling_uq ON folders
  (semester_id, coalesce(subject_id, ''), coalesce(parent_id, ''), normalized_name);
```

This preserves the documented NULL-scope/root uniqueness contract. Keep this
correction when regenerating or reviewing later migrations. The integration suite
executes the actual Expo Drizzle migrator against SQLite and verifies that duplicate
root folders reject. Do not edit an already-shipped migration to change a schema;
create a new migration instead.

Session 3 adds `0001_timetable_history`: subject color, slot teacher/lineage, and
version supersession. The version-start unique index now applies only to active
versions. No foundation table is rebuilt or attendance row rewritten. The SQLite
suite upgrades a populated foundation database, checks preserved rows, and reruns
the complete migration set to verify idempotence.

Session 4 adds generated `0002_daily_log`: `class_notes` stores optional notes
independently from attendance marks, keyed by the original slot lineage/date or
extra-class ID. Clearing a mark therefore does not delete a note. The additive
migration also adds semester/lineage indexes on timetable slots. The database now
has 19 application tables. Existing attendance and timetable rows are preserved.
Daily Log commands use scoped transactions and indexed subject-prefix validation;
bootstrap and general repository writes retain full database validation.

Subject-detail tools add `0003_subject_tools`. Topics receive an additive boolean
`important` column with a 0/1 check. The generated topic rebuild was corrected to
`ALTER TABLE ... ADD COLUMN`: a rebuild would threaten incoming topic references,
and the generator incorrectly tried to copy the new column from the old table.
Deadlines are rebuilt to expand the category CHECK to assignment, quiz, mid-sem,
end-sem, legacy exam, and other. Every existing column is copied, including
notification IDs, revisions and timestamps. The populated upgrade regression
verifies notes, topic references, study history, notifications, category checks,
foreign-key integrity and migration reruns. OS notification IDs are opaque handles,
not application UUIDs.
