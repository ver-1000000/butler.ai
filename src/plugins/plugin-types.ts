import type { Client } from 'discord.js';
import type { SlashCommandToolDefinition } from '../features/commands/slash-command-tools';

export type PluginToolContext = {
  client: Client;
};

export type PluginToolHandler = (
  args: Record<string, unknown>,
  context: PluginToolContext
) => Promise<string>;

export type PluginManifest = {
  id: string;
  tools?: SlashCommandToolDefinition[];
  handlers?: Record<string, PluginToolHandler>;
  start?: (client: Client) => void;
};
