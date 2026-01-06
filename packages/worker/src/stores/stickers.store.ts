import Redis from 'ioredis';
import { REDIS_URL } from '@butler/core';
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

/** Redisで利用するトップキー。 */
const HKEY = 'STICKER';

/** 画像と正規表現のレコードを表すクラス。 */
export class StickersStore {
  private redis: Redis;

  constructor() {
    if (!REDIS_URL) {
      throw new Error('REDIS_URLが設定されていません');
    }
    this.redis = new Redis(REDIS_URL);
  }

  /** 設定されている値をすべて取得する。 */
  async data(): Promise<StoreResult<Record<string, Sticker>>> {
    const value  = Object.entries(await this.redis.hgetall(HKEY)).reduce<Record<string, Sticker>>((a, [k, v]) => ({ ...a, [k]: JSON.parse(v) }), {});
    const items  = Object.entries(value).map<[string, string]>(([k, v]) => [k, v.regexp]);
    const pretty = PrettyText.markdownList('', ...items) || 'Stickerは一つもありません:drum:';
    return { pretty, value };
  }

  /** データストアから値を取得する。 */
  async get(key: string): Promise<StoreResult<Sticker | null>> {
    const value: Sticker | null = JSON.parse((await this.redis.hget(HKEY, key)) ?? 'null');
    const pretty                = value == null ? `**${key}** は設定されていません:cry:` : ` **\`${key}\`** \`/${value.regexp}/\``;
    return { pretty, key, value };
  }

  /** データストアに値を設定する。 */
  async set(key: string, value: string): Promise<StoreResult<string>> {
    await this.redis.hset(HKEY, key, JSON.stringify({ id: key, regexp: value }));
    const pretty = `**\`${key}\`** に **\`/${value}/\`** を設定しました:pleading_face:`;
    return { pretty, key, value };
  }

  /** データストアから値を削除する。 */
  async del(key: string): Promise<StoreResult<Sticker | null>> {
    const value  = (await this.get(key)).value;
    const pretty = value == null ? `**${key}** は設定されていません:cry:` : `**${key}** を削除しました:wave:${value ? '\n' + PrettyText.code(value.regexp) : ''}`;
    if (value != null) { await this.redis.hdel(HKEY, key); }
    return { pretty, key, value };
  }
}
