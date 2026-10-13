import { z } from "zod";
import {
  portableSettings,
  notificationStateSchema,
  backupStateSchema,
} from "@/features/settings/model";
import {
  onboardingDraftSchema,
  importPasteSchema,
} from "@/features/onboarding/model";
import * as s from "./schema";
import type { Database } from "./client";
import {
  addDays,
  dayNumber,
  ledgerTotals,
  mondayAnchor,
  weekIndex,
  weekday,
  marksPercentage,
} from "@/lib/attendance";

export const normalizeName = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
const uuid = z.uuid();
export function localToday(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export function validateSettings(key: string, value: unknown, db: Database) {
  const validators = {
    activeSemesterId: z.uuid().nullable(),
    onboardingVersion: z.number().int().nonnegative(),
    onboardingDraft: onboardingDraftSchema,
    timetableImportDraft: importPasteSchema,
    notificationPermissionSnapshot: z.record(z.string(), z.unknown()),
    accountMetadata: z.record(z.string(), z.unknown()),
    ...portableSettings,
    appLock: z.boolean(),
    notificationState: notificationStateSchema,
    backupState: backupStateSchema,
  };
  if (!(key in validators)) throw new Error(`Unknown setting: ${key}`);
  validators[key as keyof typeof validators].parse(value);
  if (
    key === "activeSemesterId" &&
    value !== null &&
    !db
      .select()
      .from(s.semesters)
      .all()
      .some((row) => row.id === value)
  )
    throw new Error("Active semester unavailable");
}
export function validateDatabase(db: Database) {
  // Foundation-sized datasets use one consistent transaction snapshot. Feature-specific
  // commands can narrow validation later without weakening these contracts.
  for (const [name, table] of Object.entries(s)) {
    for (const row of db.select().from(table).all()) {
      for (const [key, value] of Object.entries(row)) {
        if (value === null) continue;
        if ((key === "id" || key.endsWith("Id")) && key !== "notificationId")
          uuid.parse(value);
        if (
          typeof value === "number" &&
          (!Number.isFinite(value) ||
            (!["credits", "earned", "maximum"].includes(key) &&
              !Number.isSafeInteger(value)))
        )
          throw new Error(`Invalid number: ${name}.${key}`);
        if (
          typeof value === "string" &&
          ["name", "title", "label", "normalizedName"].includes(key) &&
          !value.trim()
        )
          throw new Error(`Blank ${key}`);
        if (
          typeof value === "string" &&
          [
            "startsOn",
            "endsOn",
            "onDate",
            "effectiveFrom",
            "effectiveUntil",
            "weekAnchor",
          ].includes(key)
        )
          dayNumber(value);
      }
      if ("revision" in row && Number(row.revision) < 1)
        throw new Error("Invalid revision");
      if (
        "normalizedName" in row &&
        row.normalizedName !== normalizeName(String(row.name))
      )
        throw new Error("Name normalization mismatch");
    }
  }
  const semesters = db.select().from(s.semesters).all();
  const subjects = db.select().from(s.subjects).all();
  const versions = db.select().from(s.timetableVersions).all();
  const slots = db.select().from(s.timetableSlots).all();
  const extras = db.select().from(s.extraClasses).all();
  const holidays = db.select().from(s.holidays).all();
  const records = db.select().from(s.attendanceRecords).all();
  const semester = (id: string) => {
    const row = semesters.find((r) => r.id === id);
    if (!row) throw new Error("Semester unavailable");
    return row;
  };
  const inRange = (id: string, date: string) => {
    const sem = semester(id);
    if (date < sem.startsOn || date > sem.endsOn)
      throw new Error("Date outside semester");
  };
  for (const sem of semesters) {
    new Intl.DateTimeFormat("en", { timeZone: sem.timezone });
    if (sem.weekAnchor !== mondayAnchor(sem.startsOn))
      throw new Error("Week anchor must be the semester start Monday");
    const ordered = versions
      .filter((v) => v.semesterId === sem.id && v.supersededAt === null)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    ordered.forEach((v, index) => {
      inRange(sem.id, v.effectiveFrom);
      if (v.effectiveUntil && v.effectiveUntil > addDays(sem.endsOn, 1))
        throw new Error("Version ends outside semester");
      if (index && ordered[index - 1].effectiveUntil !== v.effectiveFrom)
        throw new Error(
          "Timetable versions must be contiguous and non-overlapping",
        );
    });
  }
  for (const subject of subjects)
    if (!/^#[0-9a-f]{6}$/i.test(subject.color))
      throw new Error("Choose a valid subject color.");
  for (const version of versions) {
    inRange(version.semesterId, version.effectiveFrom);
    if (
      version.effectiveUntil &&
      version.effectiveUntil > addDays(semester(version.semesterId).endsOn, 1)
    )
      throw new Error("Version ends outside semester");
  }
  for (const slot of slots) {
    if (slot.lineageId) {
      const root = slots.find((s) => s.id === slot.lineageId);
      if (
        !root ||
        root.semesterId !== slot.semesterId ||
        root.lineageId !== null
      )
        throw new Error("Invalid original timetable slot");
    }
  }
  const marked = new Set<string>();
  for (const record of records.filter((r) => r.slotId)) {
    const source = slots.find((s) => s.id === record.slotId)!;
    const key = `${source.lineageId ?? source.id}:${record.onDate}`;
    if (marked.has(key))
      throw new Error("This class already has attendance on this date.");
    marked.add(key);
  }
  for (const row of [
    ...extras.map((e) => ({ semesterId: e.semesterId, date: e.onDate })),
    ...holidays.flatMap((h) => [
      { semesterId: h.semesterId, date: h.startsOn },
      { semesterId: h.semesterId, date: h.endsOn },
    ]),
    ...records.map((r) => ({ semesterId: r.semesterId, date: r.onDate })),
    ...db
      .select()
      .from(s.classNotes)
      .all()
      .map((r) => ({ semesterId: r.semesterId, date: r.onDate })),
  ])
    inRange(row.semesterId, row.date);
  for (const row of records) {
    if (row.onDate > localToday(semester(row.semesterId).timezone))
      throw new Error("Cannot record future attendance");
    if (row.kind === "adjustment") continue;
    const source = row.slotId
      ? slots.find((slot) => slot.id === row.slotId)!
      : extras.find((extra) => extra.id === row.extraClassId)!;
    const key = row.slotId
      ? `slot:${row.slotId}:${row.onDate}`
      : `extra:${row.extraClassId}`;
    if (!source || key !== row.occurrenceKey)
      throw new Error("Invalid occurrence key/source");
    if ("versionId" in source) {
      const version = versions.find((v) => v.id === source.versionId)!;
      const odd =
        weekIndex(semester(row.semesterId).weekAnchor, row.onDate) % 2 === 1;
      if (
        row.onDate < version.effectiveFrom ||
        (version.effectiveUntil && row.onDate >= version.effectiveUntil) ||
        source.weekday !== weekday(row.onDate) ||
        (source.parity !== "all" && (source.parity === "odd") !== odd)
      )
        throw new Error("Occurrence does not match timetable");
    } else if (source.onDate !== row.onDate)
      throw new Error("Extra date mismatch");
    const blocked = holidays.some(
      (h) =>
        h.semesterId === row.semesterId &&
        (!h.subjectId || h.subjectId === row.subjectId) &&
        h.startsOn <= row.onDate &&
        h.endsOn >= row.onDate,
    );
    if (
      row.status !== "neutral" &&
      (("cancelledAt" in source && source.cancelledAt !== null) ||
        (blocked && !("allowOnHoliday" in source && source.allowOnHoliday)))
    )
      throw new Error("Marked holiday/cancelled class must be neutral");
  }
  subjects.forEach((subject) =>
    ledgerTotals(records.filter((r) => r.subjectId === subject.id)),
  );
  for (const note of db.select().from(s.notes).all())
    if (
      note.unitId &&
      note.topicId &&
      db
        .select()
        .from(s.topics)
        .all()
        .find((t) => t.id === note.topicId)?.unitId !== note.unitId
    )
      throw new Error("Note topic/unit mismatch");
  const folders = db.select().from(s.folders).all();
  for (const folder of folders) {
    const seen = new Set([folder.id]);
    let parentId = folder.parentId;
    while (parentId) {
      const parent = folders.find((f) => f.id === parentId);
      if (
        !parent ||
        parent.semesterId !== folder.semesterId ||
        parent.subjectId !== folder.subjectId ||
        seen.has(parent.id)
      )
        throw new Error("Invalid folder scope or cycle");
      seen.add(parent.id);
      parentId = parent.parentId;
    }
  }
  for (const file of db.select().from(s.files).all()) {
    const folder = folders.find((f) => f.id === file.folderId);
    if (file.folderId && (!folder || folder.subjectId !== file.subjectId))
      throw new Error("File destination scope mismatch");
    if (
      !file.relativePath ||
      file.relativePath.startsWith("/") ||
      file.relativePath
        .split("/")
        .some((p) => p === ".." || p === "" || p === ".") ||
      file.relativePath.includes("\\")
    )
      throw new Error("Unsafe attachment path");
    if (!/^[a-f0-9]{64}$/.test(file.sha256))
      throw new Error("Invalid attachment hash");
  }
  const marks = db.select().from(s.marks).all();
  subjects.forEach((subject) =>
    marksPercentage(
      marks.filter((m) => m.subjectId === subject.id),
      "unweighted",
    ),
  );
  for (const link of db.select().from(s.links).all())
    if (!["https:", "http:"].includes(new URL(link.url).protocol))
      throw new Error("Unsupported link scheme");
  for (const row of db.select().from(s.settings).all())
    validateSettings(row.key, row.value, db);
}
