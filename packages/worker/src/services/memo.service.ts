import { type ChatInputCommandInteraction, Client } from 'discord.js';

import { PrettyText } from '../utils/pretty-text.util';
import { MemosStore } from '../stores/memos.store';

/** `GenerateText.help`に食わせるヘルプ文の定数。 */
const HELP = {
  DESC: '`/butler memo` コマンド - タイトルと本文のセットからなるメモを 登録/読取り/更新/削除 する機能',
  ITEMS: [
    ['/butler memo get key:hoge', '`"hoge"`の値を取得します'],
    ['/butler memo set key:hoge value:foo', '`"hoge"` に値として `"foo"` を設定します(値はマークダウンや改行が可能)'],
    ['/butler memo remove key:hoge', '設定済の `"hoge"` の値を削除します'],
    ['/butler memo list', 'メモされた値をすべて表示します'],
    ['/butler memo help', '`/butler memo` コマンドのヘルプを表示します'],
  ]
} as const;

/** `MemoStore`の値を操作するサービスクラス。 */
export class MemoService {
  constructor(private client: Client, private memosStore: MemosStore) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) { return; }
      if (interaction.commandName !== 'butler') { return; }
      if (interaction.options.getSubcommandGroup() !== 'memo') { return; }
      await this.onCommand(interaction);
    });
    return this;
  }

  /** Slash Commandから各処理を呼び出すFacade関数。 */
  private async onCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'get') { await this.get(interaction); }
    if (subcommand === 'set') { await this.set(interaction); }
    if (subcommand === 'remove') { await this.remove(interaction); }
    if (subcommand === 'list') { await this.list(interaction); }
    if (subcommand === 'help') { await this.help(interaction); }
  }

  /** keyにマッチする値を取得する。 */
  private async get(interaction: ChatInputCommandInteraction) {
    const key = interaction.options.getString('key', true);
    await interaction.reply((await this.memosStore.get(key)).pretty);
  }

  /**
   * bodyの最初の空白(もしくは改行)で前半部と後半部を分け、
   * 前半部をキーに、後半部を値にしたものをmemoとして登録する。
   */
  private async set(interaction: ChatInputCommandInteraction) {
    const key   = interaction.options.getString('key', true);
    const value = interaction.options.getString('value', true);
    await interaction.reply((await this.memosStore.set(key, value)).pretty);
  }

  /** bodyにマッチする値を削除する。 */
  private async remove(interaction: ChatInputCommandInteraction) {
    const key = interaction.options.getString('key', true);
    await interaction.reply((await this.memosStore.del(key)).pretty);
  }

  /** memoの値を一覧する。 */
  private async list(interaction: ChatInputCommandInteraction) {
    const pretty = (await this.memosStore.data()).pretty;
    if (pretty.length < 2000) {
      await interaction.reply(pretty);
    } else {
      await interaction.reply({ content: '**MEMO 一覧**', files: [{ name: 'MEMO.md', attachment: Buffer.from(pretty) }] });
    }
  }

  /** ヘルプを表示する。 */
  private help(interaction: ChatInputCommandInteraction) {
    const text = PrettyText.helpList(HELP.DESC, ...HELP.ITEMS);
    return interaction.reply(text);
  }
}
