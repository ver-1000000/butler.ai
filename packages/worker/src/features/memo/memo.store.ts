import { getSqliteDb } from '@butler/core';
import { PrettyText } from '../../utils/pretty-text.util';

/** `MemoStore`にアクセスした結果を使いやすくするためにラップする型。 */
interface StoreResult<T = string | Record<string, string>> {
  /** ストアにアクセスした結果をユーザーフレンドリーな文字列として整形した値。 */
  pretty: string;
  /** ストアにアクセスするのに利用されたkey。 */
  key: string;
  /** ストアにアクセスして取り出されたvalue。 */
  value: T;
}

/** memoの情報をjsonに永続化して保存するためのストア用クラス。 */
export class MemosStore {
  private db = getSqliteDb();
  private statementData = this.db.prepare('SELECT key, value FROM memos ORDER BY key');
  private statementGet = this.db.prepare('SELECT value FROM memos WHERE key = ?');
  private statementSet = this.db.prepare(
    'INSERT INTO memos (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  private statementDel = this.db.prepare('DELETE FROM memos WHERE key = ?');

  /** 設定されている値をすべて取得する。 */
  data(): Omit<StoreResult<Record<string, string>>, 'key'> {
    const rows   = this.statementData.all() as { key: string; value: string }[];
    const value  = Object.fromEntries(rows.map(row => [row.key, row.value]));
    const pretty = PrettyText.markdownList('', ...Object.entries(value)) || 'Memoは一つもありません:snail:';
    return { pretty, value };
  }

  /** データストアから値を取得する。 */
  get(key: string): StoreResult<string | null> {
    const row    = this.statementGet.get(key) as { value: string } | undefined;
    const value  = row?.value ?? null;
    const pretty = value == null
      ? `**${key}** は設定されていません:cry:`
      : `**${key}**\n${value ? PrettyText.code(value) : '値は空です:ghost:'}`;
    return { pretty, key, value };
  }

  /** データストアに値を設定する。 */
  set(key: string, value: string): StoreResult<string> {
    this.statementSet.run(key, value);
    const pretty = `**${key}** ${value ? `に次の内容をメモしました:wink:\n${PrettyText.code(value)}` : 'とメモしました:cat:'}`;
    return { pretty, key, value };
  }

  /** データストアから値を削除する。 */
  del(key: string): StoreResult<string | null> {
    const value  = this.get(key).value;
    const pretty = value == null
      ? `**${key}** は設定されていません:cry:`
      : `**${key}** を削除しました:wave:${value ? '\n' + PrettyText.code(value) : ''}`;
    if (value != null) { this.statementDel.run(key); }
    return { pretty, key, value };
  }
}
