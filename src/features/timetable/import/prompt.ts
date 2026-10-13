// Kept byte-for-byte equal to the prompt block in docs/IMPORT_FORMAT.md by a test.
export const IMPORT_PROMPT = `Read the attached timetable photo and return exactly one JSON object for Attendance Tracker. Return JSON only, without Markdown fences or explanation. Do not invent unclear subjects, times, venues, teachers, or week patterns; ask me to clarify anything unreadable before returning JSON. Ignore breaks and lunch.

Use this structure:
{"formatVersion":1,"subjects":[{"name":"Mathematics","code":null,"teacher":null}],"slots":[{"subject":"Mathematics","day":"Monday","start":"09:00","end":"10:00","classType":"Lecture","weekPattern":"every","venue":null,"teacher":null,"countsAs":1}]}

Rules:
- formatVersion must be the number 1. Include only formatVersion, subjects, and slots at the top level.
- subjects is a nonempty array (maximum 200). Each subject has a name (1-120 characters), and optional code and teacher (string up to 200 characters or null). Use one entry per subject, combining case and spacing variants.
- slots is a nonempty array (maximum 1000). Each slot has subject, day, start, and end. subject must match a subject name. day is Monday through Sunday. Times are 24-hour HH:mm. End must be after start on the same day; 24:00 is allowed only for end. Split overnight classes across days.
- Optional slot fields: classType (1-120 characters; default Lecture), weekPattern (every, odd, or even; default every), venue and teacher (string up to 200 characters or null), countsAs (whole number 1-100; default 1). A lab is still 1 unless the timetable explicitly states another attendance weight.
- Odd/even weeks are relative to the semester's first week. Do not guess parity. Use every unless an alternating pattern is explicitly shown.
- Do not include IDs, attendance records, semester dates, extra keys, comments, trailing commas, or placeholders. Preserve genuine simultaneous classes so I can review their conflicts in the app.`;
