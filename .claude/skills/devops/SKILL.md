---
name: devops
description: Build, deploy, and tooling for Tuan Tanah — pnpm monorepo scripts, the check gate, Docker Compose (Caddy + backend + Redis + Postgres), Caddy reverse proxy/TLS, env vars, and the deploy Makefile. Use for CI/build/deploy/env/config changes.
---

# DevOps — Tuan Tanah

pnpm monorepo (`pnpm@9.15.0`, Node ≥20), three workspaces. **No build step for the server** — it runs via `tsx` in dev and prod. Only the client is bundled (Vite). There is **no GitHub Actions CI**; deploys are manual via the `Makefile`.

## Scripts (root `package.json`)

```bash
pnpm dev          # server :3000 + client :5173 in parallel
pnpm dev:server   # backend only
pnpm dev:client   # frontend only
pnpm build        # client → client/dist (Vite)
pnpm test         # server engine tests, then client tests (vitest)
pnpm typecheck    # tsc --noEmit across all workspaces (pnpm -r)
pnpm lint         # eslint .   (lint:fix to autofix)
pnpm format       # prettier --write .   (format:check to verify)
pnpm check        # typecheck + lint + format:check — the full gate
pnpm redis        # docker compose -f docker-compose.dev.yml up -d redis
pnpm --filter server migrate   # apply Postgres migrations (needs DATABASE_URL)
```

Use **pnpm**, never npm. `pnpm check` is the authoritative gate; run it after changes.

## Local dev stack

`docker-compose.dev.yml` provides optional `redis` (7-alpine, :6379) and `postgres` (16-alpine, :5432, user/pass/db = `tuan`/`tuan`/`tuan_tanah`). Neither is required for basic dev — without `REDIS_URL` state is in-memory, without `DATABASE_URL` archival no-ops.

## Production stack: `docker-compose.yml`

Four services:

- **web** — multi-stage build (Node 20 build → `caddy:2-alpine`), serves the SPA from `/srv` and reverse-proxies `/api/*` + `/socket.io/*` to `backend:3000`. Auto-TLS via Caddy. `caddy_data`/`caddy_config` volumes persist certs.
- **backend** — `server/Dockerfile` (Node 20, corepack, `pnpm install --frozen-lockfile --prod`, `tsx src/bootstrap/index.ts`), exposes :3000.
- **redis** — 7, `redis_data` volume.
- **postgres** — 16, `postgres_data` volume.

## Caddy (`Caddyfile`)

Reverse proxy + static SPA fallback (`try_files {path} /index.html`) with hardened headers set at the edge: HSTS, `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, a strict CSP (`script-src 'self'`, `connect-src 'self' wss:`), 64KB request-body cap, `-Server`. Edit headers here, not in the app.

## Environment variables (`.env.example`)

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=                       # blank → archival disabled
REDIS_URL=redis://localhost:6379    # blank → in-memory store (prod: redis://redis:6379)
CORS_ORIGINS=http://localhost:5173  # REQUIRED in prod; blank/wildcard/localhost refuse to start
ROOM_TTL_HOURS=24
VITE_SERVER_URL=                    # blank → dev proxy / same-origin
VITE_PUBLIC_URL=                    # blank → root-relative; set for social previews
DOMAIN=yourdomain.com              # prod
ACME_EMAIL=you@example.com         # prod (Caddy TLS)
```

## Deploy (`Makefile`)

```bash
make deploy   # git pull && docker compose up -d --build
make up       # docker compose up -d --build
make down     # docker compose down
make logs     # docker compose logs -f
make health   # curl -fsS https://${DOMAIN}/api/health
```

## Tooling configs

- `eslint.config.js` — TypeScript-ESLint flat config; ignores `dist`/`node_modules`; Node globals for server/shared, browser + React-hooks for client; `_`-prefixed throwaways allowed; Prettier last. 0 errors required.
- `.prettierrc.json` — no semi, single quotes, trailing-comma all, printWidth 100, arrow-parens always.
- `tsconfig.base.json` — ES2022, `Bundler` resolution, strict + `verbatimModuleSyntax` + `isolatedModules`.
- Vitest configs: `server/vitest.config.ts` (node, inlines `@tuan-tanah/shared`), `client/vitest.config.ts` (jsdom).
- `.claude/hooks/format-and-lint.sh` — PostToolUse hook; auto-runs prettier + eslint --fix on edited files, surfaces unfixable lint errors (exit 2).

When adding CI later, mirror `pnpm check && pnpm test` as the gate.
