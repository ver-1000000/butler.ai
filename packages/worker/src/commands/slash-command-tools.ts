import type { AiToolCall, AiToolDefinition } from '@butler/core';
import { PrettyText } from '../utils/pretty-text.util';
import type { MemosStore } from '../stores/memos.store';
import type { StickersStore } from '../stores/stickers.store';
import { dynamicFetch } from '../utils/fetch.util';
import type { PomodoroService } from '../services/pomodoro.service';

/** スラッシュコマンドの引数定義。 */
export type SlashCommandToolArgument = {
  name: string;
  description: string;
  required: boolean;
};

/**
 * AIに公開するスラッシュコマンドのツール定義。
 */
export type SlashCommandToolDefinition = {
  name: string;
  description: string;
  arguments: SlashCommandToolArgument[];
};

/**
 * AIツール実行に必要な依存関係。
 */
export type SlashCommandToolContext = {
  memosStore: MemosStore;
  stickersStore: StickersStore;
  pomodoroService: PomodoroService;
};

const HELP = {
  memo: {
    DESC: '`/butler memo` コマンド - タイトルと本文のセットからなるメモを 登録/読取り/更新/削除 する機能',
    ITEMS: [
      ['/butler memo get key:hoge', '`"hoge"`の値を取得します'],
      ['/butler memo set key:hoge value:foo', '`"hoge"` に値として `"foo"` を設定します(値はマークダウンや改行が可能)'],
      ['/butler memo remove key:hoge', '設定済の `"hoge"` の値を削除します'],
      ['/butler memo list', 'メモされた値をすべて表示します'],
      ['/butler memo help', '`/butler memo` コマンドのヘルプを表示します']
    ]
  },
  pomodoro: {
    DESC: [
      '`/butler pomodoro` コマンド - 音声チャンネルを利用した**ポモドーロタイマー**機能',
      '(**ポモドーロタイマー用音声チャンネルに参加した状態**で、以下のコマンドを利用)'
    ].join('\n'),
    ITEMS: [
      ['/butler pomodoro start', 'ポモドーロタイマーを開始(リセット)します'],
      ['/butler pomodoro stop', 'ポモドーロタイマーを終了します'],
      ['/butler pomodoro status', '現在のポモドーロステータスを表示します'],
      ['/butler pomodoro help', '`/butler pomodoro` コマンドのヘルプを表示します']
    ]
  },
  wiki: {
    DESC: '`/butler wiki` コマンド - 指定した言葉の概要を、Wikipediaから引用して表示する機能',
    ITEMS: [
      ['/butler wiki summary word:hoge', 'Wikipediaから`"hoge"`のサマリーを取得し、引用します'],
      ['/butler wiki help', '`/butler wiki` コマンドのヘルプを表示します']
    ]
  },
  sticker: {
    DESC: '`/butler sticker` コマンド - チャットを監視して、正規表現にマッチしたスタンプ画像を表示する機能',
    ITEMS: [
      ['/butler sticker set url:http://example.com/hoge.jpg regexp:/abc/', '`http://example.com/hoge.jpg` に正規表現 `/abc/` を設定(新規追加/上書き)します'],
      ['/butler sticker remove url:http://example.com/hoge.jpg', '`http://example.com/hoge.jpg` が設定されていれば削除します'],
      ['/butler sticker list', '登録されている値を一覧します'],
      ['/butler sticker help', '`/butler sticker` コマンドのヘルプを表示します']
    ]
  }
} as const;

/**
 * 現時点でAIに公開するスラッシュコマンドのツール一覧を返す。
 */
export const getSlashCommandTools = (): SlashCommandToolDefinition[] => {
  return [
    {
      name: 'butler.memo.get',
      description: 'メモを取得する。',
      arguments: [
        { name: 'key', description: 'メモのキー', required: true }
      ]
    },
    {
      name: 'butler.memo.set',
      description: 'メモを登録/更新する。',
      arguments: [
        { name: 'key', description: 'メモのキー', required: true },
        { name: 'value', description: 'メモの本文', required: true }
      ]
    },
    {
      name: 'butler.memo.remove',
      description: 'メモを削除する。',
      arguments: [
        { name: 'key', description: 'メモのキー', required: true }
      ]
    },
    {
      name: 'butler.memo.list',
      description: 'メモを一覧する。',
      arguments: []
    },
    {
      name: 'butler.memo.help',
      description: 'メモ機能のヘルプを表示する。',
      arguments: []
    },
    {
      name: 'butler.pomodoro.start',
      description: 'ポモドーロを開始する。',
      arguments: []
    },
    {
      name: 'butler.pomodoro.stop',
      description: 'ポモドーロを停止する。',
      arguments: []
    },
    {
      name: 'butler.pomodoro.status',
      description: '現在のポモドーロの状態を表示する。',
      arguments: []
    },
    {
      name: 'butler.pomodoro.help',
      description: 'ポモドーロ機能のヘルプを表示する。',
      arguments: []
    },
    {
      name: 'butler.wiki.summary',
      description: 'Wikipediaの概要を取得する。',
      arguments: [
        { name: 'word', description: '検索する単語', required: true }
      ]
    },
    {
      name: 'butler.wiki.help',
      description: 'Wikipedia機能のヘルプを表示する。',
      arguments: []
    },
    {
      name: 'butler.sticker.set',
      description: 'スタンプを登録/更新する。',
      arguments: [
        { name: 'url', description: 'スタンプのURL', required: true },
        { name: 'regexp', description: 'マッチする正規表現', required: true }
      ]
    },
    {
      name: 'butler.sticker.remove',
      description: 'スタンプを削除する。',
      arguments: [
        { name: 'url', description: 'スタンプのURL', required: true }
      ]
    },
    {
      name: 'butler.sticker.list',
      description: 'スタンプを一覧する。',
      arguments: []
    },
    {
      name: 'butler.sticker.help',
      description: 'スタンプ機能のヘルプを表示する。',
      arguments: []
    }
  ];
};

