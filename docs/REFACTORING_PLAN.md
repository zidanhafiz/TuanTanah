# Refactoring & Restructuring Plan — Tuan Tanah

_Status: proposed (not yet executed). Authored 2026-06-26._

## Goal

Two complementary outcomes, done as one coordinated effort:

1. **Cleaner code** — kill localized bloat and duplication (god-files, copy-paste).
2. **Growth-ready structure** — a feature/domain folder layout so the next wave of work
   (**game modes, auth, maps, friends, matchmaking, bots**) each has an obvious home, and
   so humans _and_ AI agents can navigate the codebase by feature instead of by guesswork.

The architecture is already sound (pure I/O-free engine, server-authoritative model,
single-source-of-truth `shared/`). This is debt paydown + reorganization, **not a rewrite**.

### Decisions locked (2026-06-26)

| Decision          | Choice                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reorg vs cleanup  | **Together** — one coordinated effort.                                                                                                                       |
| Auth              | **Custom auth** (not Supabase Auth).                                                                                                                         |
| Database          | **Remove Supabase**; self-host **Postgres** as a container service (sibling to Redis).                                                                       |
| DB access layer   | **Kysely** (type-safe query builder) + a migration runner.                                                                                                   |
| Game modes / maps | **Structure only now.** Split content into `data/` + `rulesets/` + `boards/`. **Defer** the invasive engine ruleset-threading until the 2nd mode/map exists. |

### Scope boundary

- **In scope:** folder reorg; code cleanup (Phases 1–4); Supabase→Postgres+Kysely swap
  _including reimplementing the existing game-history persistence_; creating **empty,
  well-placed module homes/seams** for auth/social/matchmaking/bots; updating docs/CLAUDE.md.
- **Out of scope (the "big plan"):** the actual auth / friends / matchmaking / bot logic,
  and full game-mode/map support. This refactor only guarantees each lands cleanly.

### Guiding principles

1. **Behavior-preserving.** Reorg = file moves + import-path updates; cleanup = helper
   extraction. No logic changes ride along. Bug fixes & content TODOs are separate commits.
2. **One concern per commit**, independently revertable. No big-bang.
3. **Verify after every step:** `pnpm check && pnpm test` (222 engine tests + `tsc` catch
   every broken import a move could cause). Client has no test net yet — see Phase 4.
4. **No gold-plating.** Defer the engine ruleset-threading; create feature seams empty, not
   speculatively implemented.
5. **Tests are the proof, so keep them compiling.** Server tests import the engine via deep
   paths (`../src/engine/*.js`, ×14 on `index.js`); the target structure keeps `engine/` in
   place so the Phase 2 re-exports stay green. Any file a phase moves/renames must have its
   test imports updated in the **same** commit.
6. **Alias before you move (client).** The client has **no path aliases** and **43
   cross-folder `../../` imports** today. Introduce a `@/` alias and codemod those imports
   _before_ relocating any client folder — otherwise every move breaks a web of relative
   paths. (Server keeps its `.js` relative imports; its reorg is shallow enough not to need
   an alias.)

### Baseline (verified 2026-06-26)

- `pnpm typecheck` clean (3 workspaces). `pnpm test` = **222 pass / 20 files** (engine only).
- ~24k lines TS/TSX. Biggest files: `engine/index.ts` (1172), `PropertyModal.tsx` (742),
  `shared/types/constants.ts` (582).

---

## Target structure

### `shared/` — content split (unlocks maps & modes)

```
shared/
  types/          # pure types only (game.ts, events.ts)
  data/
    economy.ts  roles.ts  tiers.ts  regions.ts
    boards/     # ← MAPS live here: classic.ts (current BOARD), + future boards
    cards/      # kejadian / hustle content
  rulesets/     # ← GAME MODES: classic.ts bundles {board, economy, roles, win conditions}
  index.ts      # re-exports (keeps `@tuan-tanah/shared` import surface stable)
```

### `server/src/` — domain modules instead of a flat bag

