# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Butler is a TypeScript Discord Bot with pluggable AI provider integration. It runs on Node.js 22.x and uses discord.js v14. Written in Japanese (commits, docs, comments).

## Commands

```bash
npm ci                # Install dependencies
npm run dev           # Development with hot reload (ts-node-dev)
npm run build         # Compile TypeScript to dist/
npm run start         # Run production build (NODE_ENV=production)
npm run clean         # Remove dist/ and *.tsbuildinfo
```

No automated tests exist. Changes are verified manually on a Discord server.

## Architecture

### Core (`src/core/`)
- **`environment.ts`** - All environment variables exported as constants
- **`ai-provider.ts`** - `AiProvider` interface and `createAiProvider()` factory. Providers: `gemini`, `openai`, `claude`, `workersai`
- **`ai-*.provider.ts`** - Provider implementations. Each converts between internal `AiMessage`/`AiToolCall` types and provider-specific API formats
- **`sqlite.ts`** - SQLite singleton (WAL mode) at `data/butler.sqlite`

### Features (`src/features/`)
- **`ai/agent.service.ts`** - Agentic loop: sends messages to AI provider, executes tool calls, feeds results back (max 3 iterations)
- **`ai/conversation.service.ts`** - In-memory LRU session manager (5 sessions, 20 messages each). Maps Discord message IDs to conversation sessions
- **`ai/interactive.service.ts`** - Discord message event handler. Routes: direct mention -> new session, reply to bot -> continue session, reply to other message -> rehydrate context from message chain
- **`commands/slash-commands.ts`** - Slash command registration (guild-specific or global)
- **`commands/slash-command-tools.ts`** - Exposes slash commands as AI tool definitions
- **`notify/notify-voice-channel.service.ts`** - Notifies when first user joins a voice channel

### Bootstrap flow
`main.ts` loads dotenv -> `app.ts` creates Discord client, instantiates services, registers event handlers, logs in, sets up graceful shutdown (SIGINT/SIGTERM)

## Conventions

- File naming: kebab-case with suffixes `*.service.ts`, `*.store.ts`, `*.model.ts`
- Commits: Conventional Commits format, **always in Japanese** (e.g., `feat: 機能を追加`)
- Breaking changes: add `BREAKING CHANGE:` in commit body
- No Docker - runs directly on Node.js with `.env` for configuration
