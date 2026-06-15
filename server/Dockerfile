# Tuan Tanah backend — runs via tsx directly (no tsc build). tsx is a runtime
# dependency, so a --prod install keeps it while dropping dev-only tooling
# (typescript, vitest). Types are checked in CI via `pnpm check`, not here.
FROM node:20-alpine

RUN corepack enable

WORKDIR /app

# Workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile --filter @tuan-tanah/server... --prod

# Source
COPY tsconfig.base.json ./
COPY shared ./shared
COPY server ./server

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/server
CMD ["pnpm", "start"]
