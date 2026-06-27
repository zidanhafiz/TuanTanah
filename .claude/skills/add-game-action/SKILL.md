---
name: add-game-action
description: Step-by-step recipe for adding a new player action to Tuan Tanah end-to-end — socket event, pure engine function, server handler, client emitter, and i18n. Use when a new action lets a player do something the server must validate and broadcast (e.g. a new meta-action, ability, or board interaction).
---

# Add a game action (end-to-end recipe)

A new player action touches five layers in a fixed order. Follow them top to bottom; each step's output feeds the next. The action flows: client `emit` → socket handler → `mutateRoom` → pure engine fn → broadcast full `GameState`.

## 1. Define the socket event — `shared/types/events.ts`

Add to the correct map (almost always **ClientToServerEvents** for an action; add a **ServerToClientEvents** entry only if you push a one-off cue beyond the state broadcast):

```ts
// ClientToServerEvents
my_action: (payload: { tileId: TileId; amount: RupiahAmount }) => void
```

Keep payloads minimal — the server already knows the player via the session. Reuse shared types (`TileId`, `RupiahAmount`, role/track enums) so both ends stay typed.

## 2. Write the pure engine function — `server/src/engine/<submodule>.ts`

Pick the submodule by domain (`actions.ts` for meta-actions, `abilities.ts` for role powers, `lawoffice.ts`, `pinjol.ts`, …). The function takes `GameState` (+ the acting `playerId` and payload), mutates in place, and **throws `EngineError` on every invalid path**. No I/O; if you need randomness, take the injectable `Rng`.

```ts
export function myAction(state: GameState, playerId: string, tileId: TileId, amount: RupiahAmount) {
  const player = requirePlayer(state, playerId)
  if (state.turn.playerId !== playerId) throw new EngineError('core.notYourTurn')
  if (player.cash < amount) throw new EngineError('core.insufficientFunds', { amount: rpP(amount) })
  // ...mutate state...
  logKey(state, 'actions.myActionDone', { name: player.name, amount: rpP(amount) }, playerId)
  return {
    /* anything the handler needs to emit */
  }
}
```

Export it so `engine/index.ts` can dispatch it (re-export if your submodule isn't already surfaced).

## 3. Register the handler — `server/src/realtime/game.ts`

Wrap in `guard`, resolve the session, and use the right `mutations.ts` helper:

```ts
socket.on('my_action', (payload) =>
  guard(socket, async () => {
    const { roomId, playerId } = requireSession(socket)
    const result = await mutateWithEliminations(io, store, roomId, (state) =>
      myAction(state, playerId, payload.tileId, payload.amount),
    )
    // emit any one-off cue from `result`
    await concludeIfWon(io, store, roomId)
  }),
)
```

Helper choice: `mutateWithEliminations` if the action can bankrupt anyone (charges, rent, taxes); `mutateAndArmAuction` for auction actions; `mutateAndBroadcast` otherwise. Call `concludeIfWon` after anything that could end the game.

## 4. Add the client emitter — `client/src/store/gameStore.ts`

Add an action that emits the event, and call it from the relevant `features/game/` component:

```ts
myAction: (tileId: TileId, amount: RupiahAmount) => socket.emit('my_action', { tileId, amount }),
```

Remember: **no client-side validation that duplicates the engine** — the server rejects bad input via the `error` event. Optimistic display values that mirror engine math go in `features/game/lib/` and must be unit-tested.

## 5. Key the i18n messages — `shared/i18n/messages/*`

For every `logKey` code and `EngineError` code you introduced, add an entry in the matching module (by engine file) in **both `en` and `id`**, using the same placeholders. The parity test (`server/test/i18n-messages.test.ts`) fails otherwise.

## 6. Test & gate

Add an engine test in `server/test/` (seed a deterministic `Rng`; assert both success mutation and each `EngineError` path). Then:

```bash
pnpm --filter server test
pnpm check
```

## Checklist

- [ ] Event in the correct map of `events.ts`
- [ ] Pure engine fn, throws `EngineError`, no I/O, `Rng` injected
- [ ] Handler in `game.ts` with the right `mutations.ts` helper + `concludeIfWon`
- [ ] Client emitter in `gameStore.ts`, wired into UI, no duplicated logic
- [ ] All new codes keyed in `shared/i18n/messages/*` (en + id)
- [ ] Engine test added; `pnpm check` + `pnpm test` green
