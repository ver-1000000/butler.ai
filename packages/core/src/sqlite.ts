import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

export type SqliteDb = BetterSqliteDatabase;

let db: SqliteDb | null = null;

const resolveSqlitePath = () => path.resolve(__dirname, '../../../data/butler.sqlite');

export const getSqliteDb = (): SqliteDb => {
  if (db) { return db; }
  const dbPath = resolveSqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS memos (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stickers (
      id TEXT PRIMARY KEY,
      regexp TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pomodoro_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      start_at TEXT,
      spent INTEGER NOT NULL DEFAULT 0,
      wave INTEGER NOT NULL DEFAULT 0,
      rest INTEGER NOT NULL DEFAULT 1
    );
    INSERT OR IGNORE INTO pomodoro_status (id, spent, wave, rest) VALUES (1, 0, 0, 1);
  `);
  return db;
};
