import { Client, Message, type MessageCreateOptions } from 'discord.js';

import { PrettyText } from '../lib/pretty-text';
import { MemosStore } from '../stores/memos.store';

/** メッセージ(`content`)からコマンドに該当する文字列を除外する。 */
const trimCommandsForConent = (content: string) => content.replace(/!memo\.?\w*\s*\n*/, '').trim();

/** `GenerateText.help`に食わせるヘルプ文の定数。 */
const HELP = {
  DESC: `\`!memo\` コマンド - タイトルと本文のセットからなるメモを 登録/読取り/更新/削除 する機能`,
  ITEMS: [
    ['!memo.get hoge', '`"hoge"`の値を取得します'],
    ['!memo.set hoge foo', '`"hoge"` に値として `"foo"` を設定します(値はマークダウンや改行が可能)'],
    ['!memo.remove hoge', '設定済の `"hoge"` の値を削除します'],
    ['!memo.list', 'メモされた値をすべて表示します'],
    ['!memo.help', '`!memo` コマンドのヘルプを表示します(エイリアス: `!memo`)'],
  ]
} as const;

type SendableChannel = Message['channel'] & { send: (content: string | MessageCreateOptions) => Promise<unknown> };

const sendToChannel = (channel: Message['channel'], content: string | MessageCreateOptions) => {
  if (!('send' in channel)) { return; }
  return (channel as SendableChannel).send(content);
};

/** `MemoStore`の値を操作するサービスクラス。 */
export class MemoService {
  constructor(private client: Client, private memosStore: MemosStore) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('messageCreate', message => this.onMessage(message));
    return this;
  }

  /** `mesage`で関数を振り分けるファサード。 */
  private onMessage(message: Message) {
    const content = message.content;
    if (message.author.bot) { return; } // botの発言は無視
    if (content.startsWith('!memo.get')) { this.get(message); };
    if (content.startsWith('!memo.set')) { this.set(message); };
    if (content.startsWith('!memo.remove')) { this.remove(message); };
    if (content.startsWith('!memo.list')) { this.list(message); };
    if (content.startsWith('!memo.help') || content === '!memo') { this.help(message); };
  }

  /** keyにマッチする値を取得する。 */
  private async get({ channel, content }: Message) {
    const key = trimCommandsForConent(content);
    sendToChannel(channel, (await this.memosStore.get(key)).pretty);
  }

  /**
   * bodyの最初の空白(もしくは改行)で前半部と後半部を分け、
   * 前半部をキーに、後半部を値にしたものをmemoとして登録する。
   */
  private async set({ channel, content }: Message) {
    const body  = trimCommandsForConent(content);
    const key   = body.replace(/\s.*/g, '');
    const value = body.replace(key, '').trim();
    sendToChannel(channel, (await this.memosStore.set(key, value)).pretty);
  }

  /** bodyにマッチする値を削除する。 */
  private async remove({ channel, content }: Message) {
    const body  = trimCommandsForConent(content);
    sendToChannel(channel, (await this.memosStore.del(body)).pretty);
  }

  /** memoの値を一覧する。 */
  private async list({ channel }: Message) {
    const pretty = (await this.memosStore.data()).pretty;
    if (pretty.length < 2000) {
      sendToChannel(channel, pretty);
    } else {
      sendToChannel(channel, { content: '**MEMO 一覧**', files: [{ name: 'MEMO.md', attachment: Buffer.from(pretty) }] });
    }
  }

  /** ヘルプを表示する。 */
  private help({ channel }: Message) {
    const text = PrettyText.helpList(HELP.DESC, ...HELP.ITEMS);
    sendToChannel(channel, text);
  }
}
