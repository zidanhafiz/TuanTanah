# Web tier: build the React client, then serve it (and reverse-proxy the API)
# with Caddy, which handles auto-TLS. Build context must be the repo root
# (docker-compose sets context: . / dockerfile: client/Dockerfile) because the
# build copies workspace manifests and the shared package from the root.
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
RUN pnpm install --frozen-lockfile --filter @tuan-tanah/client...
COPY tsconfig.base.json ./
COPY shared ./shared
COPY client ./client
# VITE_SERVER_URL is intentionally left unset: in prod the client talks to the
# backend same-origin through Caddy, so the socket connects to its own host.
RUN pnpm --filter @tuan-tanah/client build

FROM caddy:2-alpine
COPY --from=build /app/client/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
