---
name: database
description: Persistence for Tuan Tanah — the Postgres + Kysely game-history archive, migrations, schema, and the Redis vs in-memory live-state store. Use when changing what's archived on game-over, writing a migration, touching the Kysely schema, or the room store backend.
---

# Database & persistence — Tuan Tanah

Two distinct layers — don't conflate them:

- **Live game state** → Redis or in-memory (`rooms/store.ts`). Ephemeral, TTL-bounded.
- **Durable archive** → Postgres via Kysely (`server/src/persistence/`). Final game history only, written once on game-over.

## Live state store: `rooms/store.ts`

`GameStore` interface with two implementations chosen at startup: `RedisStore` if `REDIS_URL` is set and reachable, else `MemoryStore` (in-memory `Map` — no Docker needed for local dev). State survives restarts **only** with Redis. Rooms have a TTL (`ROOM_TTL_HOURS`, default 24h). This is the hot path; Postgres is never read during a live game.

## Postgres archive: `server/src/persistence/`

- `db.ts` — Kysely client over a `pg.Pool` (`max: 4`). **`getDb()` returns `null` when `DATABASE_URL` is blank** and persistence silently no-ops. Always honor this null pattern.
- `schema.ts` — Kysely table types. `games` (room_id, winner_id, win_condition, duration_seconds, player_count, created_at) and `game_players` (game_id FK, player_id, role, final_cash, final_wealth, eliminated). Cash/wealth are `bigint` in DB but typed `number` in TS.
- `gameHistory.ts` — `persistGameResult` writes the game row + per-player standings.
- `migrations/0001_initial.ts` — DDL with `up`/`down`.
- `migrate.ts` — the migration CLI runner.

```ts
export function getDb(): Kysely<Database> | null {
  if (!env.databaseUrl) return null
  if (!db) {
    const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 4 })
    db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  }
  return db
}
```

## Persistence is optional and must never disrupt a live game

`persistGameResult` is called from `realtime/gameOver.ts` on game-over, wrapped in try/catch — a persistence failure logs but **never throws** into the game loop. Keep it that way: archival is best-effort, the live game is sacred. This is durable archival only; never move live state into Postgres.

## Migrations

```bash
# local Postgres via docker compose -f docker-compose.dev.yml up -d postgres
DATABASE_URL=postgres://tuan:tuan@localhost:5432/tuan_tanah pnpm --filter server migrate
```

To add a migration: create `migrations/NNNN_name.ts` with `up`/`down` using the Kysely schema builder, mirror the change in `schema.ts` types, and update `gameHistory.ts` if the write path changes. Add an index when you add a column you'll query on.

## Conventions

Kysely is type-safe — let the `Database` interface drive query types; avoid raw SQL except in migration DDL. After changes: `pnpm --filter server typecheck` and `pnpm check`. There are no DB-backed tests by default (persistence is optional), so verify migrations against a local Postgres from `docker-compose.dev.yml`.
