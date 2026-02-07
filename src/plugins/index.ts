import type { Client } from "discord.js";
import {
  registerSlashCommandTool,
  registerSlashCommandToolHandler,
} from "../runtime/commands/slash-command-tools";
import type { PluginManifest, PluginToolContext } from "./manifest.types";
import eventReminder from "./event-reminder/manifest";
import notifyVoiceChannel from "./notify-voice-channel/manifest";

/**
 * プラグイン層のエントリポイント。
 * 各プラグインのマニフェストを読み取り、/butler と AI が共有する
 * ツールレジストリ(src/runtime/commands/slash-command-tools.ts)へ橋渡しする。
 * あわせて、プラグイン固有の起動処理(start)もここで一括実行する。
 */

/**
 * 起動対象のプラグイン一覧。
 */
const plugins: PluginManifest[] = [eventReminder, notifyVoiceChannel];

/**
 * プラグイン基盤の初期化を一括で実行する公開API。
 * 呼び出し元: src/main.ts の bootstrap()。
 */
export const bootstrapPlugins = (client: Client): void => {
  /**
   * 全プラグインのツール定義をグローバルレジストリへ登録する。
   */
  const registerPluginTools = (): void => {
    for (const plugin of plugins) {
      for (const tool of plugin.tools ?? []) {
        registerSlashCommandTool(tool, undefined, { aiHint: plugin.aiPolicy });
      }
    }
  };
  /**
   * 全プラグインのツール実行ハンドラをグローバルレジストリへ登録する。
   * 実行時に渡された context と client をマージして各プラグインへ渡す。
   */
  const registerPluginHandlers = (client: Client): void => {
    for (const plugin of plugins) {
      const handlers = plugin.handlers ?? {};
      for (const [name, handler] of Object.entries(handlers)) {
        registerSlashCommandToolHandler(name, async (args, context) => {
          const mergedContext: PluginToolContext = { client, ...context };
          const normalizer = plugin.normalizeToolArgs?.[name];
          const normalizedArgs = normalizer
            ? await normalizer(args, mergedContext)
            : args;
          return handler(normalizedArgs, mergedContext);
        });
      }
    }
  };
  /** 全プラグインの起動処理(start)を実行する。 */
  const startPlugins = (client: Client): void => {
    for (const plugin of plugins) {
      plugin.start?.(client);
    }
  };
  registerPluginTools();
  registerPluginHandlers(client);
  startPlugins(client);
};
