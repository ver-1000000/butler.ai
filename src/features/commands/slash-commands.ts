import { Client, SlashCommandBuilder } from 'discord.js';
import { DISCORD_GUILD_ID } from '../../core/environment';
import { ADD_EVENT_COMMAND } from '../event-reminder/add-event.command';

/** Discordへ登録するスラッシュコマンド定義。 */
export const SLASH_COMMANDS = [
  new SlashCommandBuilder()
    .setName('butler')
    .setDescription('butlerを呼び出す'),
  ADD_EVENT_COMMAND
].map(command => command.toJSON());

/**
 * スラッシュコマンドをDiscordへ登録する。
 * @param client Discordクライアント
 */
export async function registerSlashCommands(client: Client): Promise<void> {
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
