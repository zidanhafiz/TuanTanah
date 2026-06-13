import type { GameState } from '@tuan-tanah/shared'
import { playSound } from './AudioManager.js'
import { playOnMoveSettled } from '../store/rollAnimation.js'

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

  // A tile gaining an owner → buy cue (heard for every player's purchase).
  const prevOwner = new Map(prev.tiles.map((t) => [t.id, t.ownerId]))
  let iBought = false
  for (const tile of next.tiles) {
    const before = prevOwner.get(tile.id) ?? null
    if (before === null && tile.ownerId !== null) {
      playSound('buy')
      if (tile.ownerId === myId) iBought = true
    }
  }

  // Any change to the local player's cash → money cue (rent, sell, tax, passive
  // income, card payouts — everything that gives or takes money). A purchase is
  // already covered by the buy cue above, so don't double up. Routed through the
  // roll cinematic so landing consequences (rent/tax) are heard as the token
  // settles, not mid-tumble.
  if (myId && !iBought) {
    const myPrev = prev.players.find((p) => p.id === myId)?.cash
    const myNext = next.players.find((p) => p.id === myId)?.cash
    if (myPrev !== undefined && myNext !== undefined && myPrev !== myNext) {
      playOnMoveSettled('money')
    }
  }
}
