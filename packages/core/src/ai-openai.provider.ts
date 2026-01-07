import type { AiGenerateRequest, AiGenerateResponse, AiMessage, AiToolCall, AiToolDefinition, AiProvider } from './ai-provider';

type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
  name?: string;
};

type OpenAiResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: OpenAiToolCall[];
    };
  }>;
};

/** OpenAI APIを利用するAIプロバイダ。 */
export class OpenAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  /**
   * OpenAIに問い合わせて応答を取得する。
   * @param request 生成リクエスト
   */
  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const messages = request.messages
      .map((message, index) => this.toOpenAiMessage(message, index))
      .filter((message): message is OpenAiMessage => message !== null);

    const tools = request.tools ? this.toOpenAiTools(request.tools) : undefined;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools,
        tool_choice: tools?.length ? 'auto' : undefined
      })
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`OpenAIError:${res.status} ${errorBody}`);
    }

    const data = (await res.json()) as OpenAiResponse;
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
   * AIメッセージをOpenAI向けのmessagesに変換する。
   * @param message AIメッセージ
   * @param index メッセージ順序
   */
  private toOpenAiMessage(message: AiMessage, index: number): OpenAiMessage | null {
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
        content: null,
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
   * AIツール定義をOpenAI向けのtoolsに変換する。
   * @param tools AIツール定義
   */
  private toOpenAiTools(tools: AiToolDefinition[]): Array<{ type: 'function'; function: AiToolDefinition }> {
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
}
