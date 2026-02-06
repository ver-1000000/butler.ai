# Repository Guidelines
## Project Structure & Module Organization
このリポジトリは単一構成です。 `src/`配下に機能をまとめています。

- `src/core/` 共通定数と環境変数ローダー
- `src/features/` Discord Bot 本体の機能
- `src/utils/` 汎用ユーティリティ
- `src/assets/` アセット(予定)
- `src/plugins/` プラグイン(予定)

ルート `tsconfig.json` は単一構成のビルド設定です。

## Build, Test, and Development Commands
- `npm ci` 依存関係を一括インストール
- `npm run dev` Bot を開発起動
- `npm run build` TypeScript をビルド
- `npm run start` ビルド済みの Bot を起動
- `npm run clean` `dist/` と `*.tsbuildinfo` を削除

## Coding Style & Naming Conventions
- ファイル命名は `*.service.ts` / `*.store.ts` / `*.model.ts` / `*.util.ts` / `*.command.ts`(kebab case)
- Discord コマンドのヘルプ文は実装と同じファイルに置く方針

## Testing Guidelines
自動テストは未整備です。 変更時は手動確認を必須とします。

- Bot: Discord サーバーでコマンド動作を確認

## Commit & Pull Request Guidelines
- Conventional Commits 形式 (例: `feat: add feature`)
- 破壊的変更は本文に `BREAKING CHANGE:` を追加
- PR は概要、関連 Issue、UI 変更のスクリーンショット/GIF を記載
- コミットは必ず日本語で行う

## Configuration & Secrets
- `.env.example` を `.env` にコピーして設定
- 例: `DISCORD_TOKEN`, `NOTIFY_TEXT_CHANNEL_ID`
