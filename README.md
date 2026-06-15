# Tuan Tanah 🇮🇩

A real-time multiplayer web-based Monopoly game with an Indonesian theme. 2–8 players, two property tracks, role-based abilities, a pinjol (loan) system, themed cards, and structured negotiation.

See [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) and [`docs/TECHNICAL_REQUIREMENT.md`](docs/TECHNICAL_REQUIREMENT.md) for the full design and architecture.

## Status

Early scaffold + **vertical slice**: create room → lobby → pick role → start → roll dice → move → buy property → end turn, fully synced over Socket.io. Many mechanics (meta actions, full card effects, pinjol, tier upgrades, role abilities, elimination/win conditions) are stubbed for later milestones.

## Monorepo layout

```
shared/   ← TypeScript types + all game data (single source of truth, no build step)
server/   ← Fastify + Socket.io + pure game engine
client/   ← React + Vite + Tailwind + Zustand
```

The server is the source of truth. Clients only emit _requests_; the engine resolves them and the server broadcasts the full `GameState`.

## Prerequisites

- Node.js 20+ (tested on 24)
- pnpm 9+ (`corepack enable` then `corepack prepare pnpm@latest --activate`)
- Docker (optional — only needed for Redis persistence or full prod compose)

## Local development

```bash
pnpm install

# optional: persistent state via Redis (otherwise an in-memory store is used)
docker compose -f docker-compose.dev.yml up -d redis

pnpm dev          # server on :3000, client on :5173
```

Then open http://localhost:5173 in two browser tabs to create + join a room.

Useful scripts:

```bash
pnpm typecheck            # typecheck all workspaces
pnpm --filter server dev  # backend only
pnpm --filter client dev  # frontend only
```

### Redis vs in-memory

If `REDIS_URL` is unset or unreachable, the server falls back to an in-memory game store — handy for quick local dev. Set `REDIS_URL` (see `.env.example`) to use Redis so state survives a server restart.

## Production (VPS, HTTPS)

The prod stack is Docker Compose: **Caddy** (serves the built client, proxies the
API, auto-issues Let's Encrypt TLS) + **backend** + **redis**. No host build step —
the client is built inside the image.

```bash
cp .env.example .env      # set NODE_ENV, CORS_ORIGINS, DOMAIN, ACME_EMAIL
make deploy               # git pull + docker compose up -d --build
```

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full runbook (DNS, firewall, verify, ops).

## Environment

Copy `.env.example` to `.env`. Supabase is optional/deferred for the MVP — leave the keys blank to disable it.
