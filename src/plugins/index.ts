import type { Client } from 'discord.js';
import {
  registerSlashCommandTool,
  registerSlashCommandToolHandler
} from '../features/commands/slash-command-tools';
import type { PluginManifest, PluginToolContext } from './plugin-types';
import eventReminder from './event-reminder/plugin';

const plugins: PluginManifest[] = [eventReminder];

export const registerPluginTools = (): void => {
  for (const plugin of plugins) {
    for (const tool of plugin.tools ?? []) {
      registerSlashCommandTool(tool);
    }
  }
};

export const registerPluginHandlers = (client: Client): void => {
  const context: PluginToolContext = { client };
  for (const plugin of plugins) {
    const handlers = plugin.handlers ?? {};
    for (const [name, handler] of Object.entries(handlers)) {
      registerSlashCommandToolHandler(name, args => handler(args, context));
    }
  }
};

export const startPlugins = (client: Client): void => {
  for (const plugin of plugins) {
    plugin.start?.(client);
  }
};
