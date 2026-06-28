# client/ — guardrails

Thin folder-local rules. Full architecture is in the root `CLAUDE.md`
("Client" section); deep how-to lives in the `frontend` skill (and `web` for the
socket contract).

## Invariants when editing here

- **Server is authoritative — never compute game outcomes client-side.** The
  store replaces its `state` with whatever arrives on `game_state`; don't
  predict, duplicate, or "optimistically" apply engine results. Display-only
  helpers that mirror engine math live in `features/<f>/lib/` and are
  unit-tested (e.g. `features/game/lib/tileValue.ts`).
- **One Zustand store** (`store/gameStore.ts`) wires all socket listeners in
  `init()` and exposes `emit` wrappers + selectors (`me()`, `isMyTurn()`). It
  backs **both** lobby and game, so it stays at `src/` root, not under
  `features/game/`. Socket singleton is `socket.ts`.
- **Imports:** cross-directory uses the `@/` alias (→ `client/src`);
  same-directory stays relative.
- **i18n is per-player (EN/ID).** UI strings go in `i18n/locales/{en,id}.json`;
  game-data labels are localized via the overlay in `i18n/gameData.ts`;
  server log/error codes re-render through `i18n/messages.ts`. Don't hardcode
  user-facing copy.
- Organize by **feature** (`features/game|lobby|home/...`); shared primitives go
  in `components/ui/`.

## Conventions

- React 18 + Vite 5 + Zustand + Tailwind + framer-motion + i18next.
- Sound cues are driven off state transitions (`sound/stateSounds.ts`), not
  fired ad-hoc from components.
- `pnpm test` runs the client Vitest harness (jsdom + testing-library).
