import { openDatabaseAsync } from "expo-sqlite";
import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import * as schema from "./schema";
import migrations from "./migrations/migrations";
export type Database = ExpoSQLiteDatabase<typeof schema>;
let current: Database | undefined;
export async function initializeDatabase(): Promise<Database> {
  if (current) return current;
  const sqlite = await openDatabaseAsync("attendance.db");
  try {
    await sqlite.execAsync(
      "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
    );
    const db = drizzle(sqlite, { schema });
    await migrate(db, migrations);
    current = db;
    return db;
  } catch (error) {
    await sqlite.closeAsync();
    throw error;
  }
}
export function getDatabase(): Database {
  if (!current) throw new Error("Database has not finished opening");
  return current;
}
