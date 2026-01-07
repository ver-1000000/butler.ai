import { randomUUID } from 'crypto';
import type { Message } from 'discord.js';
import type { AiMessage, AiToolCall, AiToolDefinition } from '@butler/core';
import { AI_PROMPT_APPEND, createAiProvider } from '@butler/core';
import { PrettyText } from '../utils/pretty-text.util';

/** AIツール実行関数の型。 */
export type AiToolExecutor = (call: AiToolCall) => Promise<string>;

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
  async reply(messages: AiMessage[]): Promise<string> {
    try {
      return await this.replyWithTools(messages);
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
  private async replyWithTools(messages: AiMessage[]): Promise<string> {
    const maxIterations = 3;
    let currentMessages = [this.buildSystemMessage(), ...messages];
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const response = await this.provider.generate({ messages: currentMessages, tools: this.tools });
      debugger;
      if (response.toolCalls?.length) {
        const toolResponses = (await Promise.all(response.toolCalls.map(call => this.executeTool(call)))).flat();
        currentMessages = [...currentMessages, ...toolResponses];
        continue;
      }
      if (response.content) return response.content;
    }

    return 'AIの応答が取得できませんでした。';
  }

  /**
   * AIの方針を明示するシステムメッセージを生成する。
   */
  private buildSystemMessage(): AiMessage {
    const content = `
      あなたはDiscord Botのbutlerです。
      利用できる機能はスラッシュコマンドのツールのみです。
      ツールは必要な場合のみ呼び出してください。
      通常の質問や雑談にはツールを使わず自然に返答してください。
      ツールが必要か迷う場合は確認の質問をしてください。
      ツール未実行で結果を前提にしてはいけません。
      不確かな場合は推測せず、わからないと伝えてください。
      ${(AI_PROMPT_APPEND ?? '').trim()}
    `.trim();
    return { role: 'system', content };
  }

  /**
   * ツールを実行し、AIに返すメッセージ列を組み立てる。
   * @param call ツール呼び出し
   */
  private async executeTool(call: AiToolCall): Promise<AiMessage[]> {
    const toolCallId = this.ensureToolCallId(call);
    const result = await this.toolExecutor(call);
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

/** AIとの会話コンテキストをメモリ上で保持するサービス。 */
export class AiConversationService {
  private readonly sessions = new Map<string, AiMessage[]>();
  private readonly messageToSession = new Map<string, string>();
  private readonly sessionToMessageIds = new Map<string, Set<string>>();
  private readonly sessionOrder: string[] = [];
  private readonly maxMessages = 20;
  private readonly maxSessions = 5;

  /**
   * メンション起点の新しいセッションを作成する。
   * @param rootMessageId セッション起点メッセージID
   */
  createSession(rootMessageId: string): string {
    this.ensureSession(rootMessageId, []);
    return rootMessageId;
  }

  /**
   * 返信先のメッセージIDからセッションIDを解決する。
   * @param message 受信メッセージ
   */
  getSessionIdFromReply(message: Message): string | null {
    const replyId = message.reference?.messageId;
    if (!replyId) { return null; }
    const sessionId = this.messageToSession.get(replyId) ?? null;
    if (sessionId) {
      this.touchSession(sessionId);
    }
    return sessionId;
  }

  /**
   * セッションが存在するか確認する。
   * @param sessionId セッションID
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * セッションを生成/更新し、LRU上限を超えたら古いセッションを破棄する。
   * @param sessionId セッションID
   * @param messages 初期メッセージ
   * @param messageIds セッションに紐づくメッセージID
   */
  ensureSession(sessionId: string, messages: AiMessage[], messageIds: string[] = []) {
    this.sessions.set(sessionId, this.trimMessages(messages));
    for (const messageId of messageIds) {
      this.mapMessageToSession(messageId, sessionId);
    }
    this.touchSession(sessionId);
    this.evictIfNeeded();
  }

  /**
   * ユーザー発言をセッションに追加する。
   * @param sessionId セッションID
   * @param content 発言内容
   */
  addUserMessage(sessionId: string, content: string) {
    this.appendMessage(sessionId, { role: 'user', content });
  }

  /**
   * アシスタント発言をセッションに追加し、返信IDと紐付ける。
   * @param sessionId セッションID
   * @param content 発言内容
   * @param replyMessageId 返信メッセージID
   */
  addAssistantMessage(sessionId: string, content: string, replyMessageId: string) {
    this.appendMessage(sessionId, { role: 'assistant', content });
    this.mapMessageToSession(replyMessageId, sessionId);
  }

  /**
   * セッションに紐づくメッセージ一覧を取得する。
   * @param sessionId セッションID
   */
  getMessages(sessionId: string): AiMessage[] {
    const messages = this.sessions.get(sessionId) ?? [];
    this.touchSession(sessionId);
    return messages;
  }

  /**
   * セッションにメッセージを追加し、上限を超えた分を削除する。
   * @param sessionId セッションID
   * @param message 追加するメッセージ
   */
  private appendMessage(sessionId: string, message: AiMessage) {
    const messages = this.sessions.get(sessionId) ?? [];
    messages.push(message);
    this.sessions.set(sessionId, this.trimMessages(messages));
    this.touchSession(sessionId);
    this.evictIfNeeded();
  }

  /**
   * セッションをLRUとして更新する。
   * @param sessionId セッションID
   */
  private touchSession(sessionId: string) {
    const index = this.sessionOrder.indexOf(sessionId);
    if (index >= 0) {
      this.sessionOrder.splice(index, 1);
    }
    this.sessionOrder.push(sessionId);
  }

  /**
   * LRU上限を超えたセッションを破棄する。
   */
  private evictIfNeeded() {
    while (this.sessionOrder.length > this.maxSessions) {
      const oldest = this.sessionOrder.shift();
      if (!oldest) { return; }
      this.sessions.delete(oldest);
      const messageIds = this.sessionToMessageIds.get(oldest);
      if (messageIds) {
        for (const messageId of messageIds) {
          this.messageToSession.delete(messageId);
        }
      }
      this.sessionToMessageIds.delete(oldest);
    }
  }

  /**
   * セッション内メッセージの上限を調整する。
   * @param messages メッセージ一覧
   */
  private trimMessages(messages: AiMessage[]): AiMessage[] {
    if (messages.length <= this.maxMessages) { return messages; }
    return messages.slice(messages.length - this.maxMessages);
  }

  /**
   * メッセージIDとセッションIDを紐付ける。
   * @param messageId DiscordメッセージID
   * @param sessionId セッションID
   */
  private mapMessageToSession(messageId: string, sessionId: string) {
    this.messageToSession.set(messageId, sessionId);
    const ids = this.sessionToMessageIds.get(sessionId) ?? new Set<string>();
    ids.add(messageId);
    this.sessionToMessageIds.set(sessionId, ids);
  }
}
