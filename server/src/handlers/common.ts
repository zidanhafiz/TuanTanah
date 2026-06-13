import type { Server, Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@tuan-tanah/shared'
import type { GameStore } from '../store.js'
import { getSession } from '../sessions.js'

export type TTServer = Server<ClientToServerEvents, ServerToClientEvents>
export type TTSocket = Socket<ClientToServerEvents, ServerToClientEvents>

/** Broadcast the canonical game state to everyone in a room. */
export async function broadcastState(
  io: TTServer,
  store: GameStore,
  roomId: string,
): Promise<void> {
  const state = await store.get(roomId)
  if (!state) return
  // Strip server-only reconnect tokens — they must never reach any client, or a
  // player could replay another's token to hijack their seat.
  const { reconnectTokens: _tokens, ...safe } = state
  io.to(roomId).emit('game_state', safe)
}

/** Run an async handler body, turning thrown errors into a socket `error` event. */
export async function guard(socket: TTSocket, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    socket.emit('error', { message: (err as Error).message ?? 'Unexpected error' })
  }
}

/** Resolve the player's session or throw a friendly error. */
export function requireSession(socket: TTSocket) {
  const session = getSession(socket.id)
  if (!session) throw new Error('You are not in a room')
  return session
}
