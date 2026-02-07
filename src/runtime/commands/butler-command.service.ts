import type { ChatInputCommandInteraction, Client } from 'discord.js';
import {
  executeSlashCommandTool,
  getSlashCommandTools
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
    const toolName = interaction.options.getSubcommand();
    const tool = getSlashCommandTools().find(item => item.name === toolName);

    if (!tool) {
      await interaction.reply({
        content: `未対応のコマンドです: ${toolName}`,
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

    const result = await executeSlashCommandTool(
      { name: toolName, arguments: args },
      { guildId: interaction.guildId ?? undefined, userId: interaction.user.id }
    );

    await interaction.reply({
      content: result,
      ephemeral: false
    });
  }
}
