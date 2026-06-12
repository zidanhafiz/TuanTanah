# Tuan Tanah backend — runs via tsx (no separate tsc build for MVP).
FROM node:20-alpine

RUN corepack enable

WORKDIR /app

# Workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile --filter @tuan-tanah/server... --prod=false

# Source
COPY tsconfig.base.json ./
COPY shared ./shared
COPY server ./server

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/server
CMD ["pnpm", "start"]
