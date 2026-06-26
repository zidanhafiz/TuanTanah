// Shared write paths for the socket handlers. Every in-game action mutates the
// room, broadcasts the fresh state (re-arming the AFK clock), and emits any
// follow-up events. These helpers fold that boilerplate so each handler in
// game.ts is just "describe the engine call + its action-specific emits".
//
// Lives in its own module (not common.ts) because it depends on afk.ts's
// broadcastAndArm/armAuction, and afk.ts already depends on common.ts — routing
// it through common.ts would create a cycle.
import type { GameState } from '@tuan-tanah/shared'
import { mutateRoom } from '../rooms/rooms.js'
import type { GameStore } from '../rooms/store.js'
import { armAuction, broadcastAndArm } from './afk.js'
import type { TTServer } from './common.js'

/**
 * Run an engine mutation and report which players it newly eliminated, so the
 * handler can emit `player_eliminated`. Diffing `isEliminated` here avoids
 * threading eliminated ids through every engine function.
 */
export function runWithEliminations<T>(
  state: GameState,
  fn: () => T,
): { value: T; eliminated: string[] } {
  const before = state.players.filter((p) => p.isEliminated).map((p) => p.id)
  const value = fn()
  const eliminated = state.players
    .filter((p) => p.isEliminated && !before.includes(p.id))
    .map((p) => p.id)
  return { value, eliminated }
}

export function emitEliminated(io: TTServer, roomId: string, ids: string[]): void {
  for (const id of ids) io.to(roomId).emit('player_eliminated', { playerId: id })
}

/**
 * The common write path for an action that may bankrupt a player: mutate the room
 * (tracking new eliminations), broadcast the fresh state + re-arm the AFK clock,
 * and emit `player_eliminated` for anyone the mutation knocked out. Returns the
 * engine fn's value; callers add any action-specific emits and the `concludeIfWon`
 * win check afterwards.
 */
export async function mutateWithEliminations<T>(
  io: TTServer,
  store: GameStore,
  roomId: string,
  fn: (state: GameState) => T,
): Promise<T> {
  const { value, eliminated } = await mutateRoom(store, roomId, (state) =>
    runWithEliminations(state, () => fn(state)),
  )
  await broadcastAndArm(io, store, roomId)
  emitEliminated(io, roomId, eliminated)
  return value
}

/**
 * The common write path for an action that can't bankrupt anyone: mutate the room,
 * then broadcast + re-arm the AFK clock. Returns the engine fn's value.
 */
export async function mutateAndBroadcast<T>(
  io: TTServer,
  store: GameStore,
  roomId: string,
  fn: (state: GameState) => T,
): Promise<T> {
  const value = await mutateRoom(store, roomId, (state) => fn(state))
  await broadcastAndArm(io, store, roomId)
  return value
}

/**
 * Write path for an action that opens or advances a force-buy auction: mutate the
 * room, (re)arm the auction clock so the broadcast carries its deadline, then
 * broadcast + re-arm the AFK clock.
 */
export async function mutateAndArmAuction<T>(
  io: TTServer,
  store: GameStore,
  roomId: string,
  fn: (state: GameState) => T,
): Promise<T> {
  const value = await mutateRoom(store, roomId, (state) => fn(state))
  await armAuction(io, store, roomId)
  await broadcastAndArm(io, store, roomId)
  return value
}
