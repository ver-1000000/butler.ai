import Redis from 'ioredis';

import { REDIS_URL } from '@butler/core';
import { PrettyText } from '../utils/pretty-text.util';

/** `MemoStore`にアクセスした結果を使いやすくするためにラップする型。 */
interface StoreResult<T = string | Record<string, string>> {
  /** ストアにアクセスした結果をユーザーフレンドリーな文字列として整形した値。 */
  pretty: string;
  /** ストアにアクセスするのに利用されたkey。 */
  key: string;
  /** ストアにアクセスして取り出されたvalue。 */
  value: T;
}

/** Redisで利用するトップキー。 */
const HKEY = 'MEMO';

/** memoの情報をjsonに永続化して保存するためのストア用クラス。 */
export class MemosStore {
  private redis: Redis;

  constructor() {
    if (!REDIS_URL) {
      throw new Error('REDIS_URLが設定されていません');
    }
    this.redis = new Redis(REDIS_URL);
  }

  /** 設定されている値をすべて取得する。 */
  async data(): Promise<Omit<StoreResult<Record<string, string>>, 'key'>> {
    const value  = await this.redis.hgetall(HKEY);
    const pretty = PrettyText.markdownList('', ...Object.entries(value)) || 'Memoは一つもありません:snail:';
    return { pretty, value };
  }

  /** データストアから値を取得する。 */
  async get(key: string): Promise<StoreResult<string | null>> {
    const value  = await this.redis.hget(HKEY, key);
    const pretty = value == null ? `**${key}** は設定されていません:cry:` : `**${key}**\n${value ? PrettyText.code(value) : '値は空です:ghost:'}`;
    return { pretty, key, value };
  }

  /** データストアに値を設定する。 */
  async set(key: string, value: string): Promise<StoreResult<string>> {
    await this.redis.hset(HKEY, key, value);
    const pretty = `**${key}** ${value ? `に次の内容をメモしました:wink:\n${PrettyText.code(value)}` : 'とメモしました:cat:'}`
    return { pretty, key, value };
  }

  /** データストアから値を削除する。 */
  async del(key: string): Promise<StoreResult<string | null>> {
    const value  = (await this.get(key)).value;
    const pretty = value == null ? `**${key}** は設定されていません:cry:` : `**${key}** を削除しました:wave:${value ? '\n' + PrettyText.code(value) : ''}`;
    if (value != null) { await this.redis.hdel(HKEY, key); }
    return { pretty, key, value };
  }
}
