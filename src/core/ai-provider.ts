import { GeminiProvider } from "./ai-gemini.provider";
import { ClaudeProvider } from "./ai-claude.provider";
import { OpenAiProvider } from "./ai-openai.provider";
import { WorkersAiProvider } from "./ai-workersai.provider";
import {
  AI_API_KEY,
  AI_BASE_URL,
  AI_CLOUDFLARE_ACCOUNT_ID,
  AI_MODEL,
  AI_PROVIDER,
} from "./environment";

/** AIメッセージのロール定義。 */
export type AiRole = "system" | "user" | "assistant" | "tool";

/** AIが呼び出すツール定義。 */
export type AiToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: "string"; description?: string }>;
    required?: string[];
  };
};

/** AIのツール呼び出し。 */
export type AiToolCall = {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
};

/** AIへの入力メッセージ。 */
export type AiMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; toolCall: AiToolCall }
  | {
      role: "tool";
      toolName: string;
      toolCallId?: string;
      content: Record<string, unknown>;
    };

/** AI生成リクエスト。 */
export type AiGenerateRequest = {
  messages: AiMessage[];
  tools?: AiToolDefinition[];
};

/** AI生成レスポンス。 */
export type AiGenerateResponse = {
  content?: string;
  toolCalls?: AiToolCall[];
};

/** AIプロバイダが実装すべき共通インターフェイス。 */
export interface AiProvider {
  /**
   * 文章生成を行う。
   * @param request 生成リクエスト
   */
  generate(request: AiGenerateRequest): Promise<AiGenerateResponse>;
}

export type AiProviderName =
  | "gemini"
  | "workersai"
  | "openai"
  | "claude"
  | "local";

/**
 * 環境変数からAIプロバイダを構築する。
 */
export const createAiProvider = (): AiProvider => {
  const provider = (AI_PROVIDER ?? "gemini") as AiProviderName;
  const configuredModel = AI_MODEL;
  const apiKey = AI_API_KEY ?? "";

  if (provider === "gemini") {
    if (!apiKey) {
      throw new Error("API key is missing. Set AI_API_KEY.");
    }
    const model = configuredModel ?? "gemini-2.5-flash";
    return new GeminiProvider(apiKey, model);
  }

  if (provider === "local") {
    if (!AI_BASE_URL || !configuredModel) {
      throw new Error("Local model requires AI_BASE_URL and AI_MODEL.");
    }
    const url = new URL(AI_BASE_URL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "AI_BASE_URL must be an HTTP(S) base URL without credentials, query or fragment.",
      );
    }
    return new OpenAiProvider(apiKey, configuredModel, {
      baseUrl: url.toString(),
      local: true,
    });
  }

  if (provider === "openai") {
    if (!apiKey) {
      throw new Error("API key is missing. Set AI_API_KEY.");
    }
    const model = configuredModel;
    if (!model) {
      throw new Error("OpenAI model is missing. Set AI_MODEL.");
    }
    return new OpenAiProvider(apiKey, model);
  }

  if (provider === "claude") {
    if (!apiKey) {
      throw new Error("API key is missing. Set AI_API_KEY.");
    }
    const model = configuredModel;
    if (!model) {
      throw new Error("Claude model is missing. Set AI_MODEL.");
    }
    return new ClaudeProvider(apiKey, model);
  }

  if (provider === "workersai") {
    if (!apiKey) {
      throw new Error("API key is missing. Set AI_API_KEY.");
    }
    const accountId = AI_CLOUDFLARE_ACCOUNT_ID ?? "";
    if (!accountId) {
      throw new Error(
        "Cloudflare account ID is missing. Set AI_CLOUDFLARE_ACCOUNT_ID.",
      );
    }
    const model = configuredModel;
    if (!model) {
      throw new Error("Workers AI model is missing. Set AI_MODEL.");
    }
    return new WorkersAiProvider(apiKey, accountId, model);
  }

  throw new Error(`Unsupported provider: ${provider}`);
};
