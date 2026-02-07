import { Guild, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } from 'discord.js';
import {
  ReminderTiming,
  createDefaultBotMeta,
  updateDescriptionWithMeta
} from './bot-meta.model';

/** 有効なリマインドタイミング。 */
const VALID_TIMINGS: ReminderTiming[] = ['7d', '3d', '1d', '0d'];

/**
 * 日時文字列をDateオブジェクトにパースする。
 * 対応フォーマット: "YYYY-MM-DD HH:mm" または "YYYY/MM/DD HH:mm"
 */
function parseDateTime(input: string): Date | null {
  const normalized = input.trim().replace(/\//g, '-');
  const match = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/
  );
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute)
  );

  if (isNaN(date.getTime())) return null;
  return date;
}

/** メンション最大人数。 */
const MAX_PARTICIPANTS = 10;

/**
 * メンション文字列からユーザーIDを抽出する。
 * @param input メンション文字列 (例: "<@123> <@!456>")
 * @returns ユーザーIDの配列（重複除去済み）
 */
function parseParticipants(input: string | null): string[] {
  if (!input) return [];

  const mentionRegex = /<@!?(\d+)>/g;
  const ids: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(input)) !== null) {
    if (!ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }

  return ids;
}

export type AddEventInput = {
  name: string;
  start: string;
  end?: string | null;
  description?: string;
  participants?: string | null;
  createdBy: string;
};

export type AddEventResult = {
  ok: boolean;
  message: string;
};

/**
 * リマインド付きのスケジュールイベントを作成する。
 */
export async function createEventReminder(
  guild: Guild,
  input: AddEventInput
): Promise<AddEventResult> {
  if (!input.name.trim()) {
    return { ok: false, message: 'イベント名が指定されていません。' };
  }
  if (!input.start.trim()) {
    return { ok: false, message: '開始日時が指定されていません。' };
  }
  const scheduledStartTime = parseDateTime(input.start);
  if (!scheduledStartTime) {
    return { ok: false, message: '日時の形式が正しくありません。例: `2024-12-25 19:00`' };
  }

  if (scheduledStartTime <= new Date()) {
    return { ok: false, message: '開始日時は未来の日時を指定してください。' };
  }

  let scheduledEndTime: Date;
  if (input.end) {
    const parsedEnd = parseDateTime(input.end);
    if (!parsedEnd) {
      return { ok: false, message: '終了日時の形式が正しくありません。例: `2024-12-25 21:00`' };
    }
    if (parsedEnd <= scheduledStartTime) {
      return { ok: false, message: '終了日時は開始日時より後を指定してください。' };
    }
    scheduledEndTime = parsedEnd;
  } else {
    scheduledEndTime = new Date(
      scheduledStartTime.getTime() + 2 * 60 * 60 * 1000
    );
  }

  const participants = parseParticipants(input.participants ?? null);
  if (participants.length > MAX_PARTICIPANTS) {
    return { ok: false, message: `リマインド対象は最大${MAX_PARTICIPANTS}人までです。` };
  }

  const botMeta = createDefaultBotMeta(
    input.createdBy,
    participants,
    VALID_TIMINGS
  );
  const fullDescription = updateDescriptionWithMeta(input.description ?? '', botMeta);

  try {
    const event = await guild.scheduledEvents.create({
      name: input.name,
      scheduledStartTime,
      scheduledEndTime,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.External,
      entityMetadata: { location: 'Discord' },
      description: fullDescription
    });

    const startTimeStr = scheduledStartTime.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const participantMentions =
      participants.length > 0
        ? participants.map(id => `<@${id}>`).join(' ')
        : '(未設定)';

    return {
      ok: true,
      message: [
        `:calendar: **イベントを作成しました**`,
        ``,
        `**${event.name}**`,
        `開始: ${startTimeStr}`,
        `対象: ${participantMentions}`
      ].join('\n')
    };
  } catch (error) {
    console.error('イベント作成エラー:', error);
    return { ok: false, message: 'イベントの作成に失敗しました。' };
  }
}
