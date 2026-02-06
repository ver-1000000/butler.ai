/** リマインドタイミングの有効値。 */
export type ReminderTiming = '7d' | '3d' | '1d' | '0d';

/** イベントdescriptionに埋め込むBotMeta JSON構造。 */
export interface BotMeta {
  version: number;
  managedBy: string;
  createdBy: string;
  participants: string[];
  remindTimings: ReminderTiming[];
  notified: Record<ReminderTiming, boolean>;
}

/** BotMetaマーカー定数。 */
export const BOT_META_START = '<!-- BOT_META_START -->';
export const BOT_META_END = '<!-- BOT_META_END -->';
export const BOT_IDENTIFIER = 'butler';
export const BOT_META_VERSION = 1;

/** BotMetaブロックを抽出する正規表現。 */
const BOT_META_REGEX = /<!-- BOT_META_START -->([\s\S]*?)<!-- BOT_META_END -->/;

/** 有効なリマインドタイミングの一覧。 */
const VALID_TIMINGS: ReminderTiming[] = ['7d', '3d', '1d', '0d'];

/**
 * オブジェクトがBotMeta構造として有効かを検証する。
 */
function isValidBotMeta(obj: unknown): obj is BotMeta {
  if (typeof obj !== 'object' || obj === null) return false;
  const meta = obj as Record<string, unknown>;

  if (typeof meta.version !== 'number') return false;
  if (typeof meta.managedBy !== 'string') return false;
  if (typeof meta.createdBy !== 'string') return false;
  if (!Array.isArray(meta.participants)) return false;
  if (!meta.participants.every(p => typeof p === 'string')) return false;
  if (!Array.isArray(meta.remindTimings)) return false;
  if (!meta.remindTimings.every(t => VALID_TIMINGS.includes(t as ReminderTiming))) return false;
  if (typeof meta.notified !== 'object' || meta.notified === null) return false;

  return true;
}

/**
 * イベントdescriptionからBotMetaをパースする。
 * @returns BotMeta（有効な場合）、null（見つからないかパースエラー）
 */
export function parseBotMeta(description: string | null): BotMeta | null {
  if (!description) return null;

  const match = description.match(BOT_META_REGEX);
  if (!match) return null;

  try {
    const json = JSON.parse(match[1].trim());
    if (!isValidBotMeta(json)) {
      console.warn('BotMeta: 無効な構造');
      return null;
    }
    if (json.managedBy !== BOT_IDENTIFIER) {
      return null;
    }
    return json;
  } catch (e) {
    console.warn('BotMeta: JSONパース失敗:', e);
    return null;
  }
}

/**
 * BotMetaを埋め込み用文字列にシリアライズする。
 */
export function serializeBotMeta(meta: BotMeta): string {
  const json = JSON.stringify(meta, null, 2);
  return `${BOT_META_START}\n${json}\n${BOT_META_END}`;
}

/**
 * descriptionのBotMetaブロックを新しいmetaで置換する。
 * BotMetaが存在しない場合は末尾に追加する。
 */
export function updateDescriptionWithMeta(description: string | null, meta: BotMeta): string {
  const serialized = serializeBotMeta(meta);

  if (!description) {
    return serialized;
  }

  if (BOT_META_REGEX.test(description)) {
    return description.replace(BOT_META_REGEX, serialized);
  }

  return `${description}\n\n${serialized}`;
}

/**
 * 新規イベント用のデフォルトBotMetaを生成する。
 */
export function createDefaultBotMeta(
  creatorUserId: string,
  participants: string[],
  timings: ReminderTiming[] = ['7d', '3d', '1d', '0d']
): BotMeta {
  const notified: Record<ReminderTiming, boolean> = {
    '7d': false,
    '3d': false,
    '1d': false,
    '0d': false
  };

  return {
    version: BOT_META_VERSION,
    managedBy: BOT_IDENTIFIER,
    createdBy: creatorUserId,
    participants,
    remindTimings: timings,
    notified
  };
}

/**
 * descriptionからBotMetaブロックを除去したテキストを返す。
 */
export function stripBotMeta(description: string | null): string {
  if (!description) return '';
  return description.replace(BOT_META_REGEX, '').trim();
}
