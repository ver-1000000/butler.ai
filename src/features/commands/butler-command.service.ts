import type { ChatInputCommandInteraction, Client } from 'discord.js';
import {
  executeSlashCommandTool,
  fromSlashSubcommandName,
  getSlashCommandTool
} from './slash-command-tools';

/** /butler スラッシュコマンドのルーティングを担当するサービス。 */
export class ButlerCommandService {
  constructor(private client: Client) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('interactionCreate', interaction => {
      if (!interaction.isChatInputCommand()) { return; }
      if (interaction.commandName !== 'butler') { return; }
      this.handle(interaction);
    });
  }

  /** /butler コマンドを処理する。 */
  private async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const toolName = fromSlashSubcommandName(subcommand);
    const tool = getSlashCommandTool(toolName);

    if (!tool) {
      await interaction.reply({
        content: `未対応のコマンドです: ${subcommand}`,
        ephemeral: true
      });
      return;
    }

    const args: Record<string, unknown> = {};
    for (const arg of tool.arguments) {
      const value = interaction.options.getString(arg.name);
      if (value != null) {
        args[arg.name] = value;
      }
    }

    if (tool.arguments.some(arg => arg.name === 'created_by')) {
      args.created_by = interaction.user.id;
    }

    if (tool.arguments.some(arg => arg.name === 'guild_id') && interaction.guildId) {
      args.guild_id = interaction.guildId;
    }

    const result = await executeSlashCommandTool({
      name: toolName,
      arguments: args
    });

    await interaction.reply({
      content: result,
      ephemeral: false
    });
  }
}
