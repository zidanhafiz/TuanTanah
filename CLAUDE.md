# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tuan Tanah is a real-time multiplayer Indonesian-themed Monopoly web game (2–8 players). It's a pnpm monorepo with three workspaces: `shared` (types + game data), `server` (Fastify + Socket.io + game engine), `client` (React + Vite + Zustand). The full game loop is implemented end-to-end — property/tier upgrades, the pinjol (loan) system, meta-actions, structured negotiation, role abilities, voting, elimination/bankruptcy cascade, and win conditions all work. A few balance/content TODOs remain (see "Implementation status" below). The client ships a neobrutalist design system, framer-motion animations, a sound system, and EN/ID i18n.

Design docs live in `docs/GAME_DESIGN.md` (gameplay) and `docs/TECHNICAL_REQUIREMENT.md` (architecture). Consult them when implementing a new mechanic — the type definitions and constants are derived from these.

## Commands

Use **pnpm**, not npm.

```bash
pnpm install
pnpm dev                  # server :3000 + client :5173 in parallel
pnpm dev:server           # backend only (pnpm --filter server dev)
pnpm dev:client           # frontend only
pnpm test                 # server engine tests, then client tests (vitest)
pnpm typecheck            # tsc --noEmit across all workspaces
pnpm lint                 # eslint . (flat config; 0 errors required)
pnpm lint:fix             # eslint . --fix
pnpm format               # prettier --write .
pnpm format:check         # prettier --check .
pnpm check                # typecheck + lint + format:check — the full gate
pnpm build                # builds client to client/dist
pnpm redis                # docker compose -f docker-compose.dev.yml up -d redis
pnpm --filter server migrate   # apply Postgres migrations (needs DATABASE_URL)
```

**Tests** run on Vitest and cover the engine (`server/test/*.test.ts` — turn, rent, cards, effects, pinjol, negotiation, elimination, win, roles, actions, property, passive-income). Run them with `pnpm test` (or `pnpm --filter server test:watch`). The engine is pure and testable because RNG is injectable via the `Rng` param, so games are reproducible. The **client** now has a Vitest harness too (jsdom + testing-library, config in `client/vitest.config.ts`); `pnpm test` runs server then client. `pnpm check` (typecheck + lint + format) is the automated gate; run it after changes — and run `pnpm test` when you touch engine code. A PostToolUse hook (`.claude/hooks/format-and-lint.sh`, wired in `.claude/settings.json`) auto-runs `prettier --write` + `eslint --fix` on every file Claude edits and surfaces any unfixable lint errors. Config: `.prettierrc.json`, `eslint.config.js`.

To exercise the game locally, open http://localhost:5173 in two browser tabs to create + join a room.

## Architecture

### Repository layout (feature/domain folders)

The tree is organized by domain so each area — and the planned auth/social/matchmaking/bots
work — has an obvious home:

```
shared/
  types/         # pure types (game.ts state model, events.ts socket contract)
  data/          # ALL game data, split by concern: economy, regions, tiers, roles,
                 #   boards/classic.ts (the map), cards/{kejadian,hustle}.ts
  rulesets/      # classic.ts bundles board+economy+roles (game-mode seam)
  index.ts       # flat barrel — `@tuan-tanah/shared` re-exports everything

server/src/
  bootstrap/     # index.ts (entry), env.ts (server/io wiring)
  realtime/      # socket layer: game, lobby, afk, gameOver, common, mutations
  engine/        # pure I/O-free rules (index.ts + submodules incl. lawoffice.ts)
  rooms/         # rooms.ts, sessions.ts, store.ts (room lifecycle + live state)
  persistence/   # Postgres: Kysely db/schema, migrations/, gameHistory repo
  modules/       # feature seams (stubs): auth, social, matchmaking, bots
  security.ts

client/src/
  app/           # App, main entry, router-level dev pages
  features/      # game (page+Board+modals), lobby, home; auth/social/matchmaking (seams)
  components/ui/ # shared design-system primitives (+ a few cross-feature widgets)
  hooks/ lib/ sound/ i18n/ store/   # shared infra; store/ backs lobby AND game
```

Cross-directory client imports use the `@/` alias (→ `client/src`); same-directory
imports stay relative. Server uses relative `.js` imports.

### Server is authoritative; clients only send requests

The single most important invariant: **the server owns all game state**. Clients never compute outcomes — they `emit` request events (`roll_dice`, `buy_property`, …), the engine mutates state, and the server broadcasts the **entire** `GameState` back via the `game_state` event. The client store just replaces its `state` with whatever arrives. Never add client-side game logic that predicts or duplicates engine results.

### Request → mutation → broadcast flow

Every in-game action follows the same path (see `server/src/realtime/game.ts` and `lobby.ts`):

