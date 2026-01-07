メンションを行うとAIエージェントとの対話ができて、butlerの機能を使ったり、Discord.jsの機能を使ったりして、ユーザーの要望に答えてくれる。

```
@butler 最近会話に出てきたイベントで、期限が迫ってる順にリストにして
```
-> Discord.jsの機能を利用してログを遡っていい感じにまとめてくれる

```
@butler 1週間分の料理のレシピをmemo機能でまとめて
```
-> `/butler memo set` 機能を利用して、いい感じにまとめてくれる

# 仕様(方針)
- 対象チャンネル: 全チャンネルでメンション有効
- 返信フォーマット: PrettyText を基本。 ただしAIがより良い見た目を自律判断できる
- エラー表示: PrettyText.code(errorcode, message)
- AIが利用できるコマンドはスラッシュコマンドのみ
- AIはスラッシュコマンドを自律的に選択し、必要な情報を取得する
- 初期コンテキストはメンション本文のみ
- ログ参照はスラッシュコマンドとして実装する
- プロンプトは安全な固定文 + 追記(ENV)で拡張する

# 参照ツール(案)
- /butler log recent channel:<id> limit:<n>
- /butler log search channel:<id> query:<text> since:<date> until:<date> limit:<n>
- /butler log daily-summary channel:<id> date:<date>

# 日次要約(SQLite)
- 単位: channel_id + date で保存(チャンネル単位の日次要約)
- 対象: 全チャンネル
- 生成: 日付が変わってから最初の呼び出し時に、前日分をバックグラウンドで非同期生成
- 保持: 無期限
- 内容: 自由文1段落。 Twitterで人に伝えられる程度の情報量を目安

# AIプロバイダ切替(ドラフト)
- 目的: 利用者が契約済み/利用中のAIプロバイダを選んで使えるようにする(フェイルオーバーではない)
- 対象プロバイダ: gemini / workersai / openai / claude (公式の呼称に寄せる)
- 指定: AI_PROVIDER / AI_MODEL / AI_API_KEY (Workers AIのみAI_CLOUDFLARE_ACCOUNT_IDが必要)
- 実装方針: プロバイダごとのアダプタを用意し、共通インターフェイスで利用する
- 初期スコープ: まずは連携が第一目標。 高度な機能(ストリーミング等)は後回し

# 認証/設定(アイディア)
- Discordモーダル等で API Key / Provider / Model を設定できると理想だが、誰のキーを使うか等の導線が課題になるためアイディア段階に留める
- 実際にはプロバイダごとに認証方式が異なるため、中間層で吸収する前提で設計する

# 実装構成(案)
- core に AI の中間層を置き、worker からは共通APIとして利用する
- 例:
  - packages/core/src/
    - ai-provider.ts (types + interface + factory を統合)
    - ai-gemini.provider.ts / ai-workersai.provider.ts / ai-openai.provider.ts / ai-claude.provider.ts
    - tools/* (スラッシュコマンドをツール宣言として集約)
  - packages/worker/src/services/
    - ai-agent.service.ts / interactive.service.ts
  - packages/worker/src/commands/
    - slash-command-tools.ts

# 実装状況(2026-01-07)
- Gemini/OpenAI/Claude/Workers AIの最小連携を実装済み(応答が返るところまで)
- provider中間層(core)を追加し、AI_PROVIDER/AI_MODEL/AI_API_KEYで切替できる土台を用意
- ai-provider.ts に types/interface/factory を統合(階層をフラット化)
- Gemini 503/429/500に対する指数バックオフを実装
- systemプロンプトを簡素化し、ツール利用の方針のみ記述
- メンション時はリプライで返し、会話コンテキストはハイブリッドで保持
  - 最大5セッションをLRUで保持
  - セッション内は最大20件
  - メモリにない返信は返信チェーンから再構築
- スラッシュコマンドのツール化(定義+実行)を実装
- プロンプトは安全な固定文 + AI_PROMPT_APPEND で追記可能
- compose.override.yaml.sample にAI系ENVを追加

# 未対応(次の工程)
- ツール呼び出しの挙動調整(必要時のみ呼ぶ/確認が必要な操作)
- ログ参照系スラッシュコマンドの実装
- 日次要約(SQLite)の生成/保持
- READMEは全プロバイダ実装後に刷新する(環境変数/切替例/AI前提の説明/リポジトリ名butler.ai想定)
