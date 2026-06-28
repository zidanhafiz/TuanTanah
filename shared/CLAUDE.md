# shared/ — guardrails

Thin folder-local rules. Full picture is in the root `CLAUDE.md`
("`shared/` is the single source of truth, with no build step"); deep how-to
lives in the `add-game-content` and `game` skills.

## Invariants when editing here

- **This is the single source of truth, with no build step.** `package.json`
  `main`/`types` point at `.ts` directly — server and client consume the source.
  Don't add a compile step or import compiled output.
- **All game data lives here**, split by concern: `data/economy.ts`,
  `data/regions.ts`, `data/tiers.ts`, `data/roles.ts`, `data/boards/classic.ts`
  (the map), `data/cards/{kejadian,hustle}.ts`. `rulesets/classic.ts` bundles
  them (the game-mode seam).
- **Balance/content changes happen in `data/`, not in engine code.** If you find
  yourself editing `server/src/engine/` to change a number, it probably belongs
  here instead.
- **`types/game.ts`** is the state model; **`types/events.ts`** is the Socket.io
  contract typing both ends. A new action event must be added to **both** maps in
  `events.ts`.
- **i18n parity:** engine log/error codes have bilingual templates in
  `i18n/messages/*` (one module per engine file). Every new code must exist in
  **both** `en` and `id` — a parity test guards this.
- `index.ts` is a flat barrel; keep the `@tuan-tanah/shared` import surface
  stable when adding modules (re-export from here).

## Conventions

- ESM; relative imports use `.js` extensions even for `.ts` source.
- `import type` for type-only imports. Rupiah is a raw number (`RupiahAmount`).