1. Socket handler resolves the player's session via `requireSession(socket)` (maps `socket.id` → `{ roomId, playerId }`, see `rooms/sessions.ts`).
2. `mutateRoom(store, roomId, fn)` (`rooms/rooms.ts`) loads state, runs `fn` (which mutates in place and may return a value), persists, and returns fn's result. **All mutations go through `mutateRoom`** — it serializes per-room via promise chains so concurrent socket events on one room can't race on read-modify-write.
3. `fn` calls a pure engine function from `engine/index.ts`. Invalid actions `throw new EngineError(code, params)`.
4. `broadcastState(io, store, roomId)` re-reads and emits the full state to the room.
5. `guard(socket, fn)` wraps handler bodies and converts any thrown error into an `error` event back to the offending socket only.

Most handlers don't call these primitives directly — they use the write-path helpers in `realtime/mutations.ts`: `mutateWithEliminations` (mutate + broadcast/re-arm AFK + emit `player_eliminated`), `mutateAndBroadcast`, and `mutateAndArmAuction`. When adding a new action: add the event to **both** maps in `shared/types/events.ts`, write a pure engine function that throws `EngineError` on invalid input, and register a handler in `realtime/game.ts` using the matching helper.

### The engine is pure and I/O-free

`server/src/engine/` contains all game rules with **no I/O**. Functions take `GameState` and mutate it in place (or throw `EngineError`). Randomness is always passed as an injectable `Rng` (`util.ts`, defaults to `Math.random`) so games are reproducible/testable. `engine/index.ts` is the entry point and re-exports board helpers + the law-office subsystem. Submodules: `turn.ts` (turn/round state machine, passive income), `board.ts` (tile/region queries over shared data), `cards.ts` (Kejadian/Hustle decks), `roles.ts` (role modifiers), `abilities.ts` (role active abilities), `actions.ts` (meta-actions: invest/work/hustle/etc.), `effects.ts` (timed card/status effects), `pinjol.ts` (loans + debt resolution), `negotiation.ts` (structured deals), `lawoffice.ts` (Kantor Hukum landing actions + force-buy auction, re-exported via `index.ts`), `elimination.ts` (bankruptcy cascade, voting, final standings).

All player-visible events append to `state.log` via `pushLog` (bounded to 200 entries). Rupiah is always a raw number (`RupiahAmount`); format with `Rp ${n.toLocaleString('id-ID')}`.

### `shared/` is the single source of truth, with no build step

`shared/` exports raw `.ts` directly (`main`/`types` point at `.ts`, not compiled output) — server and client import `@tuan-tanah/shared` and consume the source. `types/game.ts` is the state model, `types/events.ts` is the Socket.io contract (typing both ends end-to-end). **All game data** lives in `shared/data/` split by concern — `economy.ts`, `regions.ts`, `tiers.ts`, `roles.ts`, `boards/classic.ts` (the board/map), `cards/{kejadian,hustle}.ts` — with `rulesets/classic.ts` bundling them (the game-mode seam). `shared/index.ts` re-exports everything flat, so the `@tuan-tanah/shared` import surface is unchanged. Game balance/content changes happen in `shared/data/`, not in engine code. (The engine still reads the classic data directly; threading a selected ruleset through the engine is deferred until a 2nd mode/map exists.)

### Client

React + `react-router-dom` — `app/App.tsx` defines routes: `/` (`features/home/Home`), `/room/:roomId` (`features/game/RoomGate`, which shows `Lobby` or `Game` based on `state.phase`), and `/design` (`app/StyleGuide`, a live gallery of the design-system primitives). The pages and their components are grouped by feature: `features/game/` (Game page + Board + every game modal), `features/lobby/`, `features/home/`. Room URLs are shareable and support leave/auto-rejoin (seat is held by a secret reconnect token). `store/gameStore.ts` is a single Zustand store that wires up all socket listeners in `init()` and exposes `emit` wrappers as actions plus derived selectors (`me()`, `isMyTurn()`) — it backs both lobby and game, so it stays shared at the `src/` root, not inside `features/game/`. The socket singleton is in `socket.ts`. In dev, Vite proxies `/api` and `/socket.io` to the backend (`vite.config.ts`); in prod, Caddy does.

UI building blocks: a neobrutalist design system under `components/ui/`, framer-motion for board/token/dice animations (`lib/motion.ts`, `store/rollAnimation.ts`), `lucide-react` icons, and a sound system (`sound/` — `AudioManager`, cues driven off state transitions in `stateSounds.ts`, toggle persisted via `sound/settings.ts`). Shared display helpers that mirror engine math (e.g. `features/game/lib/tileValue.ts`) live in the feature's `lib/` and are unit-tested.

**i18n** is client-side and per-player (EN/ID) via `i18next` + `react-i18next` (`client/src/i18n/`). UI strings live in `locales/{en,id}.json`; game data from `shared` constants is localized through an overlay in `i18n/gameData.ts`. Server-side game-log and `EngineError` strings are **structured + localized**: the engine emits a stable message `code` plus tagged `params` (via `logKey(...)` and `new EngineError(code, params)`), the bilingual templates live in `shared/i18n/messages/*` (one module per engine file, merged into `LOG_MESSAGES` / `ERROR_MESSAGES`), and the client re-renders them in the viewer's language (`client/src/i18n/messages.ts`, wired into `EventLog` + the `error` event). Each entry still carries a rendered English `message` as a fallback. When you add a log/error in the engine, add its code to the matching `shared/i18n/messages/*` module in **both** `en` and `id` (a parity test guards this). Small residual gaps: lobby **ack** errors (`realtime/lobby.ts`, returned via `AckResult.error` as plain English) and the free-text `PendingDebt.reason` label are not yet keyed.

