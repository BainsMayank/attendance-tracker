import { z } from "zod";

export const reminderSchema = z
  .object({
    classes: z.boolean(),
    leadMinutes: z.number().int().min(0).max(1440),
    mutedSubjects: z.array(z.uuid()).max(1000),
    daily: z.boolean(),
    dailyMinute: z.number().int().min(0).max(1439),
    lowAttendance: z.boolean(),
    deadlines: z.boolean(),
  })
  .strict();
export type ReminderRules = z.infer<typeof reminderSchema>;
export const defaultReminders: ReminderRules = {
  classes: false,
  leadMinutes: 10,
  mutedSubjects: [],
  daily: false,
  dailyMinute: 20 * 60,
  lowAttendance: false,
  deadlines: false,
};
export const backupPreferencesSchema = z
  .object({
    weekly: z.boolean(),
    includeFiles: z.boolean(),
  })
  .strict();
export const accentSchema = z.enum([
  "indigo",
  "blue",
  "teal",
  "rose",
  "violet",
]);
export type Accent = z.infer<typeof accentSchema>;
// Each pair has readable foreground contrast in both themes.
export const accents: Record<
  Accent,
  { name: string; light: string; dark: string; onDark: string }
> = {
  // Keys are persisted; only names and values are recalibrated.
  indigo: { name: "Ink", light: "#2F5276", dark: "#9DB6D3", onDark: "#152435" },
  blue: { name: "Blue", light: "#2B5E9C", dark: "#98BCE6", onDark: "#12253D" },
  teal: { name: "Pine", light: "#2A6863", dark: "#8EC6BF", onDark: "#10302D" },
  rose: { name: "Clay", light: "#94485A", dark: "#E0A5B3", onDark: "#3A1A22" },
  violet: { name: "Plum", light: "#644C86", dark: "#C1AEDD", onDark: "#2A1F3A" },
};
export const portableSettings = {
  theme: z.enum(["system", "light", "dark"]),
  accent: accentSchema,
  hapticsEnabled: z.boolean(),
  reduceEffects: z.boolean(),
  reduceTransparency: z.boolean(),
  subjectSort: z.enum(["name", "percentage", "nextClass"]),
  reminderRules: reminderSchema,
  backupPreferences: backupPreferencesSchema,
  feedbackEmail: z.union([z.literal(""), z.email().max(254)]),
};
export const notificationStateSchema = z
  .object({
    below: z.record(z.string(), z.boolean()),
    scheduled: z.number().int().nonnegative(),
    overflow: z.number().int().nonnegative(),
    refreshedAt: z.number().int().nonnegative(),
    error: z.string().max(2000),
    permission: z.string().max(100),
  })
  .strict();
export const defaultNotificationState = {
  below: {},
  scheduled: 0,
  overflow: 0,
  refreshedAt: 0,
  error: "",
  permission: "Not requested",
};
export const backupStateSchema = z
  .object({
    lastSuccess: z.number().int().nonnegative(),
    error: z.string().max(2000),
  })
  .strict();
export function requiresUnlock(
  enabled: boolean,
  backgroundAt: number | null,
  now: number,
) {
  return (
    enabled &&
    (backgroundAt === null ||
      now < backgroundAt ||
      now - backgroundAt >= 60_000)
  );
}

/** Also used by reminder responses, which may receive foreground before the lock listener. */
export function canAccessWorkspace(
  unlocked: boolean,
  backgroundAt: number | null,
  now: number,
) {
  return (
    unlocked &&
    (backgroundAt === null || !requiresUnlock(true, backgroundAt, now))
  );
}
