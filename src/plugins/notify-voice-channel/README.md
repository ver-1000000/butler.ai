# notify-voice-channel

ボイスチャンネル開始を通知する常駐型プラグイン。

## 役割

- 音声チャンネルで最初の参加者を検知する
- 通知チャンネルへ開始メッセージを送る
- AIツールや `/butler` サブコマンドは公開しない

## ファイル構成

- `manifest.ts`
  - startのみを持つプラグインマニフェスト
  - 起動時に `NotifyVoiceChannelService` を開始
- `notify-voice-channel.service.ts`
  - `voiceStateUpdate` を監視して通知を送信
