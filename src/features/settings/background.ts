import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { initializeDatabase } from "@/db/client";
import { validateDatabase } from "@/db/validation";
import { semesterCleanup } from "@/features/semesters/cleanup-service";
import { weeklyBackupIfDue } from "./backup";
import { backupPreferencesSchema } from "./model";
import { readPreference } from "./preferences";

const TASK = "attendance-weekly-backup";
if (process.env.EXPO_OS !== "web" && !TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask(TASK, async () => {
    try {
      const db = await initializeDatabase();
      validateDatabase(db);
      const failures = await semesterCleanup.recover();
      if (failures.length) return BackgroundTask.BackgroundTaskResult.Failed;
      await weeklyBackupIfDue();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}
export async function configureWeeklyBackground() {
  if (process.env.EXPO_OS === "web" || !(await TaskManager.isAvailableAsync()))
    return;
  const enabled = readPreference("backupPreferences", backupPreferencesSchema, {
    weekly: true,
    includeFiles: true,
  }).weekly;
  if (!enabled) {
    if (await TaskManager.isTaskRegisteredAsync(TASK))
      await BackgroundTask.unregisterTaskAsync(TASK);
  } else if (!(await TaskManager.isTaskRegisteredAsync(TASK)))
    await BackgroundTask.registerTaskAsync(TASK, {
      minimumInterval: 7 * 24 * 60,
    });
}
