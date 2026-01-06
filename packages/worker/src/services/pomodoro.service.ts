import { ActivityType, MessageReaction, Client, Message, User, VoiceChannel, VoiceState, TextChannel, type MessageCreateOptions } from 'discord.js';
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, DiscordGatewayAdapterCreator, joinVoiceChannel } from '@discordjs/voice';
import { schedule } from 'node-cron';

import { NOTIFY_TEXT_CHANNEL_ID, POMODORO_VOICE_CHANNEL_ID } from '@butler/core';
import { PrettyText } from '../utils/pretty-text.util';
import { PomodoroStatus } from '../models/pomodoro-status.model';
import { sendToChannel } from '../utils/discord.util';

/** デバッグモードフラグ。 */
const DEBUG = false;
/** 1ポモドーロに要する全体の時間。 */
const POMODORO_DURATION = DEBUG ? 2 : 30;
/** POMODORO_DURATIONのうちの作業時間。 */
const POMODORO_WORK_DURATION = DEBUG ? 1 : 25;

/** `GenerateText.help`に食わせるヘルプ文の定数。 */
const HELP = {
  DESC: [
    '`!pomodoro` コマンド - 音声チャンネルを利用した**ポモドーロタイマー**機能',
    '(**ポモドーロタイマー用音声チャンネルに参加した状態**で、以下のコマンドを利用)'
  ].join('\n'),
  ITEMS: [
    ['!pomodoro.start', 'ポモドーロタイマーを開始(リセット)します'],
    ['!pomodoro.stop', 'ポモドーロタイマーを終了します'],
    ['!pomodoro.status', '現在のポモドーロステータスを表示します'],
    ['!pomodoro.help', '`!pomodoro` コマンドのヘルプを表示します(エイリアス: `!pomodoro`)']
  ]
} as const;

/** ポモドーロタイマー機能を提供するアプリケーションクラス。 */
export class PomodoroService {
  status = new PomodoroStatus();
  player = createAudioPlayer();

  /** ポモドーロ用音声チャンネルの取得。 */
  private get voiceChannel() {
    return this.client.channels.cache.get(POMODORO_VOICE_CHANNEL_ID || '') as VoiceChannel | undefined;
  }

