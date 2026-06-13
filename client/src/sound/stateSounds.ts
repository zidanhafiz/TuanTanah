import type { GameState } from '@tuan-tanah/shared'
import { playSound } from './AudioManager.js'

/**
 * Derive sound effects from a server state broadcast by diffing the previous
 * authoritative state against the new one. Mirrors the approach in
 * `rollAnimation.ts`: the server owns the truth, the client only *reacts*.
 *
 * Dice + token-land sounds are NOT here — they're triggered from the roll
 * cinematic (`rollAnimation.ts`) so they stay synced to the on-screen tumble.
 */
export function playStateSounds(
  prev: GameState | null,
  next: GameState,
  myId: string | null,
): void {
  if (!prev || next.phase !== 'playing') return

  // Turn handed to the local player → "your turn" chime.
  if (myId && prev.phase === 'playing') {
    const prevTurn = prev.players[prev.currentPlayerIndex]?.id
    const nextTurn = next.players[next.currentPlayerIndex]?.id
    if (nextTurn !== prevTurn && nextTurn === myId) playSound('yourTurn')
  }

  // Tile ownership changes → buy (gained an owner) / sell (owner cleared).
  const prevOwner = new Map(prev.tiles.map((t) => [t.id, t.ownerId]))
  for (const tile of next.tiles) {
    const before = prevOwner.get(tile.id) ?? null
    if (before === tile.ownerId) continue
    if (before === null && tile.ownerId !== null) playSound('buy')
    else if (before !== null && tile.ownerId === null) playSound('sell')
  }
}
