# server/ — guardrails

Thin folder-local rules. The full picture is in the root `CLAUDE.md`
("Server is authoritative", "Request → mutation → broadcast flow", "The engine
is pure and I/O-free"); deep how-to lives in the `backend`, `game`, and
`database` skills.

## Invariants when editing here

- **The server owns all game state.** Clients send request events; the engine
  mutates and the server broadcasts the **entire** `GameState`. Never trust a
  client-computed outcome.
- **All mutations go through `mutateRoom`** (`rooms/rooms.ts`) — it serializes
  per-room read-modify-write. Prefer the write-path helpers in
  `realtime/mutations.ts` (`mutateWithEliminations`, `mutateAndBroadcast`,
  `mutateAndArmAuction`) over calling primitives directly.
- **`engine/` is pure and I/O-free.** No sockets, no DB, no `Date.now()` for
  game logic. Randomness is the injectable `Rng` param (defaults to
  `Math.random`) so games stay reproducible/testable.
- **Invalid actions `throw new EngineError(code, params)`** — never a raw error
  or a silent return. `guard(socket, fn)` converts throws into an `error` event
  to the offending socket only.
- **Player-visible events** append via `pushLog` using `logKey(...)` (stable
  code + tagged params), never a raw string.
- Persistence (`persistence/`) is best-effort archival only — it must never
  throw into a live game.

## Adding a new action

1. Add the event to **both** maps in `shared/types/events.ts`.
2. Write a pure engine fn in `engine/` that throws `EngineError` on bad input.
3. Register a handler in `realtime/game.ts` using the matching mutations helper.
4. Add log/error codes to `shared/i18n/messages/*` in **both** en + id.
5. `pnpm test` (engine tests) + `pnpm check`. See the `add-game-action` skill.

## Conventions

- ESM; relative imports use `.js` extensions even for `.ts` source.
- Runs via `tsx` — no build step. `import type` for type-only imports.
