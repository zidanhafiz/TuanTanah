// Timed effect scheduler (tech doc §10).
// Effects decay at the end of each full round.
import type { ActiveEffect, GameState, TileId } from '@tuan-tanah/shared'

/** Decrement roundsRemaining for all effects; drop expired ones. Mutates state. */
export function tickEffects(state: GameState): void {
  state.activeEffects = state.activeEffects
    .map((e) => ({ ...e, roundsRemaining: e.roundsRemaining - 1 }))
    .filter((e) => e.roundsRemaining > 0)
}

/** Apply rent multiplier effects targeting a tile to a base rent amount. */
export function applyRentEffects(baseRent: number, tileId: TileId, state: GameState): number {
  let rent = baseRent
  for (const effect of state.activeEffects) {
    if (effect.type === 'rent_multiplier' && effect.targetTileIds?.includes(tileId)) {
      rent *= effect.multiplier ?? 1
    }
  }
  return rent
}

/** Apply passive_multiplier effects targeting a player (e.g. Influencer viral boost). */
export function applyPassiveMultiplier(base: number, playerId: string, state: GameState): number {
  let passive = base
  for (const effect of state.activeEffects) {
    if (effect.type === 'passive_multiplier' && effect.targetPlayerId === playerId) {
      passive *= effect.multiplier ?? 1
    }
  }
  return passive
}

// TODO (later): passive_halved / transport_multiplier / tier_drop application,
// lobby_block + turn_skip resolution.
export type { ActiveEffect }
