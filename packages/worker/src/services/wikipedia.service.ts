import type { RequestInfo, RequestInit, Response } from 'node-fetch';

import { Client, Message, type MessageCreateOptions } from 'discord.js';
import { PrettyText } from '../lib/pretty-text';


/** メッセージ(`content`)からコマンドに該当する文字列を除外する。 */
const trimCommandsForConent = (content: string) => content.replace(/!wiki\.?\w*\s*\n*/, '').trim();

/** `GenerateText.help`に食わせるヘルプ文の定数。 */
const HELP = {
  DESC: `\`!wiki\` コマンド - 指定した言葉の概要を、Wikipediaから引用して表示する機能`,
  ITEMS: [
    ['!wiki hoge', 'Wikipediaから`"hoge"`のサマリーを取得し、引用します'],
    ['!wiki.help', '`!wiki` コマンドのヘルプを表示します(エイリアス: `!wiki`)'],
  ]
} as const;

/** MediaWiki APIへサマリー取得した時のレスポンス。 */
interface WikipediaResponce {
  batchcomplete: string;
  query: {
    normalized: { from: string, to: string }[],
    redirects: { from: string, to: string }[],
    pages: {
      [pageid: string]: {
        pageid?: number,
        ns: number,
        title: string,
        extract?: string,
        missing?: ''
      }
    }
  }
}

/** Wikipediaから言葉を検索して表示するサービスクラス。 */
export class WikipediaService {
  constructor(private client: Client) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('messageCreate', message => this.onMessage(message));
  }

  /** Messageから各処理を呼び出すFacade関数。 */
  private onMessage(message: Message) {
    const content = message.content;
    if (message.author.bot) { return; } // botの発言は無視
    if (content.startsWith('!wiki.help') || content === '!wiki') { this.help(message); };
    if (content.startsWith('!wiki ')) { this.summary(message); };
  }

  /** wikiからコンテンツのサマリーを取得する。 */
  private async summary({ channel, content }: Message) {
    try {
      type FetchFn = (url: RequestInfo, init?: RequestInit) => Promise<Response>;
      const fetch: FetchFn = (url, init) =>
        import('node-fetch').then(({ default: fetch }) => fetch(url, init));
      const HOST    = 'https://ja.wikipedia.org/';
      const QUERY   = 'w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=';
      const word    = trimCommandsForConent(content);
      const res     = await (await fetch(`${HOST}${QUERY}${encodeURIComponent(word)}`)).json() as WikipediaResponce;
      const pages   = Object.values(res.query.pages);
      const items   = pages.reduce((a: [string, string][], b) => b.extract ? [...a, [b.title, b.extract] as [string, string]] : a, []);
      const success = () => PrettyText.markdownList(`<${HOST}?curid=${pages[0].pageid}> \`[${word}]\``, ...items);
      const fail    = () => `\`${word}\` はWikipediaで検索できませんでした:smiling_face_with_tear:`;
      const text    = items.length ? success() : fail();
      this.sendToChannel(channel, text);
    } catch (e) {
      this.sendToChannel(channel, '検索に失敗しました:smiling_face_with_tear: Wikipediaのサーバーに何かあったかもしれません:pleading_face:');
    }
  }

  /** ヘルプを表示する。 */
  private help({ channel }: Message) {
    const text = PrettyText.helpList(HELP.DESC, ...HELP.ITEMS);
    this.sendToChannel(channel, text);
  }

  private sendToChannel(channel: Message['channel'], content: string | MessageCreateOptions) {
    type SendableChannel = Message['channel'] & { send: (content: string | MessageCreateOptions) => Promise<unknown> };
    if (!('send' in channel)) { return; }
    return (channel as SendableChannel).send(content);
  }
}
