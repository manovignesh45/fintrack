import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

export async function setupDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
}
