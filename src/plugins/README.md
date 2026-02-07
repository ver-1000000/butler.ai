# Plugins開発ガイド

このドキュメントは、`src/plugins/` 配下に新しいプラグインを追加する開発者向けの手順です

## 目的

- プラグイン追加時の迷いをなくす
- `/butler` サブコマンドとAIツール実行を同じ実装で提供する
- `main.ts` に個別の初期化コードを増やさない

## 先に読むファイル

- `src/plugins/manifest.types.ts`
- `src/plugins/index.ts`
- `src/plugins/event-reminder/manifest.ts`

## 必須ファイル構成

新しいプラグイン `sample-plugin` を作る場合の最小構成

```text
src/plugins/
  sample-plugin/
    manifest.ts
    ... 実装ファイル
```

## manifest.tsの実装ルール

`manifest.ts` は `PluginManifest` を `default export` する

- `id`
  - プラグイン識別子
  - 既存と重複しない文字列にする
- `tools`
  - `/butler` サブコマンドとAI公開用の定義
  - `name` は `/butler` のサブコマンド名としてそのまま使われる
- `handlers`
  - `tools[].name` と同名キーで処理を実装する
  - 引数は `args` と `context` を受ける
  - `guildId` や `userId` は `context` から取得する
- `start`(任意)
  - cronや監視処理など、起動時に開始する処理を置く

## 実装例

```ts
import type { Client } from 'discord.js';
import type { PluginManifest } from '../manifest.types';

const manifest: PluginManifest = {
  id: 'sample-plugin',
  tools: [
    {
      name: 'sample_action',
      description: 'サンプル処理',
      arguments: [
        { name: 'text', description: '入力テキスト', required: true }
      ]
    }
  ],
  handlers: {
    sample_action: async (args, context) => {
      const text = typeof args.text === 'string' ? args.text : '';
      const guildId = context.guildId;
      const userId = context.userId;
      if (!guildId || !userId) return 'サーバー内で実行してください';
      return `ok: ${text}`;
    }
  },
  start: (_client: Client) => {
    // 必要な場合のみ実装
  }
};

export default manifest;
```

## 登録手順

`src/plugins/index.ts` の `plugins` 配列に追加する

```ts
import samplePlugin from './sample-plugin/manifest';

const plugins: PluginManifest[] = [
  eventReminder,
  samplePlugin
];
```

## 実装時の注意

- `guild_id` や `created_by` をツール引数に含めない
- 実行コンテキストは `PluginToolContext` を使う
- `/butler` からもAIからも同じ `handlers` を通す
- エラーメッセージは利用者が次の行動を取りやすい文にする

## 動作確認

- `npm run build`
- Discord上で `/butler <subcommand>` を実行
- メンション経由のAI実行でも同じ処理が呼ばれることを確認
