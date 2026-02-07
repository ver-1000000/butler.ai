import type { Client } from 'discord.js';
import type { PluginManifest } from '../manifest.types';
import { handleEventReminderTool } from './event-reminder.handler';
import { EventReminderService } from './event-reminder.service';

const EVENT_REMINDER_TOOL_NAME = 'event-reminder';

const normalizeDateTimeLikeInput = (value: string): string => {
  return value
    .trim()
    .replace(/[年月]/g, '-')
    .replace(/日/g, '')
    .replace(/[時：]/g, ':')
    .replace(/分/g, '')
    .replace(/\s+/g, ' ');
};

const manifest: PluginManifest = {
  id: 'event-reminder',
  aiPolicy: [
    'event-reminderは不足情報を確認しすぎず、作成可能なら一度で作成する',
    'startの年が省略されている場合は今年として扱う',
    'endが未指定ならstartの2時間後を使う',
    'participantsが未指定なら対象なしとして扱う',
    '不確定な点は推測で補い、作成後に補完内容を結果メッセージで共有する'
  ].join('。'),
  tools: [
    {
      name: EVENT_REMINDER_TOOL_NAME,
      description: 'イベントとリマインドを登録する(不足項目は可能な範囲で自動補完する)',
      arguments: [
        { name: 'name', description: 'イベント名', required: true },
        {
          name: 'start',
          description: '開始日時 (例: 2026-12-25 19:00 / 12/25 19:00, 年省略時は今年として扱う)',
          required: true
        },
        {
          name: 'end',
          description: '終了日時 (例: 2026-12-25 21:00 / 12/25 21:00, 未指定時は開始の2時間後)',
          required: false
        },
        { name: 'description', description: 'イベントの説明', required: false },
        {
          name: 'participants',
          description: 'リマインド対象のメンション文字列 (未指定なら対象なしで登録)',
          required: false
        }
      ]
    }
  ],
  normalizeToolArgs: {
    [EVENT_REMINDER_TOOL_NAME]: (args) => {
      const normalized: Record<string, unknown> = { ...args };

      if (typeof normalized.name === 'string') {
        normalized.name = normalized.name.trim();
      }
      if (typeof normalized.start === 'string') {
        normalized.start = normalizeDateTimeLikeInput(normalized.start);
      }
      if (typeof normalized.end === 'string') {
        normalized.end = normalizeDateTimeLikeInput(normalized.end);
      }
      if (typeof normalized.description === 'string') {
        normalized.description = normalized.description.trim();
      }
      if (typeof normalized.participants === 'string') {
        normalized.participants = normalized.participants.trim();
      }

      return normalized;
    }
  },
  handlers: {
    [EVENT_REMINDER_TOOL_NAME]: handleEventReminderTool
  },
  start: (client: Client) => {
    new EventReminderService(client).run();
  }
};

export default manifest;
