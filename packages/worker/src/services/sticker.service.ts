import { Client, Message, type MessageCreateOptions } from 'discord.js';

import { DETECT_STICKER_RATE } from '@butler/core';
import { PrettyText } from '../lib/pretty-text';
import { StickersStore } from '../stores/stickers.store';

/** `GenerateText.help`に食わせるヘルプ文の定数。 */
const HELP = {
  DESC: `\`!sticker\` コマンド - チャットを監視して、正規表現にマッチしたスタンプ画像を表示する機能`,
  ITEMS: [
    ['!sticker.set http://example.com/hoge.jpg /abc/', '`http://example.com/hoge.jpg` に正規表現 `/abc/` を設定(新規追加/上書き)します'],
    ['!sticker.remove http://example.com/hoge.jpg', '`http://example.com/hoge.jpg` が設定されていれば削除します'],
    ['!sticker.list', '登録されている値を一覧します'],
    ['!sticker.help', '`!sticker` コマンドのヘルプを表示します(エイリアス: `!sticker`)']
  ]
} as const;

/** `StickersStore`の値を操作するサービスクラス。 */
export class StickerService {
  constructor(private client: Client, private stickersStore: StickersStore) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('messageCreate', message => this.onMessage(message));
    return this;
  }

  /** `message`で関数を振り分けるファサード。 */
  private onMessage(message: Message) {
    const content   = message.content;
    const body      = content.replace(/!sticker\.?\w*\s*\n*/, '').trim(); // コマンド以外のテキスト部分
    if (message.author.bot) { return; } // botの発言は無視
    if (content.startsWith('!sticker.set')) { this.set(message, { body }); };
    if (content.startsWith('!sticker.remove')) { this.remove(message, { body }); };
    if (content.startsWith('!sticker.list')) { this.list(message); };
    if (content.startsWith('!sticker.help') || content === '!sticker') { this.help(message); };
    if (!content.startsWith('!')) { this.sendSticker(message); }
  }

  /** `!sticker.set` コマンドを受け取った時、第一引数をキーに、第二引数を値にしたものを登録する。 */
  private async set({ channel }: Message, { body }: { body: string }) {
    const key   = body.replace(/\s.*/g, '');
    const value = body.replace(key, '').trim().replace(/^\/|\/$/g, '');
    this.sendToChannel(channel, (await this.stickersStore.set(key, value)).pretty);
  }

  /** `!sticker.remove` コマンドを受け取った時、第一引数にマッチする値を削除する。 */
  private async remove({ channel }: Message, { body: url }: { body: string }) {
    this.sendToChannel(channel, (await this.stickersStore.del(url)).pretty);
  }

  /** `!sticker.list` コマンドを受け取った時、値を一覧する。 */
  private async list({ channel }: Message) {
    const data = await this.stickersStore.data();
    if (data.pretty.length < 2000) {
      this.sendToChannel(channel, data.pretty);
    } else {
      const pretty = `[${Object.values(data.value).map(({ id, regexp }) => `\n  ["${id}", "${regexp}"]`).join(',')}\n]`;
      this.sendToChannel(channel, { content: '**STICKER 一覧**', files: [{ name: 'STICKERS.md', attachment: Buffer.from(pretty) }] });
    }
  }

  /** ヘルプを表示する。 */
  private help({ channel }: Message) {
    const text = PrettyText.helpList(HELP.DESC, ...HELP.ITEMS);
    this.sendToChannel(channel, text);
  }

  /** チャットからStickerの正規表現を検知した場合、DETECT_STICKER_RATEに従ってStickerを送信する。 */
  private async sendSticker({ channel, mentions, content }: Message) {
    const detectSticker = async ({ content, mentions }: Pick<Message, 'content' | 'mentions'>) => {
      const hasUrl       = content.includes('http');
      const mentioned    = !!this.client.user && mentions.has((this.client.user));
      const failedRandom = Math.random() >= (Number(DETECT_STICKER_RATE) || 0);
      if (mentioned || hasUrl || failedRandom) { return null; } // 検知無用のときは早期リターン
      const data     = (await this.stickersStore.data()).value;
      const stickers = Object.entries(data).map(([_, sticker]) => sticker);
      const urls     = stickers.reduce<string[]>((a, { id, regexp }) => new RegExp(regexp).test(content) ? a.concat(id) : a, []);
      const url      = urls[new Date().getMilliseconds() % urls.length] || '';
      const sticker  = data[url];
      const regexp   = sticker?.regexp || '';
      return url ? `${url} ||/${regexp}/||` : null;
    }
    const text = await detectSticker({ mentions, content });
    if (text) { this.sendToChannel(channel, text); }
  }

  private sendToChannel(channel: Message['channel'], content: string | MessageCreateOptions) {
    type SendableChannel = Message['channel'] & { send: (content: string | MessageCreateOptions) => Promise<unknown> };
    if (!('send' in channel)) { return; }
    return (channel as SendableChannel).send(content);
  }
}
