import type { AiGenerateRequest, AiGenerateResponse, AiMessage, AiToolDefinition, AiProvider } from './ai-provider';

type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

type ClaudeMessage = {
  role: 'user' | 'assistant';
  content: ClaudeContentBlock[];
};

type ClaudeResponse = {
  content?: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  stop_reason?: string;
};

/** Claude APIを利用するAIプロバイダ。 */
export class ClaudeProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  /**
   * Claudeに問い合わせて応答を取得する。
   * @param request 生成リクエスト
   */
  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const url = 'https://api.anthropic.com/v1/messages';
    const system = this.extractSystem(request.messages);
    const messages = this.toClaudeMessages(request.messages);
    const tools = request.tools ? this.toClaudeTools(request.tools) : undefined;

    const res = await this.requestWithRetry(url, {
      model: this.model,
      max_tokens: 1024,
      system,
      messages,
      tools,
      tool_choice: tools?.length ? 'auto' : undefined
    });

    const data = (await res.json()) as ClaudeResponse;
    const blocks = data.content ?? [];
    const toolCalls = blocks
      .filter(block => block.type === 'tool_use')
      .map(block => ({
        id: block.id,
        name: block.name ?? '',
        arguments: block.input ?? {}
      }))
      .filter(call => call.name);

    if (toolCalls.length > 0 || data.stop_reason === 'tool_use') {
      return { toolCalls };
    }

    const text = blocks
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .filter((value): value is string => Boolean(value))
      .join('\n');

    return { content: text?.trim() || 'AIの応答が取得できませんでした。' };
  }

  /**
   * systemロールの内容を抽出する。
   * @param messages AIメッセージ
   */
  private extractSystem(messages: AiMessage[]): string | undefined {
    const contents: string[] = [];
    for (const message of messages) {
      if (message.role === 'system' && 'content' in message) {
        contents.push(message.content);
      }
    }
    if (contents.length === 0) { return undefined; }
    return contents.join('\n');
  }

  /**
   * AIメッセージをClaude向けのmessagesに変換する。
   * @param messages AIメッセージ
   */
  private toClaudeMessages(messages: AiMessage[]): ClaudeMessage[] {
    const result: ClaudeMessage[] = [];

    messages.forEach((message, index) => {
      if (message.role === 'system') { return; }

      if (message.role === 'tool') {
        result.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: message.toolCallId ?? `tool_${index}`,
              content: JSON.stringify(message.content)
            }
          ]
        });
        return;
      }

      if ('toolCall' in message) {
        result.push({
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: message.toolCall.id ?? `call_${index}`,
              name: message.toolCall.name,
              input: message.toolCall.arguments
            }
          ]
        });
        return;
      }

      result.push({
        role: message.role,
        content: [{ type: 'text', text: message.content }]
      });
    });

    return result;
  }

  /**
   * AIツール定義をClaude向けのtoolsに変換する。
   * @param tools AIツール定義
   */
  private toClaudeTools(
    tools: AiToolDefinition[]
  ): Array<{ name: string; description: string; input_schema: AiToolDefinition['parameters'] }> {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  /**
   * Claudeへのリクエストを指数バックオフでリトライする。
   * @param url リクエストURL
   * @param body 送信するボディ
   */
  private async requestWithRetry(url: string, body: Record<string, unknown>): Promise<Response> {
    const maxRetries = 3;
    const baseDelayMs = 500;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(body)
        });

        if (res.ok) {
          return res;
        }

        if (this.shouldRetry(res.status) && attempt < maxRetries) {
          await this.sleep(baseDelayMs * 2 ** attempt);
          continue;
        }

        const errorBody = await res.text();
        throw new Error(`ClaudeError:${res.status} ${errorBody}`);
      } catch (error) {
        if (attempt >= maxRetries) {
          throw error;
        }
        await this.sleep(baseDelayMs * 2 ** attempt);
      }
    }

    throw new Error('ClaudeError:RetryFailed');
  }

  /**
   * リトライ対象のHTTPステータスか判定する。
   * @param status HTTPステータスコード
   */
  private shouldRetry(status: number): boolean {
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }

  /**
   * 指定時間待機する。
   * @param ms 待機時間(ms)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
