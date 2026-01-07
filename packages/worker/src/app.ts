import { ActivityType, Client, ClientUser, GatewayIntentBits, Partials, TextChannel } from 'discord.js';
import { DISCORD_TOKEN, NOTIFY_TEXT_CHANNEL_ID } from '@butler/core';
import { MemosStore } from './stores/memos.store';
import { StickersStore } from './stores/stickers.store';
import { NotifyVoiceChannelService } from './services/notify-voice-channel.service';
import { MemoService } from './services/memo.service';
import { PomodoroService } from './services/pomodoro.service';
import { InteractiveService } from './services/interactive.service';
import { WikipediaService } from './services/wikipedia.service';
import { StickerService } from './services/sticker.service';
import { registerSlashCommands } from './commands/slash-commands';
import { AiAgentService, AiConversationService } from './services/ai-agent.service';
import { executeSlashCommandTool, getSlashCommandAiTools } from './commands/slash-command-tools';

/** 起点となるメインのアプリケーションクラス。 */
class App {
  constructor(private client: Client) {}

  /** アプリケーションクラスを起動する。 */
  run() {
    this.confirmToken();
    this.setupShutdownHandlers();
    this.client.on('clientReady', async () => {
      this.initializeBotStatus(this.client.user);
      await registerSlashCommands(this.client);
    });
    this.client.on('error', e => this.error(e));
    this.client.login(DISCORD_TOKEN);
  }

  /** DISCORD_TOKENが設定されていなければ異常終了させる。 */
  private confirmToken() {
    if (DISCORD_TOKEN) return;
    console.log('DISCORD_TOKENが設定されていません。');
    process.exit(1);
  }

  /** readyイベントにフックして、ボットのステータスなどを設定する。 */
  private initializeBotStatus(user: ClientUser | null) {
    console.log(`ready - started worker server`);
    if (user) console.log(`logged in as ${user.tag} (${user.id})`);
    user?.setPresence({ activities: [{ name: 'みんなの発言', type: ActivityType.Watching }] });
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

  /** 終了時にDiscord接続を閉じてステータスを落とす。 */
  private setupShutdownHandlers() {
    const shutdown = (signal: NodeJS.Signals) => {
      console.log(`shutdown - received ${signal}`);
      Promise.resolve()
        .then(() => this.client.destroy())
        .catch(error => console.error('shutdown error', error))
        .finally(() => process.exit(0));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}

/** 依存を解決しつつアプリケーションを起動する。 */
(() => {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ];
  /** Discordクライアントの起動設定 */
  const clientOptions = { intents, partials: [Partials.Message, Partials.Channel, Partials.Reaction] };
  const client      = new Client(clientOptions);
  const memosStore  = new MemosStore();
  const entityStore = new StickersStore();
  const pomodoroService = new PomodoroService(client);
  const toolContext = { memosStore, stickersStore: entityStore, pomodoroService };
  const aiAgentService = new AiAgentService(
    call => executeSlashCommandTool(call, toolContext),
    getSlashCommandAiTools()
  );
  const aiConversationService = new AiConversationService();
  new NotifyVoiceChannelService(client).run();
  new MemoService(client, memosStore).run();
  pomodoroService.run();
  new InteractiveService(client, aiAgentService, aiConversationService).run();
  new WikipediaService(client).run();
  new StickerService(client, entityStore).run();
  new App(client).run();
})();
