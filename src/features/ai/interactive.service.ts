import type { Client, Message } from 'discord.js';
import type { AiMessage } from '../../core/ai-provider';

import { AiAgentService } from './agent.service';
import { AiConversationService } from './conversation.service';

/** BOTがメンションを受け取ったときの対話挙動を定義するサービスクラス。 */
export class InteractiveService {
  private readonly processingEmoji = '👀';

  constructor(
    private client: Client,
    private aiAgentService: AiAgentService,
    private aiConversationService: AiConversationService
  ) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('messageCreate', message => this.onMessage(message));
  }

  /** Messageから各処理を呼び出すFacade関数。 */
  private onMessage(message: Message) {
    if (message.author.bot) { return; } // botの発言は無視
    if (['@everyone', '@here'].some(key => message.content.includes(key))) { return; } // everyone/hereが含まれていたら無視

    const repliedSessionId = this.aiConversationService.getSessionIdFromReply(message);
    if (repliedSessionId) {
      this.reply(message, repliedSessionId, false);
      return;
    }

    if (message.mentions.has(this.client.user || '')) {
      const sessionId = this.aiConversationService.createSession(message.id);
      this.reply(message, sessionId, true);
      return;
    }

    if (message.reference?.messageId) {
      this.replyWithRehydration(message);
    }
  }

  /**
   * メンション/返信を受けたメッセージに対してAIの応答を返す。
   * @param message 受信メッセージ
   * @param sessionId 会話セッションID
   * @param stripMention メンションを除去するか
   */
  private async reply(message: Message, sessionId: string, stripMention: boolean) {
    if (!message.channel.isTextBased()) { return; }
    const content = stripMention
      ? this.stripMention(message.content, this.client.user?.id)
      : message.content.trim();

    if (!content) { return; }

    const processingReaction = await this.addReactionSafely(message, this.processingEmoji);
    this.aiConversationService.addUserMessage(sessionId, content);
    const messages = this.buildContextMessages(sessionId);
    const text = await this.aiAgentService.reply(messages);
    const replyMessage = await message.reply(text);
    this.aiConversationService.addAssistantMessage(sessionId, text, replyMessage.id);
    await this.removeReactionSafely(processingReaction);
  }

  /**
   * メモリにない返信を受けた場合、返信チェーンから会話を再構築して応答する。
   * @param message 受信メッセージ
   */
  private async replyWithRehydration(message: Message) {
    if (!message.channel.isTextBased()) { return; }
    const { sessionId, messages, messageIds } = await this.rehydrateSessionFromReply(message);
    if (!sessionId) { return; }
    this.aiConversationService.ensureSession(sessionId, messages, messageIds);
    await this.reply(message, sessionId, false);
  }

  /**
   * 返信チェーンからセッションを復元する。
   * @param message 受信メッセージ
   */
  private async rehydrateSessionFromReply(message: Message): Promise<{
    sessionId: string | null;
    messages: AiMessage[];
    messageIds: string[];
  }> {
    const channel = message.channel;
    if (!channel.isTextBased() || !('messages' in channel)) {
      return { sessionId: null, messages: [], messageIds: [] };
    }

    const mentionId = this.client.user?.id;
    const chain: Message[] = [];
    let currentId = message.reference?.messageId;

    while (currentId && chain.length < 20) {
      const fetched = await channel.messages.fetch(currentId).catch(() => null);
      if (!fetched) { break; }
      chain.push(fetched);
      currentId = fetched.reference?.messageId;
    }

    if (chain.length === 0) {
      return { sessionId: null, messages: [], messageIds: [] };
    }

    const ordered = chain.reverse();
    const messages: AiMessage[] = ordered
      .map((item): AiMessage => ({
        role: item.author.bot ? 'assistant' : 'user',
        content: item.author.bot
          ? item.content.trim()
          : this.stripMention(item.content, mentionId)
      }))
      .filter((item): item is Extract<AiMessage, { content: string }> => {
        return 'content' in item && typeof item.content === 'string' && item.content.trim().length > 0;
      });

    const messageIds = ordered.map(item => item.id);
    const sessionId = ordered[0].id;

    return { sessionId, messages, messageIds };
  }

  /**
   * セッションに紐づくメッセージをAI向け形式で取得する。
   * @param sessionId 会話セッションID
   */
  private buildContextMessages(sessionId: string): AiMessage[] {
    return this.aiConversationService.getMessages(sessionId);
  }

  /**
   * メンション表記を取り除いて内容を整形する。
   * @param content 元の本文
   * @param mentionId botのユーザーID
   */
  private stripMention(content: string, mentionId?: string): string {
    if (!mentionId) { return content; }
    const pattern = new RegExp(`<@!?${mentionId}>`, 'g');
    return content.replace(pattern, '').trim();
  }

  /**
   * リアクションを付与する。 権限や失敗は握りつぶす。
   * @param message 対象メッセージ
   * @param emoji 付与する絵文字
   */
  private async addReactionSafely(message: Message, emoji: string) {
    try {
      return await message.react(emoji);
    } catch {
      return null;
    }
  }

  /**
   * リアクションを削除する。 権限や失敗は握りつぶす。
   * @param reaction 削除対象のリアクション
   */
  private async removeReactionSafely(reaction: Awaited<ReturnType<Message['react']>> | null) {
    if (!reaction) { return; }
    try {
      await reaction.remove();
    } catch {
      return;
    }
  }
}
