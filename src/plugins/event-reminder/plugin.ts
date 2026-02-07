import type { Client, TextChannel } from 'discord.js';
import { NOTIFY_TEXT_CHANNEL_ID } from '../../core/environment';
import type { PluginManifest } from '../plugin-types';
import { createEventReminder } from './add-event.command';
import { EventReminderService } from './event-reminder.service';

const EVENT_REMINDER_TOOL_NAME = 'event_reminder_add';

const resolveGuildId = (client: Client, guildId?: string): string | null => {
  if (guildId) return guildId;
  if (!NOTIFY_TEXT_CHANNEL_ID) return null;
  const channel = client.channels.cache.get(NOTIFY_TEXT_CHANNEL_ID) as TextChannel | undefined;
  return channel?.guild?.id ?? null;
};

const manifest: PluginManifest = {
  id: 'event-reminder',
  tools: [
    {
      name: EVENT_REMINDER_TOOL_NAME,
      description: 'イベントとリマインドを登録する',
      arguments: [
        { name: 'name', description: 'イベント名', required: true },
        { name: 'start', description: '開始日時 (例: 2024-12-25 19:00)', required: true },
        { name: 'end', description: '終了日時 (例: 2024-12-25 21:00)', required: false },
        { name: 'description', description: 'イベントの説明', required: false },
        { name: 'participants', description: 'リマインド対象のメンション文字列', required: false },
        { name: 'guild_id', description: 'ギルドID (未指定時は通知チャンネルから推測)', required: false },
        { name: 'created_by', description: '作成者のユーザーID', required: false }
      ]
    }
  ],
  handlers: {
    [EVENT_REMINDER_TOOL_NAME]: async (args, context) => {
      const name = typeof args.name === 'string' ? args.name : '';
      const start = typeof args.start === 'string' ? args.start : '';
      const end = typeof args.end === 'string' ? args.end : null;
      const description = typeof args.description === 'string' ? args.description : '';
      const participants = typeof args.participants === 'string' ? args.participants : null;
      const guildIdValue = typeof args.guild_id === 'string' ? args.guild_id : null;
      const createdBy = typeof args.created_by === 'string' ? args.created_by : 'unknown';

      const guildId = resolveGuildId(context.client, guildIdValue ?? undefined);
      if (!guildId) {
        return 'ギルドIDが取得できません。`guild_id` を指定してください。';
      }

      const guild = await context.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return 'ギルドの取得に失敗しました。`guild_id` を確認してください。';
      }

      const result = await createEventReminder(guild, {
        name,
        start,
        end,
        description,
        participants,
        createdBy
      });

      return result.message;
    }
  },
  start: (client: Client) => {
    new EventReminderService(client).run();
  }
};

export default manifest;
