import { type ChatInputCommandInteraction, Client } from 'discord.js';
import { PrettyText } from '../utils/pretty-text.util';
import { dynamicFetch } from '../utils/fetch.util';

/** `GenerateText.help`に食わせるヘルプ文の定数。 */
const HELP = {
  DESC: '`/butler wiki` コマンド - 指定した言葉の概要を、Wikipediaから引用して表示する機能',
  ITEMS: [
    ['/butler wiki summary word:hoge', 'Wikipediaから`"hoge"`のサマリーを取得し、引用します'],
    ['/butler wiki help', '`/butler wiki` コマンドのヘルプを表示します'],
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
    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) { return; }
      if (interaction.commandName !== 'butler') { return; }
      if (interaction.options.getSubcommandGroup() !== 'wiki') { return; }
      await this.onCommand(interaction);
    });
  }

  /** Slash Commandから各処理を呼び出すFacade関数。 */
  private async onCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'summary') { await this.summary(interaction); }
    if (subcommand === 'help') { await this.help(interaction); }
  }

  /** wikiからコンテンツのサマリーを取得する。 */
  private async summary(interaction: ChatInputCommandInteraction) {
    try {
      const HOST    = 'https://ja.wikipedia.org/';
      const QUERY   = 'w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=';
      const word    = interaction.options.getString('word', true);
      const res     = await (await dynamicFetch(`${HOST}${QUERY}${encodeURIComponent(word)}`)).json() as WikipediaResponce;
      const pages   = Object.values(res.query.pages);
      const items   = pages.reduce((a: [string, string][], b) => b.extract ? [...a, [b.title, b.extract] as [string, string]] : a, []);
      const success = () => PrettyText.markdownList(`<${HOST}?curid=${pages[0].pageid}> \`[${word}]\``, ...items);
      const fail    = () => `\`${word}\` はWikipediaで検索できませんでした:smiling_face_with_tear:`;
      const text    = items.length ? success() : fail();
      await interaction.reply(text);
    } catch (e) {
      const errorMessage = '検索に失敗しました:smiling_face_with_tear: Wikipediaのサーバーに何かあったかもしれません:pleading_face:';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }

  /** ヘルプを表示する。 */
  private help(interaction: ChatInputCommandInteraction) {
    const text = PrettyText.helpList(HELP.DESC, ...HELP.ITEMS);
    return interaction.reply(text);
  }
}