```
server/src/
  bootstrap/      # index.ts (entry), env, server/io wiring
  realtime/       # ex-handlers/: socket layer (game, lobby, afk, gameOver, common)
  engine/         # pure rules (+ lawoffice.ts from Phase 2)
  rooms/          # rooms.ts, sessions.ts, store.ts (room lifecycle + live-state persistence)
  persistence/    # ← Postgres: db client, kysely types, migrations/, game-history repo
  modules/        # ← NEW feature homes (seams only this refactor)
    auth/         social/        matchmaking/        bots/
  security.ts
```

### `client/src/` — feature-based

```
client/src/
  app/            # App, router, providers
  features/
    game/         # Game page + Board + all game modals + gameStore
    lobby/  home/
    auth/  social/  matchmaking/   # ← NEW feature homes (seams only this refactor)
  components/ui/   # design-system primitives (stay shared)
  hooks/  lib/  sound/  i18n/
```

---

## Phases (execution order)

### Phase 0 — Housekeeping (zero risk)

| #   | Item                                                     | Action                                                                          |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 0.1 | 184 MB stale worktrees (`.claude/worktrees/*`)           | `git worktree remove` / `prune`. Confirm `tuan-tanah-ttg-6` still wanted first. |
| 0.2 | Dead `pnpm.overrides` in `package.json` (ignored, warns) | Relocate or remove.                                                             |
| 0.3 | Stray `CODEBASE_REVIEW.md` in repo root                  | Delete or move to `docs/`.                                                      |

**Verify:** `pnpm install` warning-free; `pnpm check && pnpm test` green.

### Phase 1 — Foundational reorg (low risk; mostly moves)

Establish the new skeleton and move existing files in. `tsc` + tests prove nothing broke.
Do per-workspace, smallest blast radius first:

1. **`shared/`**: split `types/constants.ts` into `data/*` + `rulesets/classic.ts` +
   `data/boards/classic.ts`. Keep `index.ts` re-exporting everything so
   `@tuan-tanah/shared` consumers don't change. _(Engine still reads the classic ruleset —
   no threading yet.)_
2. **`server/src/`**: `handlers/` → `realtime/`; group `rooms.ts`/`sessions.ts`/`store.ts`
   → `rooms/`; create empty `modules/{auth,social,matchmaking,bots}/` and `persistence/`.
3. **`client/src/`**: _first_ add a `@/` path alias (Vite `resolve.alias` + tsconfig
   `paths`) and codemod the **43 existing `../../` cross-folder imports** onto it — without
   this, every later move breaks a web of relative imports. _Then_ introduce `app/` +
   `features/`; move `game`/`lobby`/`home` pages + their components into feature folders;
   keep `components/ui/` shared.

**Verify after each move:** `pnpm check && pnpm test`. Commit per workspace.

### Phase 2 — Engine cleanup (low risk, test-backed)

Now operating inside the reorganized `engine/`.

1. **Extract Law Office subsystem → `engine/lawoffice.ts`** (functions span `index.ts`
   886–1114, ~237 lines). First untangle shared internals (`EngineError`, `pushLog`,
   player lookup, `charge`, `tileValue`, `getTileDef`) into a neutral `engine/common.ts`
   to avoid circular imports; then move + re-export. Proven by `law-office.test.ts`.
2. **Extract validation helpers** to `engine/common.ts` — kills repeated
   `"You don't own that tile"` (4×), player `.find()` (10+×), `"not enough cash"` (6×):
   `getPlayerOrThrow`, `requireOwnership`, `requireCash`, `isOwnedBy`. One per commit.

### Phase 3 — Realtime/handler cleanup (low risk)

`realtime/game.ts` repeats `mutate → broadcast → emitEliminated → concludeIfWon` ~26×.
Extract `mutateWithEliminations(store, roomId, io, fn)` (+ a `mutateAuction` variant) into
`realtime/common.ts`; collapse call sites. **Verify** + manual two-tab smoke test.

### Phase 4 — Client cleanup + first client tests (higher risk: no net)

Conservative, smallest steps first.

1. **Stand up the client test harness** (none exists — no `vitest`/`jsdom`/`testing-library`
   in `client/package.json` today): add those deps, a client Vitest config, and a `test`
   script. _Then_ write the **first tests** on the extracted pure helpers (below) — a net
   before touching the big components.
