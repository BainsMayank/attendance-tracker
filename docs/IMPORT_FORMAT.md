# Timetable import format

Session 6 defines this contract because this file was absent. It covers JSON produced in an external ChatGPT/Gemini session. The app performs no AI calls, uploads, or extraction. The existing `TIMETABLE_EXPORT.md` format is a separate versioned export contract; it is not accepted as this import format.

## Contract, version 1

The top-level object is strict: `formatVersion` (number, exactly `1`), `subjects` (1–200 objects), and `slots` (1–1000 objects). Unknown properties are rejected at every level. Input is limited to 512,000 characters.

Subject properties: required `name` (nonblank string, 1–120 characters after normalization); optional `code` and `teacher` (string up to 200 characters, null, or omitted).

Slot properties: required `subject`, `day`, `start`, `end` (nonblank strings, maximum 120 characters); optional `classType` (nonblank string, maximum 120, defaults to `Lecture`), `weekPattern` (`every|odd|even`, defaults to `every`), `venue` and `teacher` (string up to 200 characters, null, or omitted), and `countsAs` (integer 1–100, defaults to 1). Explicit null is not accepted for fields with defaults.

Names use Unicode NFKC, trimmed and collapsed whitespace, and case-insensitive matching. Duplicate subjects merge; conflicting nonempty metadata rejects. Slots must reference a listed subject. Days accept full names or three-letter abbreviations, case-insensitive, with an optional trailing period. Times accept `9`, `9:00`, `09:00`, `9 AM`, and `09:00 AM`; output normalizes to `HH:mm`. Minutes require two digits. `24:00` is valid only as an end. Equal/reversed times reject; overnight sessions must be split.

Markdown JSON fences and surrounding prose are accepted; multiple JSON values, malformed JSON, and incomplete objects reject. Braces inside JSON strings are preserved. Overlaps remain in the draft and are flagged in preview. Adjacent classes and odd/even alternatives do not conflict. Exact duplicate slots are collapsed during preview/save. Replace changes recurring slots only; existing subjects and recorded attendance remain. Merge adds to the selected effective schedule. Both create a new timetable version and use the existing Today/Whole semester scope behavior. Unresolved overlaps block saving.

## Exact copy prompt

The app copies the following block exactly, excluding the code fences and their surrounding newlines. A regression test compares it with the bundled constant.

```text
Read the attached timetable photo and return exactly one JSON object for Attendance Tracker. Return JSON only, without Markdown fences or explanation. Do not invent unclear subjects, times, venues, teachers, or week patterns; ask me to clarify anything unreadable before returning JSON. Ignore breaks and lunch.

Use this structure:
{"formatVersion":1,"subjects":[{"name":"Mathematics","code":null,"teacher":null}],"slots":[{"subject":"Mathematics","day":"Monday","start":"09:00","end":"10:00","classType":"Lecture","weekPattern":"every","venue":null,"teacher":null,"countsAs":1}]}

Rules:
- formatVersion must be the number 1. Include only formatVersion, subjects, and slots at the top level.
- subjects is a nonempty array (maximum 200). Each subject has a name (1-120 characters), and optional code and teacher (string up to 200 characters or null). Use one entry per subject, combining case and spacing variants.
- slots is a nonempty array (maximum 1000). Each slot has subject, day, start, and end. subject must match a subject name. day is Monday through Sunday. Times are 24-hour HH:mm. End must be after start on the same day; 24:00 is allowed only for end. Split overnight classes across days.
- Optional slot fields: classType (1-120 characters; default Lecture), weekPattern (every, odd, or even; default every), venue and teacher (string up to 200 characters or null), countsAs (whole number 1-100; default 1). A lab is still 1 unless the timetable explicitly states another attendance weight.
- Odd/even weeks are relative to the semester's first week. Do not guess parity. Use every unless an alternating pattern is explicitly shown.
- Do not include IDs, attendance records, semester dates, extra keys, comments, trailing commas, or placeholders. Preserve genuine simultaneous classes so I can review their conflicts in the app.
```
