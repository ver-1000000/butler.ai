import type { PluginToolHandler } from '../manifest.types';
import { createEventReminder } from './create-event-reminder.usecase';

/**
 * manifest.tsで利用する、event-reminderツールの実行を担当するハンドラ。
 * 実行コンテキストを検証し、入力を正規化してイベント作成ユースケースへ委譲する。
 */
export const handleEventReminderTool: PluginToolHandler = async (args, context) => {
  if (!context.guildId) {
    return 'この機能はサーバー内でのみ利用できます。';
  }

  const name = typeof args.name === 'string' ? args.name : '';
  const start = typeof args.start === 'string' ? args.start : '';
  const end = typeof args.end === 'string' ? args.end : null;
  const description = typeof args.description === 'string' ? args.description : '';
  const participants = typeof args.participants === 'string' ? args.participants : null;
  const createdBy = context.userId ?? 'unknown';

  try {
    const guild =
      context.client.guilds.cache.get(context.guildId) ??
      await context.client.guilds.fetch(context.guildId);

    const result = await createEventReminder(guild, {
      name,
      start,
      end,
      description,
      participants,
      createdBy
    });

    return result.message;
  } catch (error) {
    console.error('event-reminder tool execution failed:', error);
    return 'イベント処理に失敗しました。時間をおいて再度お試しください。';
  }
};
