import { type ChatInputCommandInteraction, Client, Message } from 'discord.js';

import { DETECT_STICKER_RATE } from '@butler/core';
import { PrettyText } from '../utils/pretty-text.util';
import { StickersStore } from '../stores/stickers.store';
import { sendToChannel } from '../utils/discord.util';

/** `GenerateText.help`に食わせるヘルプ文の定数。 */
const HELP = {
  DESC: '`/butler sticker` コマンド - チャットを監視して、正規表現にマッチしたスタンプ画像を表示する機能',
  ITEMS: [
    ['/butler sticker set url:http://example.com/hoge.jpg regexp:/abc/', '`http://example.com/hoge.jpg` に正規表現 `/abc/` を設定(新規追加/上書き)します'],
    ['/butler sticker remove url:http://example.com/hoge.jpg', '`http://example.com/hoge.jpg` が設定されていれば削除します'],
    ['/butler sticker list', '登録されている値を一覧します'],
    ['/butler sticker help', '`/butler sticker` コマンドのヘルプを表示します']
  ]
} as const;

/** `StickersStore`の値を操作するサービスクラス。 */
export class StickerService {
  constructor(private client: Client, private stickersStore: StickersStore) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('interactionCreate', interaction => {
      if (!interaction.isChatInputCommand()) { return; }
      if (interaction.commandName !== 'butler') { return; }
      if (interaction.options.getSubcommandGroup() !== 'sticker') { return; }
      this.onCommand(interaction);
    });
    this.client.on('messageCreate', message => this.onMessage(message));
    return this;
  }

  /** Slash Commandで関数を振り分けるファサード。 */
  private onCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'set') { this.set(interaction); }
    if (subcommand === 'remove') { this.remove(interaction); }
    if (subcommand === 'list') { this.list(interaction); }
    if (subcommand === 'help') { this.help(interaction); }
  }

  /** `message`で関数を振り分けるファサード。 */
  private onMessage(message: Message) {
    const content   = message.content;
    if (message.author.bot) { return; } // botの発言は無視
    this.sendSticker(message);
  }

  /** `/sticker set` コマンドを受け取った時、第一引数をキーに、第二引数を値にしたものを登録する。 */
  private async set(interaction: ChatInputCommandInteraction) {
    const key   = interaction.options.getString('url', true);
    const value = interaction.options.getString('regexp', true).replace(/^\/|\/$/g, '');
    await interaction.reply((await this.stickersStore.set(key, value)).pretty);
  }

  /** `/sticker remove` コマンドを受け取った時、第一引数にマッチする値を削除する。 */
  private async remove(interaction: ChatInputCommandInteraction) {
    const url = interaction.options.getString('url', true);
    await interaction.reply((await this.stickersStore.del(url)).pretty);
  }

  /** `/sticker list` コマンドを受け取った時、値を一覧する。 */
  private async list(interaction: ChatInputCommandInteraction) {
    const data = await this.stickersStore.data();
    if (data.pretty.length < 2000) {
      await interaction.reply(data.pretty);
    } else {
      const pretty = `[${Object.values(data.value).map(({ id, regexp }) => `\n  ["${id}", "${regexp}"]`).join(',')}\n]`;
      await interaction.reply({ content: '**STICKER 一覧**', files: [{ name: 'STICKERS.md', attachment: Buffer.from(pretty) }] });
    }
  }

  /** ヘルプを表示する。 */
  private help(interaction: ChatInputCommandInteraction) {
    const text = PrettyText.helpList(HELP.DESC, ...HELP.ITEMS);
    return interaction.reply(text);
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
    if (text) { sendToChannel(channel, text); }
  }
}
