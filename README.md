# Tuan Tanah 🇮🇩

A real-time multiplayer web-based Monopoly game with an Indonesian theme. 2–8 players, two property tracks, role-based abilities, a pinjol (loan) system, themed cards, and structured negotiation.

See [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) and [`docs/TECHNICAL_REQUIREMENT.md`](docs/TECHNICAL_REQUIREMENT.md) for the full design and architecture.

## Status

The full game loop is playable end-to-end, synced over Socket.io:

- Create / join / leave / rejoin rooms (shareable URLs, seat held by a reconnect token)
- Lobby: pick role, room-master settings, start
- Turns: roll → move → resolve tile (buy property, pay rent, tax, draw card, jail) → end turn
- Meta-actions (invest / work / hustle / sabotage / korupsi / negotiate)
- Property & tier upgrades, downgrades, and sells
- Pinjol (loan) system + debt resolution
- Structured negotiation deals between players
- Role active abilities, voting, elimination / bankruptcy cascade, and win conditions
- Game-over standings, optionally archived to Postgres

Client extras: neobrutalist design system, framer-motion animations, a sound system, and per-player EN/ID i18n. The engine and the client both have Vitest suites. Remaining work is balance/content tuning and a couple of residual server-side i18n gaps — see `CLAUDE.md`.

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
pnpm test                 # run the engine test suite (Vitest)
pnpm check                # typecheck + lint + format:check (full gate)
pnpm typecheck            # typecheck all workspaces
pnpm --filter server dev  # backend only
pnpm --filter client dev  # frontend only
```

A live gallery of the design-system components is served at http://localhost:5173/design.

### Redis vs in-memory

If `REDIS_URL` is unset or unreachable, the server falls back to an in-memory game store — handy for quick local dev. Set `REDIS_URL` (see `.env.example`) to use Redis so state survives a server restart.

## Production (VPS, HTTPS)

The prod stack is Docker Compose: **Caddy** (serves the built client, proxies the
API, auto-issues Let's Encrypt TLS) + **backend** + **redis** + **postgres**. No host
build step — the client is built inside the image.

```bash
cp .env.example .env      # set NODE_ENV, CORS_ORIGINS, DOMAIN, ACME_EMAIL
make deploy               # git pull + docker compose up -d --build
```

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full runbook (DNS, firewall, verify, ops).

## Environment

Copy `.env.example` to `.env`. Postgres (game-history archive) is optional — set `DATABASE_URL` and run `pnpm --filter server migrate` to enable it; leave it blank to disable (live state lives in Redis/memory regardless). For local dev, `docker compose -f docker-compose.dev.yml up -d` brings up both Redis and Postgres.
