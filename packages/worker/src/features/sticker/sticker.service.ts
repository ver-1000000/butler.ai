import { type ChatInputCommandInteraction, Client, Message } from 'discord.js';
import { DETECT_STICKER_RATE } from '@butler/core';

import { PrettyText } from '../../utils/pretty-text.util';
import { StickersStore } from './sticker.store';
import { sendToChannel } from '../../utils/discord.util';

const MAX_STICKER_REGEXP_LENGTH = 120;
const MAX_STICKER_TARGET_LENGTH = 500;

/** `GenerateText.help`に食わせるヘルプ文の定数。 */
export const STICKER_HELP = {
  DESC: '`/butler sticker` コマンド - チャットを監視して、正規表現にマッチしたスタンプ画像を表示する機能',
  ITEMS: [
    [
      '/butler sticker set url:http://example.com/hoge.jpg regexp:/abc/',
      [
        '`http://example.com/hoge.jpg` に正規表現 `/abc/` を設定',
        '(新規追加/上書き)します'
      ].join('')
    ],
    ['/butler sticker remove url:http://example.com/hoge.jpg', '`http://example.com/hoge.jpg` が設定されていれば削除します'],
    ['/butler sticker list', '登録されている値を一覧します'],
    ['/butler sticker help', '`/butler sticker` コマンドのヘルプを表示します']
  ]
} as const;

export const validateStickerRegexp = (input: string): { ok: true; value: string } | { ok: false; error: string } => {
  const normalized = input.trim().replace(/^\/|\/$/g, '');
  if (!normalized) {
    return { ok: false, error: '正規表現が空です。' };
  }
  if (normalized.length > MAX_STICKER_REGEXP_LENGTH) {
    return { ok: false, error: `正規表現が長すぎます(最大${MAX_STICKER_REGEXP_LENGTH}文字)。` };
  }
  try {
    new RegExp(normalized);
  } catch {
    return { ok: false, error: '正規表現の形式が不正です。' };
  }
  return { ok: true, value: normalized };
};

/** `StickersStore`の値を操作するサービスクラス。 */
export class StickerService {
  constructor(private client: Client, private stickersStore: StickersStore) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) { return; }
      if (interaction.commandName !== 'butler') { return; }
      if (interaction.options.getSubcommandGroup() !== 'sticker') { return; }
      await this.onCommand(interaction);
    });
    this.client.on('messageCreate', message => this.onMessage(message));
    return this;
  }

  /** Slash Commandで関数を振り分けるファサード。 */
  private async onCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'set') { await this.set(interaction); }
    if (subcommand === 'remove') { await this.remove(interaction); }
    if (subcommand === 'list') { await this.list(interaction); }
    if (subcommand === 'help') { await this.help(interaction); }
  }

  /** `message`で関数を振り分けるファサード。 */
  private onMessage(message: Message) {
    if (message.author.bot) { return; } // botの発言は無視
    this.sendSticker(message);
  }

  /** `/sticker set` コマンドを受け取った時、第一引数をキーに、第二引数を値にしたものを登録する。 */
  private async set(interaction: ChatInputCommandInteraction) {
    const key   = interaction.options.getString('url', true);
    const valueInput = interaction.options.getString('regexp', true);
    const validation = validateStickerRegexp(valueInput);
    if (!validation.ok) {
      await interaction.reply(validation.error);
      return;
    }
    await interaction.reply(this.stickersStore.set(key, validation.value).pretty);
  }

  /** `/sticker remove` コマンドを受け取った時、第一引数にマッチする値を削除する。 */
  private async remove(interaction: ChatInputCommandInteraction) {
    const url = interaction.options.getString('url', true);
    await interaction.reply(this.stickersStore.del(url).pretty);
  }

  /** `/sticker list` コマンドを受け取った時、値を一覧する。 */
  private async list(interaction: ChatInputCommandInteraction) {
    const data = this.stickersStore.data();
    if (data.pretty.length < 2000) {
      await interaction.reply(data.pretty);
    } else {
      const pretty = `[${Object.values(data.value).map(({ id, regexp }) => `\n  ["${id}", "${regexp}"]`).join(',')}\n]`;
      await interaction.reply({
        content: '**STICKER 一覧**',
        files: [{ name: 'STICKERS.md', attachment: Buffer.from(pretty) }]
      });
    }
  }

  /** ヘルプを表示する。 */
  private help(interaction: ChatInputCommandInteraction) {
    const text = PrettyText.helpList(STICKER_HELP.DESC, ...STICKER_HELP.ITEMS);
    return interaction.reply(text);
  }

  /** チャットからStickerの正規表現を検知した場合、DETECT_STICKER_RATEに従ってStickerを送信する。 */
  private async sendSticker({ channel, mentions, content }: Message) {
    const detectSticker = async ({ content, mentions }: Pick<Message, 'content' | 'mentions'>) => {
      const hasUrl = content.includes('http');
      const mentioned = !!this.client.user && mentions.has(this.client.user);
      const failedRandom = Math.random() >= (Number(DETECT_STICKER_RATE) || 0);
      if (mentioned || hasUrl || failedRandom) { return null; }

      const data = this.stickersStore.data().value;
      const stickers = Object.values(data);
      const targetContent = content.slice(0, MAX_STICKER_TARGET_LENGTH);
      const urls = stickers.reduce<string[]>((acc, { id, regexp }) => {
        const compiled = this.buildStickerRegexp(regexp);
        return compiled && compiled.test(targetContent) ? acc.concat(id) : acc;
      }, []);
      if (urls.length === 0) { return null; }

      const url = urls[Math.floor(Math.random() * urls.length)];
      const regexp = data[url]?.regexp ?? '';
      return `${url} ||/${regexp}/||`;
    };
    const text = await detectSticker({ mentions, content });
    if (text) { sendToChannel(channel, text); }
  }

  private buildStickerRegexp(pattern: string): RegExp | null {
    try {
      return new RegExp(pattern);
    } catch {
      return null;
    }
  }
}
