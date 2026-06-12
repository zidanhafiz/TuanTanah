# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tuan Tanah is a real-time multiplayer Indonesian-themed Monopoly web game (2–8 players). It's a pnpm monorepo with three workspaces: `shared` (types + game data), `server` (Fastify + Socket.io + game engine), `client` (React + Vite + Zustand). Currently an early scaffold + **vertical slice** — many mechanics are deliberately stubbed (see "Implementation status" below).

Design docs live in `docs/GAME_DESIGN.md` (gameplay) and `docs/TECHNICAL_REQUIREMENT.md` (architecture). Consult them when implementing a new mechanic — the type definitions and constants are derived from these.

## Commands

Use **pnpm**, not npm.

```bash
pnpm install
pnpm dev                  # server :3000 + client :5173 in parallel
pnpm dev:server           # backend only (pnpm --filter server dev)
pnpm dev:client           # frontend only
pnpm typecheck            # tsc --noEmit across all workspaces
pnpm lint                 # eslint . (flat config; 0 errors required)
pnpm lint:fix             # eslint . --fix
pnpm format               # prettier --write .
pnpm format:check         # prettier --check .
pnpm check                # typecheck + lint + format:check — the full gate
pnpm build                # builds client to client/dist
pnpm redis                # docker compose -f docker-compose.dev.yml up -d redis
```

**There is no test runner yet**, but Prettier + ESLint are configured. `pnpm check` (typecheck + lint + format) is the automated gate; run it after changes. A PostToolUse hook (`.claude/hooks/format-and-lint.sh`, wired in `.claude/settings.json`) auto-runs `prettier --write` + `eslint --fix` on every file Claude edits and surfaces any unfixable lint errors. Config: `.prettierrc.json`, `eslint.config.js`. The engine is written to be pure and testable (RNG is injectable via the `Rng` param), so a test harness can be added later without refactoring.

To exercise the game locally, open http://localhost:5173 in two browser tabs to create + join a room.

## Architecture

### Server is authoritative; clients only send requests

The single most important invariant: **the server owns all game state**. Clients never compute outcomes — they `emit` request events (`roll_dice`, `buy_property`, …), the engine mutates state, and the server broadcasts the **entire** `GameState` back via the `game_state` event. The client store just replaces its `state` with whatever arrives. Never add client-side game logic that predicts or duplicates engine results.

### Request → mutation → broadcast flow

Every in-game action follows the same path (see `server/src/handlers/game.ts` and `lobby.ts`):

1. Socket handler resolves the player's session via `requireSession(socket)` (maps `socket.id` → `{ roomId, playerId }`, see `sessions.ts`).
2. `mutateRoom(store, roomId, fn)` (`rooms.ts`) loads state, runs `fn` (which mutates in place and may return a value), persists, and returns fn's result. **All mutations go through `mutateRoom`** — it serializes per-room via promise chains so concurrent socket events on one room can't race on read-modify-write.
3. `fn` calls a pure engine function from `engine/index.ts`. Invalid actions `throw new EngineError(msg)`.
4. `broadcastState(io, store, roomId)` re-reads and emits the full state to the room.
5. `guard(socket, fn)` wraps handler bodies and converts any thrown error into an `error` event back to the offending socket only.

When adding a new action: add the event to **both** maps in `shared/types/events.ts`, write a pure engine function that throws `EngineError` on invalid input, register a handler that follows the pattern above, and replace the matching `notImplemented` stub at the bottom of `game.ts`.

### The engine is pure and I/O-free

`server/src/engine/` contains all game rules with **no I/O**. Functions take `GameState` and mutate it in place (or throw `EngineError`). Randomness is always passed as an injectable `Rng` (`util.ts`, defaults to `Math.random`) so games are reproducible/testable. `engine/index.ts` is the entry point and re-exports board helpers. Key submodules: `turn.ts` (turn/round state machine, passive income), `board.ts` (tile/region queries over shared data), `cards.ts` (Kejadian/Hustle decks), `roles.ts` (role modifiers), plus stubs `effects.ts`, `pinjol.ts`, `negotiation.ts`, `elimination.ts`, `actions.ts`.

All player-visible events append to `state.log` via `pushLog` (bounded to 200 entries). Rupiah is always a raw number (`RupiahAmount`); format with `Rp ${n.toLocaleString('id-ID')}`.

### `shared/` is the single source of truth, with no build step

`shared/` exports raw `.ts` directly (`main`/`types` point at `.ts`, not compiled output) — server and client import `@tuan-tanah/shared` and consume the source. `types/game.ts` is the state model, `types/events.ts` is the Socket.io contract (typing both ends end-to-end), `types/constants.ts` holds **all game data** (board layout, regions, tiers, cards, roles, economic constants). Game balance/content changes happen in `constants.ts`, not in engine code.

### Client

React with no router — `App.tsx` switches between `Home` / `Lobby` / `Game` screens based on `roomId` and `state.phase` from the store. `store/gameStore.ts` is a single Zustand store that wires up all socket listeners in `init()` and exposes `emit` wrappers as actions plus derived selectors (`me()`, `isMyTurn()`). The socket singleton is in `socket.ts`. In dev, Vite proxies `/api` and `/socket.io` to the backend (`vite.config.ts`); in prod, nginx does.

### Persistence

`store.ts` defines a `GameStore` interface with two implementations chosen at startup: `RedisStore` if `REDIS_URL` is set and reachable, else `MemoryStore` (in-memory Map — no Docker needed for local dev). State survives restarts only with Redis. Rooms have a TTL (`ROOM_TTL_HOURS`, default 24h). Supabase (`supabase.ts`) is wired but deferred post-MVP — leave keys blank to disable.

## Implementation status

The vertical slice covers: create/join room → lobby (pick role, room-master settings) → start → roll → move → resolve tile (buy property, pay rent, tax, draw card, jail) → end turn. Stubbed and emitting "not implemented" (`game.ts`): `upgrade_property`, `meta_action`, `take_pinjol`, `propose_deal`, `respond_deal`, `sell_property`. Within implemented code, search for `TODO` markers (e.g. investor rent cut, immunity deals, can't-pay→elimination, timed card effects, most role abilities) — these are intentional later-milestone gaps, not bugs.

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

The Game Design doc is marked "100% locked" and is the master spec that `docs/GAME_DESIGN.md` + `shared/types/constants.ts` derive from. If gameplay/balance changes, update Notion and the repo together.
