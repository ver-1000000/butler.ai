import 'dotenv/config';
import { ActivityType, Client, ClientUser, GatewayIntentBits, Partials, TextChannel } from 'discord.js';
import { DISCORD_TOKEN, NOTIFY_TEXT_CHANNEL_ID } from './core/environment';
import { NotifyVoiceChannelService } from './runtime/notify/notify-voice-channel.service';
import { AiAgentService } from './runtime/ai/agent.service';
import { AiConversationService } from './runtime/ai/conversation.service';
import { InteractiveService } from './runtime/ai/interactive.service';
import { ButlerCommandService } from './runtime/commands/butler-command.service';
import { registerSlashCommands } from './runtime/commands/slash-commands';
import { executeSlashCommandTool, getSlashCommandAiTools } from './runtime/commands/slash-command-tools';
import { bootstrapPlugins } from './plugins';

/** 起点となるメインのアプリケーションクラス。 */
class Main {
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
    console.log('ready - started worker server');
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
const bootstrap = () => {
  /** Discordクライアントを生成する。 */
  const createClient = (): Client => {
    const intents = [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildScheduledEvents,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
    ];
    const clientOptions = {
      intents,
      partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    };
    return new Client(clientOptions);
  };

  /** 起動に必要な依存関係を生成する。 */
  const createDependencies = () => {
    const aiAgentService = new AiAgentService(
      (call, context) => executeSlashCommandTool(call, context ?? {}),
      getSlashCommandAiTools(),
    );
    const aiConversationService = new AiConversationService();
    return {
      aiAgentService,
      aiConversationService,
    };
  };

  /** Runtimeサービスを起動する。 */
  const runRuntimeServices = (
    client: Client,
    deps: ReturnType<typeof createDependencies>,
  ) => {
    new NotifyVoiceChannelService(client).run();
    new InteractiveService(
      client,
      deps.aiAgentService,
      deps.aiConversationService,
    ).run();
    new ButlerCommandService(client).run();
  };

  const client = createClient();
  const deps = createDependencies();
  bootstrapPlugins(client);
  runRuntimeServices(client, deps);
  return new Main(client);
};

bootstrap().run();