2. **De-dup** `tileValue` / `ownsFullRegion` (copy-pasted in `PropertyModal` +
   `KantorHukumModal`) → `features/game/lib/tileValue.ts`; unit-test it.
3. **Decompose `PropertyModal.tsx` (742)** following `KantorHukumModal`'s pattern:
   `useTileActions` hook + `<RentSchedule>` + `<SellConfirmation>`.
4. **Tame modal state**: `NegotiationModal` (10 `useState`) → `useReducer`/`useDealForm`;
   `Game.tsx` (7 modal `useState`s) → `useGameModals()`. (`gameStore.ts` is fine — leave it.)

### Phase 5 — Supabase → Postgres + Kysely (infra swap)

Like-for-like replacement of the existing game-history persistence, on owned infra.

1. **Container**: add a `postgres` service to `docker-compose.dev.yml` (dev) and
   `docker-compose.yml` (prod), sibling to Redis, with a named volume. Update `.env.example`
   (`DATABASE_URL`, drop `SUPABASE_*`).
2. **Deps**: add `kysely` + `pg`, plus a migration runner (`kysely-ctl` or `node-pg-migrate`).
   Remove `@supabase/supabase-js`.
3. **`persistence/`**: Kysely db client + typed schema; first migration encodes the existing
   `games` + `game_players` tables (currently un-versioned, Supabase-only).
4. **Reimplement** `persistGameResult` (the only Supabase consumer, in `gameOver.ts`) against
   Kysely. Delete `server/src/supabase.ts` and `env` Supabase wiring.

**Verify:** `pnpm check && pnpm test`; run a full game with Postgres up and confirm a row
lands in `games`/`game_players`. Keep the "persistence failure never disrupts a live game"
property (wrap in try/catch, no throw) that the current code already has.

### Phase 6 — Feature seams (empty homes for the big plan)

Create the module skeletons so the big plan slots in without restructuring:

- `server/src/modules/auth/` — README/index stub noting: custom auth, Kysely `users` table,
  password hashing + session/JWT strategy to be chosen at implementation time.
- `server/src/modules/{social,matchmaking,bots}/` — index stubs. `bots/` README notes it
  will call the **pure engine** directly (the engine's purity is what makes bots cheap).
- `client/src/features/{auth,social,matchmaking}/` — placeholder route + folder.
- **No logic.** These are signposts, not implementations.

### Phase 7 — Docs sync (makes humans + AI agents effective)

1. Update **`CLAUDE.md`** "Architecture" section to describe the new folder map and where each
   feature lives — this is the single biggest lever for AI-agent effectiveness here.
2. Refresh `README.md` (Postgres in the stack, no Supabase) and `docs/TECHNICAL_REQUIREMENT.md`.
3. Optional: short `README.md` per top-level module folder stating its responsibility.

---

## Flagged, NOT fixed (track separately — not part of this refactor)

1. **Possible bug:** `repay_pinjol` is the only mutation handler skipping `concludeIfWon()`
   (`game.ts:340`). Investigate; fix in its own commit if real.
2. **Role TODOs (content/balance):** `rentenir` forced loans, `sales` 15% bonus (`roles.ts`).
3. ~~**Server-side i18n gap:** engine log/error strings are English-only.~~ **Done (TTG-33):**
   engine log/error strings are now keyed + localized EN/ID (`logKey` / `EngineError(code, params)`,
   templates in `shared/i18n/messages/*`, client renders via `client/src/i18n/messages.ts`). Only
   lobby ack errors and the `PendingDebt.reason` label remain English.
4. **Deferred (do when 2nd mode/map exists):** thread a selected ruleset through the engine
   instead of hardcoded global constants. The Phase 1 `shared/` split makes this mechanical.

---

## Suggested order recap

```
0 housekeeping → 1 foundational reorg → 2 engine cleanup → 3 realtime cleanup
→ 4 client cleanup + first tests → 5 Supabase→Postgres → 6 feature seams → 7 docs
```

Re-evaluate after Phase 3: the reorg + engine/handler cleanup alone removes most day-to-day
maintenance pain and gives the new features clean homes.
