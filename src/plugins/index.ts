import type { Client } from "discord.js";
import {
  registerSlashCommandTool,
  registerSlashCommandToolHandler,
} from "../features/commands/slash-command-tools";
import type { PluginManifest, PluginToolContext } from "./plugin-types";
import eventReminder from "./event-reminder/plugin";

/**
 * 起動対象のプラグイン一覧。
 */
const plugins: PluginManifest[] = [eventReminder];

/**
 * プラグイン基盤の初期化を一括で実行する公開API。
 * 呼び出し元: src/app.ts の bootstrap()。
 */
export const bootstrapPlugins = (client: Client): void => {
  /**
   * 全プラグインのツール定義をグローバルレジストリへ登録する。
   */
  const registerPluginTools = (): void => {
    for (const plugin of plugins) {
      for (const tool of plugin.tools ?? []) {
        registerSlashCommandTool(tool);
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
        registerSlashCommandToolHandler(name, (args, context) => {
          const mergedContext: PluginToolContext = { client, ...context };
          return handler(args, mergedContext);
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
