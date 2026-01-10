import type { AiToolCall, AiToolDefinition } from '@butler/core';

import { PrettyText } from '../../utils/pretty-text.util';
import { dynamicFetch } from '../../utils/fetch.util';
import { MEMO_HELP } from '../memo/memo.service';
import { STICKER_HELP, validateStickerRegexp } from '../sticker/sticker.service';
import { WIKI_HELP } from '../wiki/wiki.service';
import type { MemosStore } from '../memo/memo.store';
import type { StickersStore } from '../sticker/sticker.store';
import type { PomodoroService } from '../pomodoro/pomodoro.service';

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

/** AIツールの実行関数。 */
type ToolHandler = (
  args: Record<string, unknown>,
  context: SlashCommandToolContext
) => Promise<string> | string;

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
      properties: tool.arguments.reduce<Record<string, { type: 'string'; description?: string }>>(
        (acc, arg) => {
          acc[arg.name] = { type: 'string', description: arg.description };
          return acc;
        },
        {}
      ),
      required: tool.arguments.filter(arg => arg.required).map(arg => arg.name)
    }
  }));
};

/** 引数を文字列として取得する。 */
const toStringArg = (args: Record<string, unknown>, key: string): string => {
  return String(args[key] ?? '');
};

/** AIツールの実行処理を定義する。 */
const TOOL_HANDLERS: Record<string, ToolHandler> = {
  'butler.memo.get': (args, context) => {
    const key = toStringArg(args, 'key');
    return context.memosStore.get(key).pretty;
  },
  'butler.memo.set': (args, context) => {
    const key = toStringArg(args, 'key');
    const value = toStringArg(args, 'value');
    return context.memosStore.set(key, value).pretty;
  },
  'butler.memo.remove': (args, context) => {
    const key = toStringArg(args, 'key');
    return context.memosStore.del(key).pretty;
  },
  'butler.memo.list': (_, context) => {
    return context.memosStore.data().pretty;
  },
  'butler.memo.help': () => {
    return PrettyText.helpList(MEMO_HELP.DESC, ...MEMO_HELP.ITEMS);
  },
  'butler.pomodoro.start': (_, context) => {
    return context.pomodoroService.startFromTool();
  },
  'butler.pomodoro.stop': async (_, context) => {
    return context.pomodoroService.stopFromTool();
  },
  'butler.pomodoro.status': (_, context) => {
    return context.pomodoroService.statusFromTool();
  },
  'butler.pomodoro.help': (_, context) => {
    return context.pomodoroService.helpFromTool();
  },
  'butler.wiki.summary': (args) => {
    const word = toStringArg(args, 'word');
    return fetchWikipediaSummary(word);
  },
  'butler.wiki.help': () => {
    return PrettyText.helpList(WIKI_HELP.DESC, ...WIKI_HELP.ITEMS);
  },
  'butler.sticker.set': (args, context) => {
    const url = toStringArg(args, 'url');
    const validation = validateStickerRegexp(toStringArg(args, 'regexp'));
    if (!validation.ok) {
      return validation.error;
    }
    return context.stickersStore.set(url, validation.value).pretty;
  },
  'butler.sticker.remove': (args, context) => {
    const url = toStringArg(args, 'url');
    return context.stickersStore.del(url).pretty;
  },
  'butler.sticker.list': (_, context) => {
    return context.stickersStore.data().pretty;
  },
  'butler.sticker.help': () => {
    return PrettyText.helpList(STICKER_HELP.DESC, ...STICKER_HELP.ITEMS);
  }
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
  const handler = TOOL_HANDLERS[call.name];
  if (!handler) {
    return `未対応のコマンドです: ${call.name}`;
  }
  return await handler(call.arguments ?? {}, context);
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
