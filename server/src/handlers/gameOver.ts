// Game-over funnel: a single place that resolves win conditions, broadcasts the
// final state, and emits `game_over`. Both the per-room time-limit timer and the
// end_turn handler call `concludeIfWon`, so the resolution path is identical
// whether the game ends by inactivity or by a player's action.
import { finalStandings, resolveGameOver } from '../engine/index.js'
import { mutateRoom } from '../rooms.js'
import type { GameStore } from '../store.js'
import { broadcastState, type TTServer } from './common.js'

// Per-room time-limit timers. Cleared when the game ends or is rescheduled.
const roomTimers = new Map<string, NodeJS.Timeout>()

export function clearRoomTimer(roomId: string): void {
  const timer = roomTimers.get(roomId)
  if (timer) {
    clearTimeout(timer)
    roomTimers.delete(roomId)
  }
}

/**
 * Check the room's win condition; if the game just ended, clear its timer,
 * broadcast the final state, and emit `game_over` with the standings.
 */
export async function concludeIfWon(io: TTServer, store: GameStore, roomId: string): Promise<void> {
  const ended = await mutateRoom(store, roomId, (state) => resolveGameOver(state, Date.now()))
  if (!ended) return
  clearRoomTimer(roomId)
  await broadcastState(io, store, roomId)
  const state = await store.get(roomId)
  if (!state || !state.winner) return
  io.to(roomId).emit('game_over', {
    winner: state.winner,
    finalStandings: finalStandings(state),
  })
}

/**
 * Schedule the time-limit wakeup for a room that just started. The timer is a
 * safety net for inactivity — `concludeIfWon` recomputes from `startedAt`, so a
 * little clock drift is harmless. No-op unless the win condition uses time.
 */
export async function scheduleTimeLimit(
  io: TTServer,
  store: GameStore,
  roomId: string,
): Promise<void> {
  const state = await store.get(roomId)
  if (!state) return
  const { winCondition, timeLimitMinutes } = state.settings
  if (winCondition !== 'time' && winCondition !== 'both') return
  if (!timeLimitMinutes) return

  clearRoomTimer(roomId)
  const timer = setTimeout(() => {
    void concludeIfWon(io, store, roomId)
  }, timeLimitMinutes * 60_000)
  timer.unref?.()
  roomTimers.set(roomId, timer)
}
