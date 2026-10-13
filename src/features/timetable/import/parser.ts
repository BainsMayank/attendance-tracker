import { z } from "zod";

export const cleanName = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ");
export const nameKey = (value: string) =>
  cleanName(value).toLocaleLowerCase("en-US");
const name = z.string().transform(cleanName).pipe(z.string().min(1).max(120));
const metadata = z
  .string()
  .transform(cleanName)
  .pipe(z.string().max(200))
  .nullable()
  .optional();
export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function normalizeDay(value: string) {
  const day = value.trim().toLowerCase().replace(/\.$/, "");
  const index = DAYS.findIndex(
    (d) => d.toLowerCase() === day || d.slice(0, 3).toLowerCase() === day,
  );
  if (index < 0)
    throw new Error(`unknown day "${value}"; use Monday through Sunday`);
  return index + 1;
}
export function normalizeTime(value: string, end = false) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) throw new Error(`invalid time "${value}"; use 09:00 or 9:00 AM`);
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0),
    period = match[3]?.toUpperCase();
  if (
    minute > 59 ||
    (period
      ? hour < 1 || hour > 12
      : hour > 23 && !(end && hour === 24 && minute === 0))
  )
    throw new Error(`invalid time "${value}"`);
  if (period) hour = (hour % 12) + (period === "PM" ? 12 : 0);
  return {
    text: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    minute: hour * 60 + minute,
  };
}

// Strict external contract: see docs/IMPORT_FORMAT.md. Overlaps belong to preview.
export const importSchema = z.strictObject({
  formatVersion: z.literal(1),
  subjects: z
    .array(z.strictObject({ name, code: metadata, teacher: metadata }))
    .min(1)
    .max(200),
  slots: z
    .array(
      z.strictObject({
        subject: name,
        day: name,
        start: name,
        end: name,
        classType: name.optional().default("Lecture"),
        weekPattern: z
          .enum(["every", "odd", "even"])
          .optional()
          .default("every"),
        venue: metadata,
        teacher: metadata,
        countsAs: z.number().int().positive().max(100).optional().default(1),
      }),
    )
    .min(1)
    .max(1000),
});
export type ImportSubject = z.infer<typeof importSchema>["subjects"][number];
export type ImportSlot = z.infer<typeof importSchema>["slots"][number] & {
  index: number;
  weekday: number;
  startMinute: number;
  endMinute: number;
};
export type ImportDraft = {
  formatVersion: 1;
  subjects: ImportSubject[];
  slots: ImportSlot[];
};

export function extractJSON(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*$/gim, "");
  try {
    return JSON.parse(text);
  } catch {
    /* A response may contain surrounding prose. */
  }
  const candidates: unknown[] = [];
  let start = -1,
    depth = 0,
    quoted = false,
    escaped = false,
    malformed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (start < 0) {
      if (c === "{" || c === "[") {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      if (--depth === 0) {
        try {
          candidates.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          // A balanced brace in prose (for example, {note}) is not JSON.
          malformed = true;
        }
        start = -1;
      }
    }
  }
  if (!candidates.length)
    throw new Error(
      malformed
        ? "The JSON is malformed. Copy the complete JSON response, including all commas and quotes."
        : "No complete JSON object found. Copy the complete JSON response and try again.",
    );
  if (candidates.length !== 1)
    throw new Error(
      "More than one JSON object found. Paste one timetable at a time.",
    );
  return candidates[0];
}
/** iOS smart punctuation and some notes apps turn JSON quotes into “curly” ones. */
function extractWithStraightQuotes(raw: string) {
  try {
    return extractJSON(raw);
  } catch (error) {
    if (!/[\u201C\u201D\u201E\u201F\u2033]/.test(raw)) throw error;
    return extractJSON(raw.replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"'));
  }
}
export function parseImport(raw: string): ImportDraft {
  if (raw.length > 512000)
    throw new Error(
      "This paste is too large. Paste one timetable under 512,000 characters.",
    );
  if (!raw.trim())
    throw new Error("Paste the JSON returned by ChatGPT or Gemini first.");
  const result = importSchema.safeParse(extractWithStraightQuotes(raw));
  if (!result.success) {
    const issue = result.error.issues[0],
      [collection, index, ...field] = issue.path;
    const prefix =
      (collection === "slots" || collection === "subjects") &&
      typeof index === "number"
        ? `${collection === "slots" ? "Slot" : "Subject"} ${index + 1}${field.length ? ` (${field.join(".")})` : ""}`
        : String(collection ?? "Timetable");
    throw new Error(`${prefix}: ${issue.message}`);
  }
  const subjects: ImportSubject[] = [];
  for (const [index, subject] of result.data.subjects.entries()) {
    const existing = subjects.find(
      (s) => nameKey(s.name) === nameKey(subject.name),
    );
    if (!existing) subjects.push(subject);
    else
      for (const key of ["code", "teacher"] as const) {
        if (
          existing[key] &&
          subject[key] &&
          nameKey(existing[key]!) !== nameKey(subject[key]!)
        )
          throw new Error(
            `Subject ${index + 1}: conflicting ${key} for "${existing.name}"`,
          );
        existing[key] ||= subject[key];
      }
  }
  const slots = result.data.slots.map((slot, index) => {
    try {
      const subject = subjects.find(
        (s) => nameKey(s.name) === nameKey(slot.subject),
      );
      if (!subject)
        throw new Error(`subject "${slot.subject}" is missing from subjects`);
      const start = normalizeTime(slot.start),
        end = normalizeTime(slot.end, true);
      if (end.minute <= start.minute)
        throw new Error(
          end.minute < start.minute
            ? "end time before start"
            : "end time equals start",
        );
      const weekday = normalizeDay(slot.day);
      return {
        ...slot,
        subject: subject.name,
        day: DAYS[weekday - 1],
        start: start.text,
        end: end.text,
        index: index + 1,
        weekday,
        startMinute: start.minute,
        endMinute: end.minute,
      };
    } catch (error) {
      throw new Error(`Slot ${index + 1}: ${(error as Error).message}`);
    }
  });
  return { formatVersion: 1, subjects, slots };
}

/** Drop one slot (1-based, as in "Slot N") from a pasted reply, keeping everything else. */
export function withoutSlot(raw: string, index: number) {
  const value = extractWithStraightQuotes(raw) as { slots?: unknown[] };
  if (!Array.isArray(value?.slots) || index < 1 || index > value.slots.length)
    throw new Error("That class is no longer in the pasted reply.");
  value.slots.splice(index - 1, 1);
  return JSON.stringify(value, null, 2);
}
