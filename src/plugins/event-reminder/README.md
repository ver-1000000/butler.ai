# event-reminder

イベント作成とリマインド通知を提供するプラグイン。

## 役割

- `/butler event-reminder` からイベント登録を受け付ける
- 参加者向けのリマインド情報を保存する
- 定期実行でリマインド通知を送る

## ファイル構成

- `manifest.ts`
  - プラグインマニフェスト
  - ツール定義とハンドラを公開
  - 起動時に `EventReminderService` を開始
- `create-event-reminder.usecase.ts`
  - イベント登録処理のユースケース
- `event-reminder.service.ts`
  - cronでリマインド送信を実行
- `bot-meta.model.ts`
  - SQLiteのメタ情報モデル
- `reminder-timing.util.ts`
  - リマインド時刻の算出
