import type { AiProvider } from './ai-provider';
import type { AiGenerateRequest, AiGenerateResponse, AiMessage, AiToolDefinition } from './ai-provider';

type GeminiPart = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: { name: string; response: Record<string, unknown> } };
type GeminiContent = { role: 'user' | 'model' | 'tool'; parts: GeminiPart[] };

type GeminiToolDeclaration = {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: 'string'; description?: string }>;
    required?: string[];
  };
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
};

/** Gemini APIを利用するAIプロバイダ。 */
export class GeminiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  /**
   * Geminiに問い合わせて応答を取得する。
   * @param request 生成リクエスト
   */
  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const contents = request.messages.map(message => this.toGeminiContent(message));
    const tools = request.tools ? this.toGeminiTools(request.tools) : undefined;

    const res = await this.requestWithRetry(url, contents, tools);

    const data = (await res.json()) as GeminiResponse;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const toolCalls = parts
      .filter(part => part.functionCall)
      .map(part => ({
        name: part.functionCall?.name ?? '',
        arguments: part.functionCall?.args ?? {}
      }))
      .filter(call => call.name);

    if (toolCalls.length > 0) {
      return { toolCalls };
    }

    const text = parts.map(part => part.text).filter(Boolean).join('\n');
    return { content: text?.trim() || 'AIの応答が取得できませんでした。' };
  }

  /**
   * Geminiへのリクエストを指数バックオフでリトライする。
   * @param url リクエストURL
   * @param contents 送信するメッセージ内容
   */
  private async requestWithRetry(
    url: string,
    contents: GeminiContent[],
    tools?: { functionDeclarations: GeminiToolDeclaration[] }[]
  ): Promise<Response> {
    const maxRetries = 3;
    const baseDelayMs = 500;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const body: { contents: GeminiContent[]; tools?: { functionDeclarations: GeminiToolDeclaration[] }[] } = { contents };
        if (tools?.length) { body.tools = tools; }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        throw new Error(`GeminiError:${res.status} ${errorBody}`);
      } catch (error) {
        if (attempt >= maxRetries) {
          throw error;
        }
        await this.sleep(baseDelayMs * 2 ** attempt);
      }
    }

    throw new Error('GeminiError:RetryFailed');
  }

  /**
   * AIメッセージをGemini向けのcontentに変換する。
   * @param message AIメッセージ
   */
  private toGeminiContent(message: AiMessage): GeminiContent {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        parts: [{ functionResponse: { name: message.toolName, response: message.content } }]
      };
    }

    if ('toolCall' in message) {
      return {
        role: 'model',
        parts: [{ functionCall: { name: message.toolCall.name, args: message.toolCall.arguments } }]
      };
    }

    return {
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    };
  }

  /**
   * AIツール定義をGemini向けのtoolsに変換する。
   * @param tools AIツール定義
   */
  private toGeminiTools(tools: AiToolDefinition[]): { functionDeclarations: GeminiToolDeclaration[] }[] {
    return [
      {
        functionDeclarations: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }
    ];
  }

  /**
   * リトライ対象のHTTPステータスか判定する。
   * @param status HTTPステータスコード
   */
  private shouldRetry(status: number): boolean {
    return status === 429 || status === 500 || status === 503;
  }

  /**
   * 指定時間待機する。
   * @param ms 待機時間(ms)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
