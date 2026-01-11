import type { AiToolCall, AiToolDefinition } from '../../core/ai-provider';

/** スラッシュコマンドの引数定義。 */
export type SlashCommandToolArgument = {
  name: string;
  description: string;
  required: boolean;
};

/**
 * AIに公開するスラッシュコマンドのツール定義。
 */
export type SlashCommandToolDefinition = {
  name: string;
  description: string;
  arguments: SlashCommandToolArgument[];
};

/**
 * 現時点でAIに公開するスラッシュコマンドのツール一覧を返す。
 */
export const getSlashCommandTools = (): SlashCommandToolDefinition[] => {
  return [];
};

/**
 * スラッシュコマンド定義をAIツール定義に変換する。
 */
export const getSlashCommandAiTools = (): AiToolDefinition[] => {
  return getSlashCommandTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: tool.arguments.reduce<Record<string, { type: 'string'; description?: string }>>(
        (acc, arg) => {
          acc[arg.name] = { type: 'string', description: arg.description };
          return acc;
        },
        {}
      ),
      required: tool.arguments.filter(arg => arg.required).map(arg => arg.name)
    }
  }));
};

/**
 * AIからのツール呼び出しを実行する。
 * @param call ツール呼び出し
 */
export const executeSlashCommandTool = async (call: AiToolCall): Promise<string> => {
  return `未対応のコマンドです: ${call.name}`;
};
