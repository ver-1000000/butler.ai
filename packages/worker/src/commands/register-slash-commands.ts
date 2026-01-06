import { Client } from 'discord.js';

import { DISCORD_GUILD_ID } from '@butler/core';
import { SLASH_COMMANDS } from './slash-commands';

export async function registerSlashCommands(client: Client) {
  if (!client.application) { return; }
  try {
    if (DISCORD_GUILD_ID) {
      const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
      await guild.commands.set(SLASH_COMMANDS);
      console.log(`registered guild commands: ${guild.id}`);
      return;
    }
    await client.application.commands.set(SLASH_COMMANDS);
    console.log('registered global commands');
  } catch (error) {
    console.error('failed to register slash commands', error);
  }
}
