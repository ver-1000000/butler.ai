import type { AiToolCall, AiToolDefinition } from '../../core/ai-provider';
import { DEBUG_TOOL_CALLS } from '../../core/environment';

/**
 * /butler と AI が共通利用する「ツールレジストリ」。
 * プラグイン側はここへツール定義/実行ハンドラを登録し、
 * コマンド登録・AI実行・スラッシュコマンド実行の各経路は
 * このレジストリを参照して同一の機能セットを扱う。
 */

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

type RegisterSlashCommandToolOptions = {
  aiHint?: string;
};

/** スラッシュコマンドツールの実行関数。 */
export type SlashCommandToolHandler = (
  args: Record<string, unknown>,
  context?: SlashCommandToolContext
) => Promise<string>;

const TOOL_DEFINITIONS: SlashCommandToolDefinition[] = [];
const TOOL_HANDLERS = new Map<string, SlashCommandToolHandler>();
const TOOL_AI_HINTS = new Map<string, string>();
const isDebugToolCallsEnabled = DEBUG_TOOL_CALLS === '1' || DEBUG_TOOL_CALLS === 'true';

const toDebugText = (value: unknown): string => {
  try {
    const text = JSON.stringify(value);
    if (!text) return String(value);
    return text.length > 500 ? `${text.slice(0, 500)}...` : text;
  } catch {
    return String(value);
  }
};

/**
 * 現時点でAIに公開するスラッシュコマンドのツール一覧を返す。
 */
export const getSlashCommandTools = (): SlashCommandToolDefinition[] => {
  return TOOL_DEFINITIONS;
};

/**
 * スラッシュコマンドツールを登録する。
 */
export const registerSlashCommandTool = (
  tool: SlashCommandToolDefinition,
  handler?: SlashCommandToolHandler,
  options?: RegisterSlashCommandToolOptions
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

  if (options?.aiHint) {
    TOOL_AI_HINTS.set(tool.name, options.aiHint);
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
    description: TOOL_AI_HINTS.has(tool.name)
      ? `${tool.description}\nAI方針: ${TOOL_AI_HINTS.get(tool.name)}`
      : tool.description,
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
 * @param context 実行コンテキスト
 */
export const executeSlashCommandTool = async (
  call: AiToolCall,
  context: SlashCommandToolContext = {}
): Promise<string> => {
  if (isDebugToolCallsEnabled) {
    console.log(
      `[tool:request] name=${call.name} args=${toDebugText(call.arguments)} context=${toDebugText(context)}`
    );
  }

  const handler = TOOL_HANDLERS.get(call.name);
  if (!handler) {
    if (isDebugToolCallsEnabled) {
      console.warn(`[tool:missing] name=${call.name}`);
    }
    return `未対応のコマンドです: ${call.name}`;
  }

  try {
    const result = await handler(call.arguments, context);
    if (isDebugToolCallsEnabled) {
      console.log(`[tool:response] name=${call.name} result=${toDebugText(result)}`);
    }
    return result;
  } catch (error) {
    if (isDebugToolCallsEnabled) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error(`[tool:error] name=${call.name} error=${message}`);
    }
    throw error;
  }
};
