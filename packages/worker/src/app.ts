import { ActivityType, Client, ClientUser, GatewayIntentBits, Partials, TextChannel } from 'discord.js';
import { DISCORD_TOKEN, NOTIFY_TEXT_CHANNEL_ID } from '@butler/core';
import { MemosStore } from './features/memo/memo.store';
import { MemoService } from './features/memo/memo.service';
import { StickersStore } from './features/sticker/sticker.store';
import { StickerService } from './features/sticker/sticker.service';
import { NotifyVoiceChannelService } from './features/notify/notify-voice-channel.service';
import { PomodoroService } from './features/pomodoro/pomodoro.service';
import { AiAgentService } from './features/ai/agent.service';
import { AiConversationService } from './features/ai/conversation.service';
import { InteractiveService } from './features/ai/interactive.service';
import { WikipediaService } from './features/wiki/wiki.service';
import { registerSlashCommands } from './features/commands/slash-commands';
import type { SlashCommandToolContext } from './features/commands/slash-command-tools';
import { executeSlashCommandTool, getSlashCommandAiTools } from './features/commands/slash-command-tools';

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

/** Discordクライアントを生成する。 */
const createClient = (): Client => {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ];
  const clientOptions = { intents, partials: [Partials.Message, Partials.Channel, Partials.Reaction] };
  return new Client(clientOptions);
};

/** 起動に必要な依存関係を生成する。 */
const createDependencies = (client: Client) => {
  const memosStore = new MemosStore();
  const stickersStore = new StickersStore();
  const pomodoroService = new PomodoroService(client);
  const toolContext: SlashCommandToolContext = { memosStore, stickersStore, pomodoroService };
  const aiAgentService = new AiAgentService(
    call => executeSlashCommandTool(call, toolContext),
    getSlashCommandAiTools()
  );
  const aiConversationService = new AiConversationService();
  return {
    memosStore,
    stickersStore,
    pomodoroService,
    aiAgentService,
    aiConversationService
  };
};

/** Featureサービスを起動する。 */
const runFeatureServices = (
  client: Client,
  deps: ReturnType<typeof createDependencies>
) => {
  new NotifyVoiceChannelService(client).run();
  new MemoService(client, deps.memosStore).run();
  deps.pomodoroService.run();
  new InteractiveService(client, deps.aiAgentService, deps.aiConversationService).run();
  new WikipediaService(client).run();
  new StickerService(client, deps.stickersStore).run();
};

/** 依存を解決しつつアプリケーションを起動する。 */
const bootstrap = () => {
  const client = createClient();
  const deps = createDependencies(client);
  runFeatureServices(client, deps);
  return new App(client);
};

bootstrap().run();
