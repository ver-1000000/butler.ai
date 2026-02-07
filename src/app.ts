import { ActivityType, Client, ClientUser, GatewayIntentBits, Partials, TextChannel } from 'discord.js';
import { DISCORD_TOKEN, NOTIFY_TEXT_CHANNEL_ID } from './core/environment';
import { NotifyVoiceChannelService } from './features/notify/notify-voice-channel.service';
import { AiAgentService } from './features/ai/agent.service';
import { AiConversationService } from './features/ai/conversation.service';
import { InteractiveService } from './features/ai/interactive.service';
import { ButlerCommandService } from './features/commands/butler-command.service';
import { registerSlashCommands } from './features/commands/slash-commands';
import { executeSlashCommandTool, getSlashCommandAiTools } from './features/commands/slash-command-tools';
import {
  registerPluginHandlers,
  registerPluginTools,
  startPlugins
} from './plugins';

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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildScheduledEvents
  ];
  const clientOptions = { intents, partials: [Partials.Message, Partials.Channel, Partials.Reaction] };
  return new Client(clientOptions);
};

/** 起動に必要な依存関係を生成する。 */
const createDependencies = (client: Client) => {
  const aiAgentService = new AiAgentService(
    call => executeSlashCommandTool(call),
    getSlashCommandAiTools()
  );
  const aiConversationService = new AiConversationService();
  return {
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
  new InteractiveService(client, deps.aiAgentService, deps.aiConversationService).run();
  new ButlerCommandService(client).run();
};

/** 依存を解決しつつアプリケーションを起動する。 */
const bootstrap = () => {
  registerPluginTools();
  const client = createClient();
  registerPluginHandlers(client);
  const deps = createDependencies(client);
  runFeatureServices(client, deps);
  startPlugins(client);
  return new App(client);
};

bootstrap().run();
