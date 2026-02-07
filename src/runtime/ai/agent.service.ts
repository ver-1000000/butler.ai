import { randomUUID } from 'crypto';
import type { AiMessage, AiToolCall, AiToolDefinition } from '../../core/ai-provider';
import { createAiProvider } from '../../core/ai-provider';
import { AI_PROMPT_APPEND } from '../../core/environment';

import { PrettyText } from '../../utils/pretty-text.util';

export type AiToolExecutionContext = {
  guildId?: string;
  userId?: string;
};

/** AIツール実行関数の型。 */
export type AiToolExecutor = (
  call: AiToolCall,
  context?: AiToolExecutionContext
) => Promise<string>;

/** AI生成を担当するサービス。 */
export class AiAgentService {
  private readonly provider = createAiProvider();

  constructor(
    private readonly toolExecutor: AiToolExecutor,
    private readonly tools: AiToolDefinition[]
  ) {}

  /**
   * AIに生成を依頼し、応答テキストを返す。
   * @param messages AIに渡すメッセージ列
   */
  async reply(messages: AiMessage[], context?: AiToolExecutionContext): Promise<string> {
    try {
      return await this.replyWithTools(messages, context);
    } catch (error) {
      const errorCode = 'AI_ERROR';
      const message = error instanceof Error ? error.message : 'Unknown AI error';
      return PrettyText.code(`${errorCode}\n${message}`, 'text');
    }
  }

  /**
   * ツール呼び出しを含めたAI応答を生成する。
   * @param messages AIに渡すメッセージ列
   */
  private async replyWithTools(
    messages: AiMessage[],
    context?: AiToolExecutionContext
  ): Promise<string> {
    const maxIterations = 3;
    let currentMessages = [this.buildSystemMessage(), ...messages];

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const response = await this.provider.generate({ messages: currentMessages, tools: this.tools });
      if (response.toolCalls?.length) {
        const toolResponses = (
          await Promise.all(response.toolCalls.map(call => this.executeTool(call, context)))
        ).flat();
        currentMessages = [...currentMessages, ...toolResponses];
        continue;
      }

      if (response.content) {
        return response.content;
      }
    }

    return 'AIの応答が取得できませんでした。';
  }

  /**
   * AIの方針を明示するシステムメッセージを生成する。
   */
  private buildSystemMessage(): AiMessage {
    const nowInTokyo = this.getCurrentDateTimeInTokyo();
    const content = `
      あなたはDiscord Botのbutlerです。
      利用できる機能はスラッシュコマンドのツールのみです。
      ツールは必要な場合のみ呼び出してください。
      通常の質問や雑談にはツールを使わず自然に返答してください。
      現在日時(Asia/Tokyo): ${nowInTokyo}
      ツール説明とAI方針(説明文中の「AI方針: ...」)を優先して実行してください。
      確認質問は必要最小限にし、実行可能なら一度で実行してください。
      補完した内容は実行結果で簡潔に報告してください。
      ツール未実行で結果を前提にしてはいけません。
      ${(AI_PROMPT_APPEND ?? '').trim()}
    `.trim();
    return { role: 'system', content };
  }

  /** 現在日時をAsia/Tokyoのローカル時刻文字列で返す。 */
  private getCurrentDateTimeInTokyo(): string {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(new Date());

    const get = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find(part => part.type === type)?.value ?? '';

    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
  }

  /**
   * ツールを実行し、AIに返すメッセージ列を組み立てる。
   * @param call ツール呼び出し
   */
  private async executeTool(call: AiToolCall, context?: AiToolExecutionContext): Promise<AiMessage[]> {
    const toolCallId = this.ensureToolCallId(call);
    const result = await this.toolExecutor(call, context);
    return [
      { role: 'assistant', toolCall: call },
      { role: 'tool', toolName: call.name, toolCallId, content: { result } }
    ];
  }

  /**
   * ツール呼び出しにIDを付与する。
   * @param call ツール呼び出し
   */
  private ensureToolCallId(call: AiToolCall): string {
    if (call.id) { return call.id; }
    const id = randomUUID();
    call.id = id;
    return id;
  }
}
