import type { Client } from 'discord.js';
import type { SlashCommandToolDefinition } from '../runtime/commands/slash-command-tools';

/**
 * ツール実行時にフレームワーク側から渡される実行コンテキスト。
 * 利用箇所: src/plugins/index.ts で組み立てられ、各プラグインの handlers に渡される。
 */
export type PluginToolContext = {
  /** Discordクライアント本体。 */
  client: Client;
  /** 実行元サーバーのギルドID。DM等で取得できない場合はundefined。 */
  guildId?: string;
  /** 実行者のユーザーID。取得できない場合はundefined。 */
  userId?: string;
};

/**
 * プラグインが提供するツール実行関数のシグネチャ。
 * args はツール定義で宣言した引数、context は実行時コンテキスト。
 * 利用箇所: src/plugins/event-reminder/manifest.ts などの handlers 定義。
 */
export type PluginToolHandler = (
  args: Record<string, unknown>,
  context: PluginToolContext
) => Promise<string>;

/**
 * プラグインをフレームワークへ登録するためのマニフェスト。
 * 利用箇所:
 * - src/plugins/index.ts の plugins 配列に格納される
 * - src/main.ts から bootstrapPlugins 経由で消費される
 */
export type PluginManifest = {
  /** プラグインの一意な識別子。 */
  id: string;
  /** AIおよび /butler サブコマンドへ公開するツール定義一覧。 */
  tools?: SlashCommandToolDefinition[];
  /** tools の name と対応付く実行ハンドラ群。 */
  handlers?: Record<string, PluginToolHandler>;
  /** Bot起動時に一度だけ実行する初期化処理。cron起動などに利用する。 */
  start?: (client: Client) => void;
};
