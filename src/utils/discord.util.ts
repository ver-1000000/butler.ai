import type { Message, MessageCreateOptions } from 'discord.js';

/**
 * チャンネルにメッセージを送信する共通ユーティリティ関数
 *
 * @param channel - メッセージを送信するチャンネル
 * @param content - 送信するメッセージの内容
 * @returns 送信されたメッセージのPromise、またはチャンネルが送信をサポートしていない場合はnull
 */
export function sendToChannel(
  channel: Message['channel'],
  content: string | MessageCreateOptions
): Promise<Message> | null {
  type SendableChannel = Message['channel'] & { send: (content: string | MessageCreateOptions) => Promise<Message> };
  if (!('send' in channel)) { return null; }
  return (channel as SendableChannel).send(content);
}
