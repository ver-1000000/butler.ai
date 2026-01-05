# Repository Guidelines

## Project Structure & Module Organization
このリポジトリは npm workspaces のモノレポで、`packages/` 配下に各パッケージがあります。
- `packages/core/` 共通定数と環境変数ローダー。
- `packages/worker/` Discord Bot 本体。`src/services/` に機能、`src/stores/` に永続化、`src/models/` にモデル、`src/assets/` に音声などの素材。
- `packages/web/` Next.js UI。`pages/` が画面と API ルート、`styles/` がスタイル、`server/` にサーバー側の入口。
ルート `tsconfig.json` は参照ビルド用で、共通設定は `tsconfig.base.json` にあります。

## Build, Test, and Development Commands
- `npm ci` 依存関係を一括インストール。
- `npm run dev` web と worker を同時に開発起動。
- `npm run dev --prefix packages/worker` Bot だけ起動。
- `npm run dev --prefix packages/web` UI だけ起動。
- `npm run build` 参照ビルドで全パッケージをコンパイル。
- `npm run start` ビルド済みの web/worker を起動。
- `npm run clean` `dist/` と `*.tsbuildinfo` を削除。
- `npm run lint --prefix packages/web` Next.js の ESLint。

## Coding Style & Naming Conventions
- TypeScript（strict）。Node 16 を前提。
- インデントは 2 スペース。
- worker のファイル命名は `*.service.ts` / `*.store.ts` / `*.model.ts`（kebab case）。
- Discord コマンドのヘルプ文は実装と同じファイルに置く方針。

## Testing Guidelines
自動テストは未整備です。変更時は手動確認を必須とします。
- worker: Discord サーバーでコマンド動作を確認。
- web: 画面と API ルートをローカルで確認。

## Commit & Pull Request Guidelines
- Conventional Commits 形式（例: `feat(@butler/web): add UI`）。
- 破壊的変更は本文に `BREAKING CHANGE:` を追加。
- PR は概要、関連 Issue、UI 変更のスクリーンショット/GIF を記載。

## Configuration & Secrets
- `.env.sample` を `.env` にコピーして設定。
- 例: `DISCORD_TOKEN`, `REDIS_URL`, `NOTIFY_TEXT_CHANNEL_ID`。
