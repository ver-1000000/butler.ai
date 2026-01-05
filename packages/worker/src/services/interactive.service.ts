import { promises as fs } from 'fs';
import { Client, Message, type MessageCreateOptions } from 'discord.js';

/** BOTがメンションを受けた取ったときの対話挙動を定義するサービスクラス。 */
export class InteractiveService {
  constructor(private client: Client) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('messageCreate', message => this.onMessage(message));
  }

  /** Messageから各処理を呼び出すFacade関数。 */
  private onMessage(message: Message) {
    if (message.author.bot) { return; } // botの発言は無視
    if (['@everyone', '@here'].some(key => message.content.includes(key))) { return; } // everyone/hereが含まれていたら無視
    if (message.mentions.has(this.client.user || '')) { this.reply(message); };
  }

  /** リプライを受け取ったメンバーに対して、README.mdの内容をパースした概要を通知発言する。 */
  async reply({ author, channel }: Message) {
    const md          = await fs.readFile('../../README.md', 'utf-8');
    const section     = (token: string) => md.match(new RegExp(`${token}[\\s\\S]*?(#|$)`))?.[0].replace(/#$/, '').trim();
    const description = section('# ');
    const feature     = section('## 機能');
    const text        = '```md\n' + [description, feature].join('\n\n') + '\n```';
    this.sendToChannel(channel, `${author}\n${text}`);
  }

  private sendToChannel(channel: Message['channel'], content: string | MessageCreateOptions) {
    type SendableChannel = Message['channel'] & { send: (content: string | MessageCreateOptions) => Promise<unknown> };
    if (!('send' in channel)) { return; }
    return (channel as SendableChannel).send(content);
  }
}
