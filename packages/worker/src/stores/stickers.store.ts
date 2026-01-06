import { getSqliteDb } from '@butler/core';
import { PrettyText } from '../utils/pretty-text.util';

/** ストアにアクセスした結果を使いやすくするためにラップする型。 */
interface StoreResult<T = string | Record<string, string>> {
  /** ストアにアクセスした結果をユーザーフレンドリーな文字列として整形した値。 */
  pretty: string;
  /** ストアにアクセスするのに利用されたkey。 */
  key?: string;
  /** ストアにアクセスして取り出されたvalue。 */
  value: T;
}

export interface Sticker {
  /** 一意になるURL。 */
  id: string;
  /** ステッカーが呼び出される根拠となる正規表現。 */
  regexp: string;
}

/** 画像と正規表現のレコードを表すクラス。 */
export class StickersStore {
  private db = getSqliteDb();
  private statementData = this.db.prepare('SELECT id, regexp FROM stickers ORDER BY id');
  private statementGet = this.db.prepare('SELECT id, regexp FROM stickers WHERE id = ?');
  private statementSet = this.db.prepare('INSERT INTO stickers (id, regexp) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET regexp = excluded.regexp');
  private statementDel = this.db.prepare('DELETE FROM stickers WHERE id = ?');

  /** 設定されている値をすべて取得する。 */
  data(): StoreResult<Record<string, Sticker>> {
    const rows   = this.statementData.all() as Sticker[];
    const value  = rows.reduce<Record<string, Sticker>>((a, row) => ({ ...a, [row.id]: row }), {});
    const items  = rows.map<[string, string]>(({ id, regexp }) => [id, regexp]);
    const pretty = PrettyText.markdownList('', ...items) || 'Stickerは一つもありません:drum:';
    return { pretty, value };
  }

  /** データストアから値を取得する。 */
  get(key: string): StoreResult<Sticker | null> {
    const row    = this.statementGet.get(key) as Sticker | undefined;
    const value  = row ?? null;
    const pretty = value == null ? `**${key}** は設定されていません:cry:` : ` **\`${key}\`** \`/${value.regexp}/\``;
    return { pretty, key, value };
  }

  /** データストアに値を設定する。 */
  set(key: string, value: string): StoreResult<string> {
    this.statementSet.run(key, value);
    const pretty = `**\`${key}\`** に **\`/${value}/\`** を設定しました:pleading_face:`;
    return { pretty, key, value };
  }

  /** データストアから値を削除する。 */
  del(key: string): StoreResult<Sticker | null> {
    const value  = this.get(key).value;
    const pretty = value == null ? `**${key}** は設定されていません:cry:` : `**${key}** を削除しました:wave:${value ? '\n' + PrettyText.code(value.regexp) : ''}`;
    if (value != null) { this.statementDel.run(key); }
    return { pretty, key, value };
  }
}
