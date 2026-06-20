// Timed effect scheduler (tech doc §10).
// Most effects decay at the end of each full round; negotiation deals
// (rent_immunity, revenue_share) decay per lap via tickLapEffects instead.
import type { ActiveEffect, GameState, PassType, Player, TileId } from '@tuan-tanah/shared'

/**
 * Decrement roundsRemaining for round-based effects; drop expired ones. Lap-based
 * effects (those with lapsRemaining set) are left untouched — they decay in
 * tickLapEffects when their anchor player passes GO. Mutates state.
 */
export function tickEffects(state: GameState): void {
  state.activeEffects = state.activeEffects
    .map((e) => (e.lapsRemaining != null ? e : { ...e, roundsRemaining: e.roundsRemaining - 1 }))
    .filter((e) => e.lapsRemaining != null || e.roundsRemaining > 0)
}

/**
 * Decrement lapsRemaining for lap-based effects anchored to `playerId` (called
 * when that player passes GO); drop those that hit zero. Mutates state.
 */
export function tickLapEffects(state: GameState, playerId: string): void {
  state.activeEffects = state.activeEffects
    .map((e) =>
      e.lapsRemaining != null && e.lapAnchorPlayerId === playerId
        ? { ...e, lapsRemaining: e.lapsRemaining - 1 }
        : e,
    )
    .filter((e) => e.lapsRemaining == null || e.lapsRemaining > 0)
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
 * deal). While active, the payer pays no rent on any tile owned by the deal's owner.
 * Legacy single-tile deals fall back to targetTileIds.
 */
export function hasRentImmunity(state: GameState, payerId: string, tileId: TileId): boolean {
  const ownerId = state.tiles[tileId]?.ownerId ?? null
  return state.activeEffects.some((e) => {
    if (e.type !== 'rent_immunity' || e.targetPlayerId !== payerId) return false
    if (e.ownerId != null) return ownerId != null && e.ownerId === ownerId
    return e.targetTileIds?.includes(tileId) ?? false
  })
}

/**
 * Consume one matching free-pass card from a player's inventory, if held.
 * Returns true (and removes the card) when a pass of `type` was available.
 * Used to auto-waive an incoming rent / tax / jailing.
 */
export function consumeOwnedCard(player: Player, type: PassType): boolean {
  const i = player.ownedCards.findIndex((c) => c.type === type)
  if (i < 0) return false
  player.ownedCards.splice(i, 1)
  return true
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
