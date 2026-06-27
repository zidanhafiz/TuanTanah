---
name: frontend
description: Frontend/client engineering for Tuan Tanah — React 18 + Vite 5 + Zustand + Tailwind + framer-motion + i18next. Use when building or changing UI, the game store, socket wiring, the neobrutalist design system, animations, sound, or client i18n.
---

# Frontend — Tuan Tanah client

Stack: **React 18.3** + **Vite 5.4** + **Zustand 4.5** + **Tailwind 3.4** + **framer-motion 11** + **lucide-react** + **i18next 26**. The client is a thin view over server state.

## The cardinal rule

**Never compute game logic on the client.** The server is authoritative. The store emits request events and replaces `state` with whatever `game_state` broadcast arrives. If you need a derived display value that mirrors engine math (e.g. tile rent), put it in the feature's `lib/` and unit-test it against the engine — see `features/game/lib/tileValue.ts`.

## Store: `client/src/store/gameStore.ts`

A single Zustand store (`useGame`) backs **both lobby and game**, so it lives at `src/store/`, not inside `features/game/`. It:

- Wires every socket listener in `init()` — `connect`/`disconnect`/`game_state`/`card_drawn`/`error`/etc. On `game_state` it calls `noteIncomingState`, `playStateSounds`, then `set({ state })`.
- Auto-reclaims a seat on reconnect via `rejoin` (seat held by a secret token, persisted through `loadSession`/`saveSession`).
- Exposes `emit` wrappers as actions (`roll`, `buy`, `upgrade`, `sell`, `buildLahan`, `lawOfficeBuy`, …) and derived selectors `me()` / `isMyTurn()`.

The socket singleton is `client/src/socket.ts`. When you add a server→client event, add a listener in `init()`; when you add a client→server action, add an `emit` wrapper action.

## Routing & feature layout

`app/App.tsx` routes: `/` (`features/home/Home`), `/room/:roomId` (`features/game/RoomGate` → `Lobby` or `Game` by `state.phase`), `/design` (`app/StyleGuide`). Code is grouped by feature: `features/game/` (Game page + Board + every modal), `features/lobby/`, `features/home/`, plus `auth`/`social`/`matchmaking` seams.

## Imports

Cross-directory client imports use the `@/` alias (→ `client/src`, configured in `client/tsconfig.json` paths + `vite.config.ts`). Same-directory imports stay relative.

## Design system: `client/src/components/ui/`

Neobrutalist primitives — `Button`, `Card`, `Badge`, `Modal`, `Tabs`, `Toast`, `Tooltip`, `FloatUp`, `MoneyDelta` (all barrel-exported via `index.ts`). Build new UI from these; cross-feature widgets go here, feature-specific ones in the feature folder. `/design` is a live gallery — add new primitives there.

## Animation & sound

- framer-motion for board/token/dice — helpers in `lib/motion.ts`, roll choreography in `store/rollAnimation.ts`.
- Sound in `sound/`: `AudioManager` (HTMLAudioElement wrapper, preload + autoplay-unlock on gesture), `manifest.ts` (file map), `stateSounds.ts` (cues driven off state transitions), toggle persisted via `settings.ts`.

## i18n (client-side, per-player EN/ID)

`i18next` + `react-i18next` in `client/src/i18n/`. UI strings in `locales/{en,id}.json`. Game data from `shared` constants is localized through the overlay in `i18n/gameData.ts`. Server log/error messages arrive as a stable `code` + tagged `params` and are re-rendered in the viewer's language by `i18n/messages.ts` (wired into `EventLog` + the `error` event). Each entry also carries a rendered English `message` fallback. When you surface a new server message, ensure its code exists in `shared/i18n/messages/*`.

## Conventions

Prettier: no semicolons, single quotes, trailing commas, printWidth 100. TS strict. Format with `Rp ${n.toLocaleString('id-ID')}` (or the `lib/format.ts` helper). After changes: `pnpm check` and `pnpm --filter client test` (Vitest + jsdom + testing-library, config in `client/vitest.config.ts`).
