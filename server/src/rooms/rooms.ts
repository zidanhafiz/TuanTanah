// Room lifecycle helpers: code generation and a per-room serialized mutator so
// concurrent socket events on the same room never race on read-modify-write.
import { randomInt } from 'node:crypto'
import type { GameState } from '@tuan-tanah/shared'
import { createGameState } from '../engine/index.js'
import type { GameStore } from './store.js'

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I/L
const CODE_LEN = 6

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LEN; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)]
  return code
}

export async function createRoom(store: GameStore): Promise<GameState> {
  let code = generateCode()
  // Avoid (extremely unlikely) collisions.
  for (let i = 0; i < 5 && (await store.has(code)); i++) code = generateCode()
  const state = createGameState(code, Date.now())
  await store.set(code, state)
  return state
}

// Per-room promise chains to serialize mutations.
const chains = new Map<string, Promise<unknown>>()

/**
 * Load the room, run `fn` (which mutates the state in place and may return a
 * value), persist the result, and return fn's value. Serialized per room.
 */
export async function mutateRoom<T>(
  store: GameStore,
  roomId: string,
  fn: (state: GameState) => T,
): Promise<T> {
  const prev = chains.get(roomId) ?? Promise.resolve()
  const next = prev.then(async () => {
    const state = await store.get(roomId)
    if (!state) throw new RoomError('Room not found')
    const result = fn(state)
    state.updatedAt = Date.now()
    await store.set(roomId, state)
    return result
  })
  // Keep the chain alive regardless of individual failures.
  const settled = next.catch(() => undefined)
  chains.set(roomId, settled)
  // Drop the entry once this mutation settles, unless a newer one was queued
  // behind it — otherwise the map would grow by one promise per room forever.
  void settled.finally(() => {
    if (chains.get(roomId) === settled) chains.delete(roomId)
  })
  return next
}

export class RoomError extends Error {}