### Persistence

`rooms/store.ts` defines a `GameStore` interface with two implementations chosen at startup: `RedisStore` if `REDIS_URL` is set and reachable, else `MemoryStore` (in-memory Map — no Docker needed for local dev). State survives restarts only with Redis. Rooms have a TTL (`ROOM_TTL_HOURS`, default 24h).

`server/src/persistence/` persists **final game history** (game row + per-player standings) on game-over via `persistGameResult`, called from `realtime/gameOver.ts`. It's a self-hosted **Postgres** archive accessed through **Kysely** (`persistence/db.ts` client, `schema.ts` types, `migrations/` + a `pnpm --filter server migrate` CLI). It's optional: with `DATABASE_URL` blank, `getDb()` returns null and persistence silently no-ops — and a persistence failure never disrupts a live game (wrapped in try/catch, never throws). This is durable archival only — live game state lives in Redis/memory, not Postgres.

## Implementation status

The full loop is implemented — there are **no `notImplemented` stubs left** in `game.ts`. Working: create/join/leave/rejoin room → lobby (pick role, room-master settings) → start → roll → move → resolve tile (buy property, pay rent, tax, draw card, jail) → meta-actions (invest/work/hustle/sabotage/korupsi/negotiate) → property & tier upgrades / downgrades / sells → pinjol loans + debt resolution → structured negotiation deals → role active abilities → voting → elimination/bankruptcy cascade → win conditions → game-over with final standings (optionally archived to Postgres).

Remaining gaps are balance/content TODOs, not missing systems — search for `TODO` in `server/src/engine/` (e.g. the role-modifier follow-ups in `roles.ts`). Server-side i18n is now done — engine game-log + `EngineError` strings are keyed and localized EN/ID (see the i18n note above); only lobby ack errors and the `PendingDebt.reason` label remain English. Treat `TODO` markers as intentional later-milestone work, not bugs.

## Conventions

- ESM everywhere (`"type": "module"`). Relative imports use `.js` extensions even for `.ts` source (required by `verbatimModuleSyntax` + bundler resolution) — match this.
- TypeScript is strict (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`). Use `import type` for type-only imports.
- Server runs via `tsx` (no build step for dev or prod `start`); only the client is bundled.

## Project management — Notion is the source of truth

This project is managed in the **Tuan Tanah Game** Notion teamspace via the connected Notion MCP (`mcp__claude_ai_Notion__*`). Tasks and design docs live there, not in the repo. Use Notion for PM; use the repo for code.

**Canonical IDs** (pass to `notion-fetch` / as `data_source_url` for `notion-search`):

| Thing                         | ID                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Teamspace "Tuan Tanah Game"   | `37c01c5a-d049-815a-9168-0042fbce481e` (use as `teamspace_id` filter; not directly fetchable) |
| **Tasks Tracker** database    | `37c01c5a-d049-80fa-8d47-f0072913043f`                                                        |
| Tasks Tracker data source     | `collection://37c01c5a-d049-80d1-a958-000bf10981cf`                                           |
| **Document Hub** database     | `37c01c5a-d049-80ab-bb1a-d8b0c8a4dc01`                                                        |
| Document Hub data source      | `collection://37c01c5a-d049-807e-a9f8-000b3959700c`                                           |
| Game Design doc (master spec) | `37d01c5a-d049-809d-8a1f-c46a07b60b86`                                                        |

**Tasks Tracker schema** — when creating a task page in the Tasks Tracker data source, set:

- `Task name` (title), `Status` (`Not started` / `In progress` / `Done`), `Priority` (`High` / `Medium` / `Low`), `Effort level` (`Small` / `Medium` / `Large`), `Task type` (multi: `🐞 Bug` / `💬 Feature request` / `💅 Polish`), `Description`, `Due date`, `Assignee`.

**Document Hub schema** — `Doc name` (title), `Category` (multi: `Proposal` / `Customer research` / `Strategy doc` / `Planning`).

**CRUD mapping** (the connection is already authenticated — no setup needed):

- **Read** → `notion-search` (semantic; pass `data_source_url` to scope to a database) or `notion-fetch` (by ID).
- **Create** → `notion-create-pages` with the target data source as parent.
- **Update** (status, props, body) → `notion-update-page`.
- **Delete** → no hard delete; archive via `notion-update-page` (Notion archives, doesn't destroy).

**Permissions:** read-only Notion tools are allowlisted in `.claude/settings.json` (run without prompting). Writes (`create-pages`, `update-page`, `create-comment`, `move-pages`, `duplicate-page`, `update-data-source`) intentionally prompt for confirmation each time — don't add them to the allowlist without asking.

The Game Design doc is marked "100% locked" and is the master spec that `docs/GAME_DESIGN.md` + `shared/data/` derive from. If gameplay/balance changes, update Notion and the repo together.
