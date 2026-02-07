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

export type SlashCommandToolContext = {
  guildId?: string;
  userId?: string;
};

/** スラッシュコマンドツールの実行関数。 */
export type SlashCommandToolHandler = (
  args: Record<string, unknown>,
  context?: SlashCommandToolContext
) => Promise<string>;

const TOOL_DEFINITIONS: SlashCommandToolDefinition[] = [];
const TOOL_HANDLERS = new Map<string, SlashCommandToolHandler>();

/**
 * 現時点でAIに公開するスラッシュコマンドのツール一覧を返す。
 */
export const getSlashCommandTools = (): SlashCommandToolDefinition[] => {
  return TOOL_DEFINITIONS;
};

/**
 * 指定名のツール定義を取得する。
 */
export const getSlashCommandTool = (name: string): SlashCommandToolDefinition | undefined => {
  return TOOL_DEFINITIONS.find(tool => tool.name === name);
};

/**
 * ツール名をスラッシュコマンド用のサブコマンド名に変換する。
 */
export const toSlashSubcommandName = (toolName: string): string => {
  return toolName.replace(/_/g, '-');
};

/**
 * スラッシュコマンド用サブコマンド名をツール名に戻す。
 */
export const fromSlashSubcommandName = (subcommandName: string): string => {
  return subcommandName.replace(/-/g, '_');
};

/**
 * スラッシュコマンドツールを登録する。
 */
export const registerSlashCommandTool = (
  tool: SlashCommandToolDefinition,
  handler?: SlashCommandToolHandler
): void => {
  const existingIndex = TOOL_DEFINITIONS.findIndex(item => item.name === tool.name);
  if (existingIndex >= 0) {
    TOOL_DEFINITIONS.splice(existingIndex, 1, tool);
  } else {
    TOOL_DEFINITIONS.push(tool);
  }

  if (handler) {
    TOOL_HANDLERS.set(tool.name, handler);
  }
};

/**
 * 既存ツールの実行関数だけを登録する。
 */
export const registerSlashCommandToolHandler = (
  name: string,
  handler: SlashCommandToolHandler
): void => {
  TOOL_HANDLERS.set(name, handler);
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
  const handler = TOOL_HANDLERS.get(call.name);
  if (!handler) {
    return `未対応のコマンドです: ${call.name}`;
  }
  return handler(call.arguments);
};

/**
 * AIからのツール呼び出しを実行する(実行コンテキスト付き)。
 */
export const executeSlashCommandToolWithContext = async (
  call: AiToolCall,
  context: SlashCommandToolContext
): Promise<string> => {
  const handler = TOOL_HANDLERS.get(call.name);
  if (!handler) {
    return `未対応のコマンドです: ${call.name}`;
  }
  return handler(call.arguments, context);
};
