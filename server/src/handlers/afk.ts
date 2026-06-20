// Per-room AFK auto-skip timer. Mirrors the time-limit timer in gameOver.ts: the
// wall-clock lives here (the engine stays pure), while the effect of a timeout —
// fine / skip / kick — is the pure `applyAfkTimeout` engine function.
//
// The active player's turn carries a `turn.deadline` (epoch ms). Every action
// re-broadcasts state, and each broadcast goes through `broadcastAndArm`, which
// pushes the deadline forward and reschedules the timer — so the countdown resets
// whenever the active player does anything. When the timer fires with the deadline
// still in the past, the current player is auto-skipped.
import { AFK_TIMEOUT_MS } from '@tuan-tanah/shared'
import type { GameState } from '@tuan-tanah/shared'
import { applyAfkTimeout } from '../engine/index.js'
import { mutateRoom } from '../rooms.js'
import type { GameStore } from '../store.js'
import { broadcastState, type TTServer } from './common.js'
import { concludeIfWon } from './gameOver.js'

// Per-room AFK timers. Cleared when re-armed, when the game ends, or when the
// game pauses (debt/vote) so an idle clock can't fire on a paused table.
const roomAfkTimers = new Map<string, NodeJS.Timeout>()

export function clearAfkTimer(roomId: string): void {
  const timer = roomAfkTimers.get(roomId)
  if (timer) {
    clearTimeout(timer)
    roomAfkTimers.delete(roomId)
  }
}

/** Whether an AFK timer should be running: a live, unpaused turn with an active player. */
function afkEligible(state: GameState): boolean {
  if (state.phase !== 'playing') return false
  if (state.pendingDebts.length > 0) return false
  if (state.pendingVote) return false
  const current = state.players[state.currentPlayerIndex]
  return !!current && !current.isEliminated
}

/**
 * Set the current turn's `deadline` and (re)schedule the room's AFK timer. No-op
 * effect when the game isn't in a skippable turn — in that case the deadline is
 * cleared so the client hides the countdown.
 */
export async function armAfk(io: TTServer, store: GameStore, roomId: string): Promise<void> {
  const eligible = await mutateRoom(store, roomId, (state) => {
    if (!afkEligible(state)) {
      state.turn.deadline = null
      return false
    }
    state.turn.deadline = Date.now() + AFK_TIMEOUT_MS
    return true
  }).catch(() => false)

  clearAfkTimer(roomId)
  if (!eligible) return
  const timer = setTimeout(() => {
    void resolveAfk(io, store, roomId)
  }, AFK_TIMEOUT_MS)
  timer.unref?.()
  roomAfkTimers.set(roomId, timer)
}

/** Arm the AFK timer, then broadcast — so clients receive the fresh deadline. */
export async function broadcastAndArm(
  io: TTServer,
  store: GameStore,
  roomId: string,
): Promise<void> {
  await armAfk(io, store, roomId)
  await broadcastState(io, store, roomId)
}

/**
 * Fired when a turn runs out the inactivity clock. Re-checks the deadline (an
 * action may have re-armed it in the meantime → no-op), auto-skips the current
 * player, then re-arms for the next player and resolves any win condition.
 */
export async function resolveAfk(io: TTServer, store: GameStore, roomId: string): Promise<void> {
  const eliminated = await mutateRoom(store, roomId, (state) => {
    if (!afkEligible(state)) return [] as string[]
    if (state.turn.deadline === null || Date.now() < state.turn.deadline) return [] as string[]
    const current = state.players[state.currentPlayerIndex]
    if (!current) return [] as string[]
    const before = state.players.filter((p) => p.isEliminated).map((p) => p.id)
    applyAfkTimeout(state, current.id)
    return state.players.filter((p) => p.isEliminated && !before.includes(p.id)).map((p) => p.id)
  }).catch(() => [] as string[])

  await broadcastAndArm(io, store, roomId)
  for (const id of eliminated) io.to(roomId).emit('player_eliminated', { playerId: id })
  await concludeIfWon(io, store, roomId)
}
