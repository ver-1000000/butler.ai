import { Client, ClientUser, Intents, TextChannel } from 'discord.js';
import type { RequestInfo, RequestInit, Response } from 'node-fetch';

import { DISCORD_TOKEN, NOTIFY_TEXT_CHANNEL_ID } from '@butler/core';
import { MemosStore } from './stores/memos.store';
import { StickersStore } from './stores/stickers.store';

import { NotifyVoiceChannelService } from './services/notify-voice-channel.service';
import { MemoService } from './services/memo.service';
import { PomodoroService } from './services/pomodoro.service';
import { InteractiveService } from './services/interactive.service';
import { WikipediaService } from './services/wikipedia.service';
import { StickerService } from './services/sticker.service';

/** 起点となるメインのアプリケーションクラス。 */
class App {
  constructor(private client: Client) {}

  /** アプリケーションクラスを起動する。 */
  run() {
    this.confirmToken();
    this.wakeUpHost();
    this.client.on('ready', () => this.initializeBotStatus(this.client.user));
    this.client.on('error', e => this.error(e));
    this.client.login(DISCORD_TOKEN);
  }

  /** DISCORD_TOKENが設定されていなければ異常終了させる。 */
  private confirmToken() {
    if (DISCORD_TOKEN) { return; }
    console.log('DISCORD_TOKENが設定されていません。');
    process.exit(1);
  }

  /** WAKEUP_URLが環境変数で設定されている場合、定期的にGETリクエストを送ることでホストのsleepを防ぐ。 */
  private wakeUpHost() {
    type FetchFn = (url: RequestInfo, init?: RequestInit) => Promise<Response>;
    const fetch: FetchFn = (url, init) =>
      import('node-fetch').then(({ default: fetch }) => fetch(url, init));
    const url = process.env.WAKEUP_URL || '';
    if (url === '') { return; }
    const interval = 10 * Number(process.env.WAKEUP_INTERVAL || '60') * 1000; // default: 10min
    setInterval(() => fetch(url), interval);
  }

  /** readyイベントにフックして、ボットのステータスなどを設定する。 */
  private initializeBotStatus(user: ClientUser | null) {
    console.log(`ready - started worker server`);
    user?.setPresence({ activities: [{ name: 'みんなの発言', type: 'WATCHING' }] });
  }

  /** Discord.jsからエラーイベントを受け取った時、Discordに通知する。 */
  private error(e: Error) {
    this.send(`:skull_crossbones: \`(${e.name})\``);
  }

  /** 通知チャンネルにメッセージを送信する。 */
  private send(msg: string) {
    const notifyChannel = this.client.channels.cache.get(NOTIFY_TEXT_CHANNEL_ID || '') as TextChannel | undefined;
    notifyChannel?.send(msg);
  }
}

/** 依存を解決しつつアプリケーションを起動する。 */
(() => {
  const intents = [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS
  ];
  const client      = new Client({ intents });
  const memosStore  = new MemosStore();
  const entityStore = new StickersStore();
  new NotifyVoiceChannelService(client).run();
  new MemoService(client, memosStore).run();
  new PomodoroService(client).run();
  new InteractiveService(client).run();
  new WikipediaService(client).run();
  new StickerService(client, entityStore).run();
  new App(client).run();
})();
