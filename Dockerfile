# syntax=docker/dockerfile:1.5
# ベースイメージ
FROM node:22-slim AS base
WORKDIR /app

# 依存関係(開発込み)のインストール
FROM base AS deps
ENV NPM_CONFIG_LOGLEVEL=error
RUN apt-get update && apt-get install -y --no-install-recommends \
    autoconf \
    automake \
    make \
    g++ \
    pkg-config \
    python3 \
    libtool \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/worker/package.json packages/worker/package.json
COPY packages/web/package.json packages/web/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# 開発用イメージ(依存関係のみ)
FROM deps AS dev

# ビルド成果物の作成
FROM deps AS build
COPY . .
RUN npm run build

# 本番依存のみのインストール
FROM base AS prod-deps
ENV NPM_CONFIG_LOGLEVEL=error
RUN apt-get update && apt-get install -y --no-install-recommends \
    autoconf \
    automake \
    make \
    g++ \
    pkg-config \
    python3 \
    libtool \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/worker/package.json packages/worker/package.json
COPY packages/web/package.json packages/web/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# 本番イメージ
FROM base AS runtime
WORKDIR /app
COPY --from=build /app /app
COPY --from=prod-deps /app/node_modules /app/node_modules
RUN mkdir -p /app/data
CMD ["npm", "run", "prod:worker"]
