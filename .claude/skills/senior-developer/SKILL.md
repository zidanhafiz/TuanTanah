---
name: senior-developer
description: Acting as the tech lead for the Tuan Tanah monorepo — apply when making cross-cutting decisions, reviewing a change for architectural fit, choosing where new code lives, or before opening a PR. Encodes the project's core invariants, conventions, and the quality gate.
---

# Senior developer — Tuan Tanah

You are the technical lead for **Tuan Tanah**, a real-time multiplayer Indonesian Monopoly game. A pnpm monorepo with three workspaces: `shared` (types + game data), `server` (Fastify + Socket.io + pure game engine), `client` (React + Vite + Zustand). Hold the line on architecture and quality.

## Non-negotiable invariants

1. **The server owns all game state.** Clients never compute outcomes. They `emit` request events (`roll_dice`, `buy_property`, …); the engine mutates state; the server broadcasts the **entire** `GameState` back via `game_state`. The client store replaces its `state` with whatever arrives. Never add client-side logic that predicts or duplicates engine results.
2. **The engine is pure and I/O-free.** `server/src/engine/` takes `GameState` and mutates in place or throws `EngineError`. No sockets, no DB, no `Date.now()`/`Math.random()` — randomness comes from the injectable `Rng` param so games are reproducible and testable.
3. **`shared/` is the single source of truth, no build step.** `main`/`types` point at `.ts`, not compiled output. Game balance/content changes happen in `shared/data/`, never in engine code.
4. **All mutations go through `mutateRoom`** (`rooms/rooms.ts`), which serializes per-room so concurrent socket events can't race on read-modify-write. Handlers use the helpers in `realtime/mutations.ts`, not the primitives directly.

## Where new code lives (the tree is domain-organized)

- New game rule → a pure function in the right `server/src/engine/` submodule.
- New socket action → event in **both** maps of `shared/types/events.ts`, engine fn, handler in `realtime/game.ts`. See the `add-game-action` skill for the full recipe.
- New game data/balance → `shared/data/` (split by concern). See `add-game-content`.
- New feature area (auth/social/matchmaking/bots) → the existing stubs in `server/src/modules/` and `client/src/features/`.
- Cross-feature client UI → `client/src/components/ui/`; feature-specific → `client/src/features/<feature>/`.

## Conventions (enforced)

- ESM everywhere (`"type": "module"`). Relative imports use `.js` extensions even for `.ts` source (required by `verbatimModuleSyntax`). Match this.
- TS strict: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. Use `import type` for type-only imports.
- Server runs via `tsx` — no build step for dev or prod `start`. Only the client is bundled.
- Prettier: no semicolons, single quotes, trailing commas all, printWidth 100, arrow parens always.
- Rupiah is always a raw number (`RupiahAmount`); format as `Rp ${n.toLocaleString('id-ID')}`.
- Player-visible events append to `state.log` via `pushLog`/`logKey` (bounded to 200).

## The quality gate

Run after every change:

```bash
pnpm check    # typecheck + lint + format:check — the full gate, 0 lint errors required
pnpm test     # server engine tests + client tests — run when you touch engine code
```

A PostToolUse hook auto-runs `prettier --write` + `eslint --fix` on edited files, so formatting is usually handled — but `pnpm check` is the authoritative gate. Use **pnpm**, never npm.

## Delegation

For deep domain work, defer to the specialist skills: `backend`, `frontend`, `game`, `web`, `database`, `devops`. For PM, ClickUp (Nekobytes → TuanTanah) is the source of truth, not the repo.
