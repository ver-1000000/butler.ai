import type { Client } from 'discord.js';
import type { PluginManifest } from '../manifest.types';
import { handleEventReminderTool } from './event-reminder.handler';
import { EventReminderService } from './event-reminder.service';

const EVENT_REMINDER_TOOL_NAME = 'event-reminder';

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
    [EVENT_REMINDER_TOOL_NAME]: handleEventReminderTool
  },
  start: (client: Client) => {
    new EventReminderService(client).run();
  }
};

export default manifest;
