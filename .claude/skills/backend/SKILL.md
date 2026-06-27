---
name: backend
description: Backend/server engineering for Tuan Tanah — Fastify 5 + Socket.io 4, the realtime socket layer, room lifecycle, sessions, and the request→mutation→broadcast write path. Use when adding/changing server handlers, room state management, AFK/auction timers, or server bootstrap.
---

# Backend — Tuan Tanah server

Stack: **Fastify 5.8** + **Socket.io 4.8** + **tsx** (no build step). Entry is `server/src/bootstrap/index.ts`; env/io wiring in `bootstrap/env.ts`. The engine is pure (see the `game` skill); this skill is about everything around it — the realtime layer, rooms, and sessions.

## Request → mutation → broadcast flow

Every in-game action follows the same path (`server/src/realtime/game.ts`, `lobby.ts`):

1. Resolve the session: `const { roomId, playerId } = requireSession(socket)` (`rooms/sessions.ts` maps `socket.id` → `{ roomId, playerId }`).
2. `mutateRoom(store, roomId, fn)` (`rooms/rooms.ts`) loads state, runs `fn` (mutates in place, may return a value), persists, returns fn's result. **All writes go through `mutateRoom`** — it serializes per-room via promise chains so concurrent events on one room can't race.
3. `fn` calls a pure engine function. Invalid actions `throw new EngineError(code, params)`.
4. `broadcastState(io, store, roomId)` re-reads and emits the full state to the room.
5. `guard(socket, fn)` wraps the handler body and converts any thrown error into an `error` event back to the offending socket only.

## Use the write-path helpers, not the primitives

Most handlers call the helpers in `realtime/mutations.ts` instead of `mutateRoom` + `broadcastState` directly:

```ts
// can bankrupt players: mutate, broadcast, re-arm AFK, emit player_eliminated
mutateWithEliminations(io, store, roomId, (state) => rollDice(state, playerId))
// no elimination risk: just mutate + broadcast
mutateAndBroadcast(io, store, roomId, (state) => fn(state))
// auction actions: mutate, arm auction timer, broadcast, re-arm AFK clock
mutateAndArmAuction(io, store, roomId, (state) => fn(state))
// lower-level: returns { value, eliminated } around a sync mutation
runWithEliminations(state, () => fn())
```

## Handler shape

```ts
socket.on('roll_dice', () =>
  guard(socket, async () => {
    const { roomId, playerId } = requireSession(socket)
    const result = await mutateWithEliminations(io, store, roomId, (state) =>
      rollDice(state, playerId),
    )
    if (result.card)
      io.to(roomId).emit('card_drawn', { type: result.card.type, card: result.card.card, playerId })
    if (result.rent) io.to(roomId).emit('rent_paid', result.rent)
    await concludeIfWon(io, store, roomId)
  }),
)
```

## Files

- `realtime/common.ts` — `TTServer`/`TTSocket` types, `broadcastState`, `sendStateTo`, `guard`, `requireSession`.
- `realtime/mutations.ts` — the write-path helpers above.
- `realtime/game.ts` — in-game handlers (roll, buy, upgrade, law office, auction, meta-action, ability, pinjol).
- `realtime/lobby.ts` — join/rejoin/pick_role/update_settings/start/leave. **Lobby ack errors are returned via `AckResult.error` as plain English** (not yet i18n-keyed).
- `realtime/gameOver.ts` — `concludeIfWon`, `scheduleTimeLimit`. Call `concludeIfWon` after actions that can end the game.
- `realtime/afk.ts` — `broadcastAndArm`, auction timers, AFK strike logic.
- `rooms/rooms.ts` — `createRoom`, `mutateRoom`. `rooms/sessions.ts` — session map. `rooms/store.ts` — `GameStore` (Redis or memory).
- `security.ts` — `connectionGate`, `trackConnection`. `@fastify/cors` + `@fastify/rate-limit` are wired in bootstrap; CORS is required in prod (see `web`/`devops`).

## Adding an action

1. Add the event to **both** maps in `shared/types/events.ts`.
2. Write a pure engine function that throws `EngineError` on invalid input.
3. Register a handler in `realtime/game.ts` with the matching `mutations.ts` helper.
4. Add i18n codes for any new log/error. Full recipe: the `add-game-action` skill.

After changes: `pnpm check` and `pnpm --filter server test`.
