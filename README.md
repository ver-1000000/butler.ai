# バトラー
Node.jsサーバーで動作させることを前提とした、TypeScript実装のDiscord Botです。 AI連携を前提とした設計になっています。

GCP e2-micro / Oracle Always Free VMにデプロイすると無料枠で動かせてイイカンジです

- https://github.com/ver-1000000/butler.git

## 機能
- メンションでAIに相談し、必要に応じてスラッシュコマンドを自律実行
- ボイスチャンネルが開始された際の通知
- `/butler` スラッシュコマンド群
  - `/butler memo`: 発言メモのCRUD
  - `/butler pomodoro`: 擬似ポモドーロタイマー
  - `/butler wiki`: Wikipediaの概要を引用して返答
  - `/butler sticker`: 正規表現に反応するスタンプ登録/管理

それぞれのコマンドの詳細については、実装をご覧いただくか、本Bot起動後、コマンドに引数を付けずに実行することで詳細なヘルプが表示されます。

## AI連携
AIプロバイダは環境変数で切り替えます。 例: `AI_PROVIDER=gemini`。

- 対応プロバイダ: gemini / openai / claude / workersai
- Workers AIは`AI_CLOUDFLARE_ACCOUNT_ID`が必要

## ファイル・ディレクトリ構成
本プロジェクトは [npmのWorkspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)を利用したモノリポ構成となっております。

```
.
├── package.json
├── tsconfig.base.json    # モノリポのパッケージ達に継承されるベースのtsconfig.json
├── tsconfig.json         # referencesで関連のtsconfig.jsonをまとめる、ビルド用tsconfig.json
├── packages/             # モノリポのパッケージ郡が格納されるディレクトリ
│   ├── core/             # 共通で利用するライブラリや定数、機能など
│   │   └── ... # 省略
│   ├── worker/           # Discordのイベントを常時監視するワーカー関連の機能
│   │   └── ... # 省略
│   └── web/              # ブラウザからBOTを操作するための、Next.jsによるUIを提供 (開発中)
│       └── ... # 省略
└── ... # 省略
```

## Discordサーバー連携
1. Discord開発者ポータルを開く: https://discord.com/developers/applications
2. 連携対象のアプリを選択(ない場合は、`New Application`)して、左メニューから「OAuth2」→「URL Generator」を開く
3. Scopesで `bot` と `applications.commands` を選択する
4. 現状、必要な最低限のBot Permissionsは次の通り:
   - View Channels / Send Messages / Read Message History
   - Add Reactions / Manage Messages(リアクションの一括削除に必要)
   - Connect / Speak / Mute Members(ポモドーロ用の音声参加/再生/ミュート制御に必要)
   - Embed Links(引用やリンクの見栄えを整えるために必要)
5. 生成されたURLをコピーしてブラウザで開く
6. 追加先のDiscordサーバーを選択して「認証」する
7. 認証後、サーバー内にボットが参加していることを確認する
8. 以降の起動手順に進む(環境変数の `DISCORD_TOKEN` が必要)

## 開発・デプロイ
開発・デプロイはDocker Composeを利用し、運用時はGHCR(GitHub Container Registry)のイメージをpullして起動します。

最新のDocker DesktopにはComposeがデフォルトでバンドルされていますが、
Docker Desktopを使わない環境では、Docker Composeを自前でインストールする必要があります。

### 運用/本番
1. `compose.override.yaml.sample`をコピーして`compose.override.yaml`を作成する
2. `compose.override.yaml`の環境変数などを自身の運用環境のものに書き換える(このファイルはGit管理しない)
3. (新しいイメージがある場合は) `docker compose pull`を実行してイメージを更新する
4. `docker compose up -d`を実行する (`-d` デタッチドモードで起動する。 コンソールにログを表示させたい場合は省略する)

### 開発(ローカル)
1. `compose.override.yaml.sample`をコピーして`compose.override.yaml`を作成する
2. `compose.override.yaml`の環境変数などを自身の運用環境のものに書き換え、 **開発用のコメントを外す**
   - `image: ghcr.io/ver-1000000/butler:dev`
   - `command: npm run dev:*`
   - `volumes: ./:/app` と `butler-node-modules:/app/node_modules`
   - 必要なら `NODE_ENV: "development"` を有効化する
3. `docker compose pull`を実行する
4. `docker compose up -d`を実行する

開発時はボリュームマウントにより、ローカルのコード変更がコンテナに即時反映されます。

#### 依存関係を変更したい場合
- `package.json`/`package-lock.json` を変更した場合は、devイメージの更新が必要です。
  - mainへマージされればGitHub Actionsでdevイメージが更新されるため、`docker compose pull` し直してください。
  - すぐに試したい場合は、コンテナ内で `npm install` を実行してください(例: `docker compose exec worker npm install`)。

### [GCP e2-micro](https://console.cloud.google.com/compute/instancesAdd)へのデプロイ例
1. VMインスタンス(e2-micro)を作成し、必要であればVPCネットワークのファイアウォールルールでポート3000の上りパケットを許可する
2. VM内でDocker/Docker ComposeとGitを整え、リポジトリをクローンする

このあとは、前述の「運用/本番」手順に従ってください。

## 環境変数(compose.override.yamlのenvironment)の説明
- `DISCORD_TOKEN`: Discord APIを利用するために必要なトークン
- `DISCORD_GUILD_ID`: スラッシュコマンドをギルド限定で登録する場合のギルドID(未設定の場合はグローバル登録)
- `NOTIFY_TEXT_CHANNEL_ID`: 通知など、BOTが自発的に発言する際のテキストチャンネルID
- `POMODORO_VOICE_CHANNEL_ID`: ポモドーロ機能で利用するボイスチャンネルのID
- `DETECT_STICKER_RATE`: チャットがstickerの正規表現にマッチした際の反応率を、0.0-1.0で記述(0は無効化、1.0のときは必ず反応)
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
- `POMODORO_VOICE_CHANNEL_ID`: ポモドーロ用ボイスチャンネル名を右クリック → 「IDをコピー」
