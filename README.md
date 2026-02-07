# バトラー
Node.jsサーバーで動作させることを前提とした、TypeScript実装のDiscord Botです。 AI連携を前提とした設計になっています。

GCP e2-micro / Oracle Always Free VMにデプロイすると無料枠で動かせてイイカンジです

- https://github.com/ver-1000000/butler.ai

## 機能
- メンションでAIに相談し、必要に応じてスラッシュコマンドを自律実行
- `/butler` スラッシュコマンドのサブコマンド実行
- イベントリマインダーの作成と定期通知
- ボイスチャンネルが開始された際の通知

## プラグイン
このBotにおけるプラグインとは、非コア機能をモジュールとして追加するための単位です。
各プラグインは `src/plugins/<plugin-name>/manifest.ts` でマニフェストを公開し、起動時に一括登録されます。

プラグインの具体的な追加手順は `src/plugins/README.md` を参照してください。

- ユーザー向けの入口は `/butler <subcommand>` に統一される
- AI経由の実行でも同じツールハンドラを通る
- 非コア機能を `src/plugins/` 配下に閉じ込めて差し替えしやすくする

## AI連携
AIプロバイダは環境変数で切り替えます。 例: `AI_PROVIDER=gemini`。

- 対応プロバイダ: gemini / openai / claude / workersai
- Workers AIは`AI_CLOUDFLARE_ACCOUNT_ID`が必要

## ファイル・ディレクトリ構成
```
.
├── package.json
├── tsconfig.json
├── src/
│   ├── assets/           # アセット(予定)
│   ├── core/             # 環境変数/共通ロジック
│   ├── runtime/          # Discord Botの実行機構
│   ├── plugins/          # プラグイン実装とマニフェスト
│   └── utils/            # 汎用ユーティリティ
└── ... # 省略
```

## Discordサーバー連携
1. Discord開発者ポータルを開く: https://discord.com/developers/applications
2. 連携対象のアプリを選択(ない場合は、`New Application`)して、左メニューから「OAuth2」→「URL Generator」を開く
3. Scopesで `bot` と `applications.commands` を選択する
4. 現状、必要な最低限のBot Permissionsは次の通り:
   - View Channels / Send Messages / Read Message History
   - Add Reactions / Manage Messages(リアクションの一括削除に必要)
   - Manage Events(イベントリマインダーの作成/更新に必要)
   - Connect / Speak / Mute Members(今後の音声機能を利用する場合に必要)
   - Embed Links(リンクを整形して表示する場合に必要)
5. 生成されたURLをコピーしてブラウザで開く
6. 追加先のDiscordサーバーを選択して「認証」する
7. 認証後、サーバー内にボットが参加していることを確認する
8. 以降の起動手順に進む(環境変数の `DISCORD_TOKEN` が必要)

## 開発・デプロイ
npmを前提にローカルで動かします。

### 運用/本番
1. `.env.example`をコピーして`.env`を作成する
2. `.env`に本番用の値を記入する(このファイルはGit管理しない)
3. `npm ci`を実行する
4. `npm run build`を実行する
5. `npm run start`を実行する

### 開発(ローカル)
1. `.env.example`をコピーして`.env`を作成する
2. `.env`に開発用の値を記入する
3. `npm ci`を実行する
4. `npm run dev`を実行する

## 環境変数(.env)の説明
- `DISCORD_TOKEN`: Discord APIを利用するために必要なトークン
- `DISCORD_GUILD_ID`: `/butler` をギルド限定で登録する場合のギルドID(未設定の場合はグローバル登録)
- `NOTIFY_TEXT_CHANNEL_ID`: 通知など、BOTが自発的に発言する際のテキストチャンネルID
- `AI_PROVIDER`: 利用するAIプロバイダ(gemini / openai / claude / workersai)
- `AI_MODEL`: 利用するモデル名
- `AI_API_KEY`: AIプロバイダのAPIキー
- `AI_CLOUDFLARE_ACCOUNT_ID`: Workers AI利用時のみ必要なAccount ID (オプション)
- `AI_PROMPT_APPEND`: systemプロンプトへの追記

## その他
### IDの取得方法
事前に、ユーザー設定(⚙) → 詳細設定 → 開発者モードをONにし、それぞれ次の方法でIDを取得してください。

- `DISCORD_GUILD_ID`: サーバー名を右クリック → 「IDをコピー」
- `NOTIFY_TEXT_CHANNEL_ID`: 通知用テキストチャンネル名を右クリック → 「IDをコピー」
