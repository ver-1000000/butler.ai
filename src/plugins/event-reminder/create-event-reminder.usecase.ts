import { Guild, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } from 'discord.js';
import {
  ReminderTiming,
  createDefaultBotMeta,
  updateDescriptionWithMeta
} from './bot-meta.model';

/** 有効なリマインドタイミング。 */
const VALID_TIMINGS: ReminderTiming[] = ['7d', '3d', '1d', '0d'];

type ParsedDateTime = {
  date: Date;
  inferredYear: boolean;
};

/**
 * 日時文字列をDateオブジェクトにパースする。
 * 対応フォーマット:
 * - "YYYY-MM-DD HH:mm" / "YYYY/MM/DD HH:mm"
 * - "MM-DD HH:mm" / "MM/DD HH:mm" (年は補完)
 */
function parseDateTime(input: string, fallbackYear: number = new Date().getFullYear()): ParsedDateTime | null {
  const normalized = input.trim().replace(/\//g, '-');
  const match = normalized.match(
    /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/
  );
  if (!match) return null;

  const [, yearPart, month, day, hour, minute] = match;
  const inferredYear = !yearPart;
  const year = inferredYear ? fallbackYear : parseInt(yearPart, 10);
  const monthNumber = parseInt(month, 10);
  const dayNumber = parseInt(day, 10);
  const hourNumber = parseInt(hour, 10);
  const minuteNumber = parseInt(minute, 10);

  const date = new Date(
    year,
    monthNumber - 1,
    dayNumber,
    hourNumber,
    minuteNumber
  );

  if (isNaN(date.getTime())) return null;
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthNumber - 1 ||
    date.getDate() !== dayNumber ||
    date.getHours() !== hourNumber ||
    date.getMinutes() !== minuteNumber
  ) {
    return null;
  }

  return { date, inferredYear };
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
  const autoCompletionNotes: string[] = [];

  if (!input.name.trim()) {
    return { ok: false, message: 'イベント名が指定されていません。' };
  }
  if (!input.start.trim()) {
    return { ok: false, message: '開始日時が指定されていません。' };
  }
  const parsedStart = parseDateTime(input.start);
  if (!parsedStart) {
    return {
      ok: false,
      message: '日時の形式が正しくありません。例: `2026-12-25 19:00` または `12/25 19:00`'
    };
  }
  const scheduledStartTime = parsedStart.date;
  if (parsedStart.inferredYear) {
    autoCompletionNotes.push(`開始日時の年を ${scheduledStartTime.getFullYear()} 年として解釈しました`);
  }

  if (scheduledStartTime <= new Date()) {
    return { ok: false, message: '開始日時は未来の日時を指定してください。' };
  }

  let scheduledEndTime: Date;
  if (input.end) {
    const parsedEnd = parseDateTime(input.end, scheduledStartTime.getFullYear());
    if (!parsedEnd) {
      return {
        ok: false,
        message: '終了日時の形式が正しくありません。例: `2026-12-25 21:00` または `12/25 21:00`'
      };
    }
    if (parsedEnd.inferredYear) {
      autoCompletionNotes.push(`終了日時の年を ${parsedEnd.date.getFullYear()} 年として解釈しました`);
    }
    if (parsedEnd.date <= scheduledStartTime) {
      return { ok: false, message: '終了日時は開始日時より後を指定してください。' };
    }
    scheduledEndTime = parsedEnd.date;
  } else {
    scheduledEndTime = new Date(
      scheduledStartTime.getTime() + 2 * 60 * 60 * 1000
    );
    autoCompletionNotes.push('終了日時が未指定のため、開始時刻の2時間後を設定しました');
  }

  const participants = parseParticipants(input.participants ?? null);
  if (participants.length > MAX_PARTICIPANTS) {
    return { ok: false, message: `リマインド対象は最大${MAX_PARTICIPANTS}人までです。` };
  }
  if (!input.participants?.trim()) {
    autoCompletionNotes.push('リマインド対象が未指定のため、対象なしで登録しました');
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
    const endTimeStr = scheduledEndTime.toLocaleString('ja-JP', {
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

    const autoCompletionMessage = autoCompletionNotes.length > 0
      ? [
          '',
          '**自動補完した内容**',
          ...autoCompletionNotes.map(note => `- ${note}`)
        ]
      : [];

    return {
      ok: true,
      message: [
        `:calendar: **イベントを作成しました**`,
        ``,
        `**${event.name}**`,
        `開始: ${startTimeStr}`,
        `終了: ${endTimeStr}`,
        `対象: ${participantMentions}`,
        ...autoCompletionMessage
      ].join('\n')
    };
  } catch (error) {
    console.error('イベント作成エラー:', error);
    return { ok: false, message: 'イベントの作成に失敗しました。' };
  }
}