/**
 * スラッシュコマンド定義をAIツール定義に変換する。
 */
export const getSlashCommandAiTools = (): AiToolDefinition[] => {
  return getSlashCommandTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: tool.arguments.reduce<Record<string, { type: 'string'; description?: string }>>((acc, arg) => {
        acc[arg.name] = { type: 'string', description: arg.description };
        return acc;
      }, {}),
      required: tool.arguments.filter(arg => arg.required).map(arg => arg.name)
    }
  }));
};

/**
 * AIからのツール呼び出しを実行する。
 * @param call ツール呼び出し
 * @param context 実行に必要な依存関係
 */
export const executeSlashCommandTool = async (
  call: AiToolCall,
  context: SlashCommandToolContext
): Promise<string> => {
  const args = call.arguments ?? {};

  if (call.name === 'butler.memo.get') {
    const key = String(args.key ?? '');
    return (await context.memosStore.get(key)).pretty;
  }
  if (call.name === 'butler.memo.set') {
    const key = String(args.key ?? '');
    const value = String(args.value ?? '');
    return (await context.memosStore.set(key, value)).pretty;
  }
  if (call.name === 'butler.memo.remove') {
    const key = String(args.key ?? '');
    return (await context.memosStore.del(key)).pretty;
  }
  if (call.name === 'butler.memo.list') {
    return (await context.memosStore.data()).pretty;
  }
  if (call.name === 'butler.memo.help') {
    return PrettyText.helpList(HELP.memo.DESC, ...HELP.memo.ITEMS);
  }
  if (call.name === 'butler.pomodoro.start') {
    return context.pomodoroService.startFromTool();
  }
  if (call.name === 'butler.pomodoro.stop') {
    return context.pomodoroService.stopFromTool();
  }
  if (call.name === 'butler.pomodoro.status') {
    return context.pomodoroService.statusFromTool();
  }
  if (call.name === 'butler.pomodoro.help') {
    return context.pomodoroService.helpFromTool();
  }
  if (call.name === 'butler.wiki.summary') {
    const word = String(args.word ?? '');
    return fetchWikipediaSummary(word);
  }
  if (call.name === 'butler.wiki.help') {
    return PrettyText.helpList(HELP.wiki.DESC, ...HELP.wiki.ITEMS);
  }
  if (call.name === 'butler.sticker.set') {
    const url = String(args.url ?? '');
    const regexp = String(args.regexp ?? '').replace(/^\/+|\/+$/g, '');
    return (await context.stickersStore.set(url, regexp)).pretty;
  }
  if (call.name === 'butler.sticker.remove') {
    const url = String(args.url ?? '');
    return (await context.stickersStore.del(url)).pretty;
  }
  if (call.name === 'butler.sticker.list') {
    return (await context.stickersStore.data()).pretty;
  }
  if (call.name === 'butler.sticker.help') {
    return PrettyText.helpList(HELP.sticker.DESC, ...HELP.sticker.ITEMS);
  }

  return `未対応のコマンドです: ${call.name}`;
};

/**
 * Wikipediaからサマリーを取得する。
 * @param word 検索語
 */
const fetchWikipediaSummary = async (word: string): Promise<string> => {
  const HOST = 'https://ja.wikipedia.org/';
  const QUERY = 'w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=';
  const res = await (await dynamicFetch(`${HOST}${QUERY}${encodeURIComponent(word)}`)).json() as {
    query: {
      pages: Record<string, { pageid?: number; title: string; extract?: string; }>;
    };
  };
  const pages = Object.values(res.query.pages);
  const items: [string, string][] = [];
  for (const page of pages) {
    if (page.extract) {
      items.push([page.title, page.extract]);
    }
  }
  const success = () => PrettyText.markdownList(`<${HOST}?curid=${pages[0].pageid}> \`[${word}]\``, ...items);
  const fail = () => `\`${word}\` はWikipediaで検索できませんでした:smiling_face_with_tear:`;
  return items.length ? success() : fail();
};
