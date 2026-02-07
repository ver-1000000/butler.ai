import { Client, GuildScheduledEvent, GuildScheduledEventStatus, TextChannel } from 'discord.js';
import cron, { ScheduledTask } from 'node-cron';
import { NOTIFY_TEXT_CHANNEL_ID } from '../../core/environment';
import {
  BotMeta,
  ReminderTiming,
  parseBotMeta,
  updateDescriptionWithMeta,
  stripBotMeta
} from './bot-meta.model';
import { getTriggeredTimings, TIMING_LABELS } from './reminder-timing.util';

/** イベントリマインドの定期チェックと通知を行うサービス。 */
export class EventReminderService {
  private cronJob: ScheduledTask | null = null;

  constructor(private client: Client) {}

  /** サービスを開始する。 */
  run(): this {
    // 起動時に即座にチェック
    this.checkReminders().catch(e => console.error('初回リマインドチェック失敗:', e));

    // 5分毎に定期チェック
    this.cronJob = cron.schedule('*/5 * * * *', () => {
      this.checkReminders().catch(e => console.error('リマインドチェック失敗:', e));
    });

    console.log('EventReminderService: 起動しました');
    return this;
  }

  /** 全ギルドのイベントをチェックしてリマインドを送信する。 */
  private async checkReminders(): Promise<void> {
    const guilds = this.client.guilds.cache;

    for (const [, guild] of guilds) {
      try {
        const events = await guild.scheduledEvents.fetch();

        for (const [, event] of events) {
          if (event.status !== GuildScheduledEventStatus.Scheduled) continue;
          await this.processEvent(event);
        }
      } catch (error) {
        console.error(`ギルド ${guild.id} のリマインドチェック失敗:`, error);
      }
    }
  }

  /** 単一イベントのリマインド判定と処理を行う。 */
  private async processEvent(event: GuildScheduledEvent): Promise<void> {
    const meta = parseBotMeta(event.description);
    if (!meta) return;

    const startAt = event.scheduledStartAt;
    if (!startAt) return;

    const now = new Date();
    const triggeredTimings = getTriggeredTimings(startAt, now, meta.notified);

    if (triggeredTimings.length === 0) return;

    for (const timing of triggeredTimings) {
      await this.sendReminder(event, timing, meta);
      meta.notified[timing] = true;
    }

    await this.updateEventMeta(event, meta);
  }

  /** リマインド通知を送信する。 */
  private async sendReminder(
    event: GuildScheduledEvent,
    timing: ReminderTiming,
    meta: BotMeta
  ): Promise<void> {
    const channel = this.getNotifyChannel();
    if (!channel) {
      console.warn('通知チャンネルが見つかりません');
      return;
    }

    const startTimeStr = event.scheduledStartAt?.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const userDescription = stripBotMeta(event.description);
    const mentions = meta.participants.length > 0
      ? meta.participants.map(id => `<@${id}>`).join(' ')
      : '';

    const message = [
      `:bell: **イベントリマインド (${TIMING_LABELS[timing]})**`,
      ``,
      `**${event.name}**`,
      `開始: ${startTimeStr}`,
      userDescription ? `\n${userDescription}` : '',
      ``,
      mentions
    ].filter(line => line !== '').join('\n');

    try {
      await channel.send(message);
      console.log(`リマインド送信: ${event.name} (${timing})`);
    } catch (error) {
      console.error(`リマインド送信失敗: ${event.name}`, error);
    }
  }

  /** イベントのdescriptionを更新してnotifiedフラグを保存する。 */
  private async updateEventMeta(
    event: GuildScheduledEvent,
    meta: BotMeta
  ): Promise<void> {
    const newDescription = updateDescriptionWithMeta(
      stripBotMeta(event.description),
      meta
    );

    try {
      await event.edit({ description: newDescription });
    } catch (error) {
      console.error(`イベントメタ更新失敗: ${event.name}`, error);
    }
  }

  /** 通知チャンネルを取得する。 */
  private getNotifyChannel(): TextChannel | undefined {
    if (!NOTIFY_TEXT_CHANNEL_ID) return undefined;
    return this.client.channels.cache.get(NOTIFY_TEXT_CHANNEL_ID) as TextChannel | undefined;
  }
}
