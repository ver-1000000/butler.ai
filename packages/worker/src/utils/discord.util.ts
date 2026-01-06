import type { Message, MessageCreateOptions } from 'discord.js';

/**
 * チャンネルにメッセージを送信する共通ユーティリティ関数
 */
export function sendToChannel(channel: Message['channel'], content: string | MessageCreateOptions) {
  type SendableChannel = Message['channel'] & { send: (content: string | MessageCreateOptions) => Promise<Message> };
  if (!('send' in channel)) { return null; }
  return (channel as SendableChannel).send(content);
}
