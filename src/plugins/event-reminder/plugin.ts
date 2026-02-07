import type { Client } from 'discord.js';
import type { PluginManifest } from '../plugin-types';
import { createEventReminder } from './add-event.command';
import { EventReminderService } from './event-reminder.service';

const EVENT_REMINDER_TOOL_NAME = 'event_reminder';

const resolveGuildId = async (client: Client, guildId?: string): Promise<string | null> => {
  if (guildId) return guildId;

  if (client.guilds.cache.size > 0) {
    return client.guilds.cache.first()?.id ?? null;
  }

  const guilds = await client.guilds.fetch().catch(() => null);
  if (!guilds || guilds.size === 0) {
    return null;
  }

  return guilds.first()?.id ?? null;
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
        { name: 'participants', description: 'リマインド対象のメンション文字列', required: false }
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
      const createdBy = context.userId ?? 'unknown';

      const guildId = await resolveGuildId(context.client, context.guildId);
      if (!guildId) {
        return 'サーバー情報の取得に失敗しました。';
      }

      const guild = await context.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return 'サーバー情報の取得に失敗しました。';
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
