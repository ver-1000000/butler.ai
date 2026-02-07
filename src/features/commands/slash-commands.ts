import { Client, SlashCommandBuilder } from 'discord.js';
import { DISCORD_GUILD_ID } from '../../core/environment';
import { getSlashCommandTools, toSlashSubcommandName } from './slash-command-tools';

const buildSlashCommands = () => {
  const root = new SlashCommandBuilder()
    .setName('butler')
    .setDescription('butlerを呼び出す');

  for (const tool of getSlashCommandTools()) {
    root.addSubcommand(subcommand => {
      subcommand
        .setName(toSlashSubcommandName(tool.name))
        .setDescription(tool.description);
      for (const arg of tool.arguments) {
        subcommand.addStringOption(option =>
          option.setName(arg.name).setDescription(arg.description).setRequired(arg.required)
        );
      }
      return subcommand;
    });
  }

  return [root.toJSON()];
};

/**
 * スラッシュコマンドをDiscordへ登録する。
 * @param client Discordクライアント
 */
export async function registerSlashCommands(client: Client): Promise<void> {
  if (!client.application) { return; }
  try {
    const slashCommands = buildSlashCommands();
    if (DISCORD_GUILD_ID) {
      const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
      await guild.commands.set(slashCommands);
      console.log(`registered guild commands: ${guild.id}`);
      return;
    }
    await client.application.commands.set(slashCommands);
    console.log('registered global commands');
  } catch (error) {
    console.error('failed to register slash commands', error);
  }
}
