// Timed effect scheduler (tech doc §10).
// Effects decay at the end of each full round.
import type { ActiveEffect, GameState, TileId } from '@tuan-tanah/shared'

/** Decrement roundsRemaining for all effects; drop expired ones. Mutates state. */
export function tickEffects(state: GameState): void {
  state.activeEffects = state.activeEffects
    .map((e) => ({ ...e, roundsRemaining: e.roundsRemaining - 1 }))
    .filter((e) => e.roundsRemaining > 0)
}

/**
 * Apply tile-targeted earn multipliers (rent_multiplier + transport_multiplier)
 * to a base rent amount. Covers both property rent and transport rent.
 */
export function applyRentEffects(baseRent: number, tileId: TileId, state: GameState): number {
  let rent = baseRent
  for (const effect of state.activeEffects) {
    if (
      (effect.type === 'rent_multiplier' || effect.type === 'transport_multiplier') &&
      effect.targetTileIds?.includes(tileId)
    ) {
      rent *= effect.multiplier ?? 1
    }
  }
  return rent
}

/**
 * Apply passive income multipliers: per-player `passive_multiplier` (e.g.
 * Influencer viral boost) and global `passive_halved` (e.g. Demo Buruh).
 */
export function applyPassiveMultiplier(base: number, playerId: string, state: GameState): number {
  let passive = base
  for (const effect of state.activeEffects) {
    if (effect.type === 'passive_multiplier' && effect.targetPlayerId === playerId) {
      passive *= effect.multiplier ?? 1
    } else if (effect.type === 'passive_halved') {
      // Global: no target — affects every player's passive income.
      passive *= effect.multiplier ?? 1
    }
  }
  return passive
}

/**
 * Whether `payerId` holds rent immunity on `tileId` (from an accepted rent-immunity
 * deal). While active, landing on that tile costs the payer no rent.
 */
export function hasRentImmunity(state: GameState, payerId: string, tileId: TileId): boolean {
  return state.activeEffects.some(
    (e) =>
      e.type === 'rent_immunity' &&
      e.targetPlayerId === payerId &&
      e.targetTileIds?.includes(tileId),
  )
}

/**
 * A tile's effective tier after any `tier_drop` effects (e.g. Banjir Jakarta),
 * clamped to >= 0. Used for both rent and passive-income valuation.
 */
export function effectiveTier(state: GameState, tileId: TileId, rawTier: number): number {
  let drop = 0
  for (const effect of state.activeEffects) {
    if (effect.type === 'tier_drop' && effect.targetTileIds?.includes(tileId)) {
      drop += effect.multiplier ?? 1
    }
  }
  return Math.max(0, rawTier - drop)
}

export type { ActiveEffect }