  constructor(private client: Client) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('clientReady', async () => {
      await this.setMute(false);
      this.restart();
    });
    this.client.on('voiceStateUpdate', (oldState, newState) => this.onVoiceStateUpdate(oldState, newState));
    this.client.on('messageCreate', message => this.onMessage(message));
    return this;
  }

  /** Messageから各処理を呼び出すFacade関数。 */
  private onMessage(message: Message) {
    const content = message.content;
    if (message.author.bot) { return; } // botの発言は無視
    if (content.startsWith('!pomodoro.start')) { this.start(message); };
    if (content.startsWith('!pomodoro.stop')) { this.stop(message); };
    if (content.startsWith('!pomodoro.status')) { this.sendPrettyStatus(message); };
    if (content.startsWith('!pomodoro.help') || content === '!pomodoro') { this.help(message); };
  }

  /**
   * `voiceStateUpdate`イベントの`oldState`と`newState`の状態から、ポモドーロ用音声チャンネルの出入りを検知し、
   * ミュートの状態を適宜切り替える。
   * これにより、作業中に入退室したメンバーのミュート状態を最新に保つ。
   */
  private onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    if (newState.member?.user.bot) { return; }
    const changeChannel       = oldState.channel !== newState.channel;
    const fromPomodoroChannel = oldState.channelId === POMODORO_VOICE_CHANNEL_ID;
    const toPomodoroChannel   = newState.channelId === POMODORO_VOICE_CHANNEL_ID;
    if (changeChannel && toPomodoroChannel) { newState.setMute(!this.status.rest); }
    if (changeChannel && fromPomodoroChannel && newState.channel) { newState.setMute(false); }
  }

  /** cronの通知を監視する。 `this.status.spent`を加算していき、`this.status`の値の内容で様々な副作用を呼び起こす。 */
  private onSchedule() {
    this.status.spent++;
    if (DEBUG) { console.log({ ...this.status, task: !!this.status.task }); }
    if (this.status.spent === POMODORO_WORK_DURATION) { this.doRest(); }
    if (this.status.spent === POMODORO_DURATION) { this.doWork(); }
  }

  /** `this.status`を初期化し、ポモドーロタイマーを起動させて発言通知する。 */
  private start({ channel }: Message) {
    this.status.reset();
    this.status.startAt = ((d: Date) => { d.setSeconds(0); return d })(new Date());
    this.status.task  = schedule('* * * * *', () => this.onSchedule());
    this.doWork();
    sendToChannel(channel, `ポモドーロを開始します:timer: **:loudspeaker:${this.voiceChannel?.name}** に参加して、作業を始めてください:fire:`);
    this.client.user?.setPresence({ activities: [{ name: 'ポモドーロ', type: ActivityType.Playing }] });
  }

  /** PomodoroService起動時に`this.status.startAt`が設定されている時、中断からの復帰を行う。 */
  private restart() {
    if (this.status.startAt == null) { return; }
    this.status.task    = schedule('* * * * *', () => this.onSchedule());
    const notifyChannel = this.client.channels.cache.get(NOTIFY_TEXT_CHANNEL_ID || '') as TextChannel | undefined;
    this.setMute(!this.status.rest);
    notifyChannel?.send(
      `:warning: なにか問題があり停止してしまったため、ポモドーロを再開しました。\n` +
        `現在、_** ${this.status.wave} 回目 ${this.status.spent} 分経過、${this.status.rest ? '休憩' : '作業'}中**_です。`
    );
    this.client.user?.setPresence({ activities: [{ name: '🍅ポモドーロ', type: ActivityType.Playing }] });
  }

  /** ポモドーロタイマーを終了/停止させて発言通知する。 */
  private async stop({ channel }: Message) {
    this.status.reset();
    await this.setMute(false);
    sendToChannel(channel, 'ポモドーロを終了します:timer: お疲れ様でした:island:');
    this.client.user?.setPresence({ activities: [{ name: 'みんなの発言', type: ActivityType.Watching }] });
  }

  /** ステータスをユーザーフレンドリーな文字列として整形した値をメッセージとして発言通知する。 */
  private sendPrettyStatus({ channel }: Message) {
    const date = this.status.startAt?.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const text = `
    **タイマー開始日時: **_${date ? date + ' :timer:' : '停止中:sleeping:'}_
    **ポモドーロタイマー: **_${this.status.wave} 回目 ${this.status.spent % POMODORO_DURATION} 分経過_
    **ポモドーロの状態: **_${this.status.startAt ? this.status.rest ? '休憩中:island:' : '作業中:fire:' : '停止中:sleeping:'}_
    `.replace(/\n\s*/g, '\n');
    sendToChannel(channel, text);
  }

  /** ヘルプを発言通知する。 */
  private async help({ channel }: Message) {
    const text    = PrettyText.helpList(HELP.DESC, ...HELP.ITEMS);
    const message = await sendToChannel(channel, text);
    if (!message) { return; }
    this.commandsEmoji(message);
  }

  /** メッセージへのリアクションからコマンドを実行するための関数。 */
  private async commandsEmoji(message: Message) {
    const EMOJIS = { ONE: '1️⃣', TWO: '2️⃣', THREE: '3️⃣' };
    await Promise.all(Object.values(EMOJIS).map(async name => await message.react(name)));
    const time       = 60000;
    const additional =
      `\n\n**${Math.round(time / 1000)}秒以内にこのメッセージへ、以下のリアクション(絵文字)を行うことでもコマンドを実行できます。**\n` +
      PrettyText.code('1️⃣ !pomodoro.start! / 2️⃣ !pomodoro.stop / 3️⃣ !pomodoro.status');
    await message.edit(message.content + additional);
    const filter   = (reaction: MessageReaction, _: User) => Object.values(EMOJIS).includes(reaction.emoji?.name || '');
    const reaction = (await message.awaitReactions({ filter, max: 1, time }))?.first();
    await message.reactions.removeAll();
    await message.edit(message.content.replace(additional, ''));
    if (reaction?.emoji?.name) { await sendToChannel(message.channel, `---\n${reaction.emoji.name}を選択しました。\n---`); }
    if (reaction?.emoji?.name === EMOJIS.ONE) { this.start(message); }
    if (reaction?.emoji?.name === EMOJIS.TWO) { this.stop(message); }
    if (reaction?.emoji?.name === EMOJIS.THREE) { this.sendPrettyStatus(message); }
  }

  /** ポモドーロの作業時間開始を行う関数。 */
  private async doWork() {
    this.status.wave++;
    this.status.spent = 0;
    this.status.rest  = false;
    await this.setMute(false);
    await this.playSound('src/assets/begin-work.ogg');
    await this.setMute(true);
  }

  /** ポモドーロの作業時間終了を行う関数。 */
  private async doRest() {
    this.status.rest = true;
    await this.setMute(false);
    await this.playSound('src/assets/begin-rest.ogg');
  }

  /** `input`のパスにある音声ファイルを再生する。 */
  private async playSound(input: string) {
    if (this.voiceChannel == null) { return; }
    const connection   = joinVoiceChannel({
      channelId: this.voiceChannel.id,
      guildId: this.voiceChannel.guildId,
      adapterCreator: this.voiceChannel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
    });
    this.player.play(createAudioResource(input));
    connection.subscribe(this.player);
    const promise = new Promise(resolve => this.player.on(AudioPlayerStatus.Idle, () => resolve(null))).then(async result => {
      if (DEBUG) { this.sendPrettyStatus({ channel: await this.client.channels.fetch(NOTIFY_TEXT_CHANNEL_ID || '') } as Message); }
      return result;
    });
    return promise;
  }

  /**
   * `this.voiceChannel`のミュート状態を変更する。
   * - `member.voice.connection`を確認することで、Promiseの解決中に離脱したユーザーをミュートして例外が発生するのを防ぐ
   */
  private setMute(mute: boolean) {
    return Promise.all(this.voiceChannel?.members.map(member => member.voice.channel ? member.voice.setMute(mute) : member) || []);
  }
}
