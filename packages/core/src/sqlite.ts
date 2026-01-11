import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { Database as SqliteDb } from 'better-sqlite3';

/** プロセスごとのシングルトン。 Web/workerは別プロセスで動作するため、それぞれ独自の接続を持つ。 */
let db: SqliteDb | null = null;

/** worker/webどちらから呼ばれても同じ保存先になるよう固定する。 */
const resolveSqlitePath = () => path.resolve(__dirname, '../../../data/butler.sqlite');

/** worker/webのストアやAPIがDBアクセスするときの入口。初回のみ初期化して使い回す。 */
export const getSqliteDb = (): SqliteDb => {
  if (db) return db;
  const dbPath = resolveSqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec('');
  return db;
};

(() => {
  /** Appの終了処理でprocess.exit()が呼ばれたときにDBを閉じる。 */
  const closeSqliteDb = () => {
    if (db == null) return;
    db.close();
    db = null;
  };
  process.once('exit', closeSqliteDb);
  process.once('SIGINT', closeSqliteDb);
  process.once('SIGTERM', closeSqliteDb);
})();
