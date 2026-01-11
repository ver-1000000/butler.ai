import type { AiGenerateRequest, AiGenerateResponse, AiMessage, AiToolDefinition, AiProvider } from './ai-provider';

type WorkersAiToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type WorkersAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: WorkersAiToolCall[];
  tool_call_id?: string;
  name?: string;
};

type WorkersAiResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: WorkersAiToolCall[];
    };
  }>;
};

/** Cloudflare Workers AIを利用するAIプロバイダ。 */
export class WorkersAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly accountId: string,
    private readonly model: string
  ) {}

  /**
   * Workers AIに問い合わせて応答を取得する。
   * @param request 生成リクエスト
   */
  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/v1/chat/completions`;
    const messages = request.messages
      .map((message, index) => this.toWorkersAiMessage(message, index))
      .filter((message): message is WorkersAiMessage => message !== null);

    const tools = request.tools ? this.toWorkersAiTools(request.tools) : undefined;

    const res = await this.requestWithRetry(url, {
      model: this.model,
      messages,
      tools,
      tool_choice: tools?.length ? 'auto' : undefined
    });

    const data = (await res.json()) as WorkersAiResponse;
    const message = data.choices?.[0]?.message;
    const toolCalls = message?.tool_calls ?? [];

    if (toolCalls.length > 0) {
      return {
        toolCalls: toolCalls
          .map(call => ({
            id: call.id,
            name: call.function?.name ?? '',
            arguments: this.safeParseArguments(call.function?.arguments)
          }))
          .filter(call => call.name)
      };
    }

    const content = message?.content?.trim();
    return { content: content || 'AIの応答が取得できませんでした。' };
  }

  /**
   * AIメッセージをWorkers AI向けのmessagesに変換する。
   * @param message AIメッセージ
   * @param index メッセージ順序
   */
  private toWorkersAiMessage(message: AiMessage, index: number): WorkersAiMessage | null {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: message.toolCallId ?? `tool_${index}`,
        name: message.toolName,
        content: JSON.stringify(message.content)
      };
    }

    if ('toolCall' in message) {
      const toolCallId = message.toolCall.id ?? `call_${index}`;
      return {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: toolCallId,
            type: 'function',
            function: {
              name: message.toolCall.name,
              arguments: JSON.stringify(message.toolCall.arguments)
            }
          }
        ]
      };
    }

    return {
      role: message.role,
      content: message.content
    };
  }

  /**
   * AIツール定義をWorkers AI向けのtoolsに変換する。
   * @param tools AIツール定義
   */
  private toWorkersAiTools(tools: AiToolDefinition[]): Array<{ type: 'function'; function: AiToolDefinition }> {
    return tools.map(tool => ({ type: 'function', function: tool }));
  }

  /**
   * 関数引数(JSON文字列)をパースする。
   * @param rawArguments JSON文字列
   */
  private safeParseArguments(rawArguments?: string): Record<string, unknown> {
    if (!rawArguments) { return {}; }
    try {
      const parsed = JSON.parse(rawArguments) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Workers AIへのリクエストを指数バックオフでリトライする。
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
            Authorization: `Bearer ${this.apiKey}`
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
        throw new Error(`WorkersAIError:${res.status} ${errorBody}`);
      } catch (error) {
        if (attempt >= maxRetries) {
          throw error;
        }
        await this.sleep(baseDelayMs * 2 ** attempt);
      }
    }

    throw new Error('WorkersAIError:RetryFailed');
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
