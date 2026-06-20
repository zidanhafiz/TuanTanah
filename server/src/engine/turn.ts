// Turn state machine: start-of-turn upkeep, turn advancement, round ticks.
import {
  landTier,
  PROPERTY_TIERS,
  REGIONS,
  REGION_SET_PASSIVE_MULTIPLIER,
} from '@tuan-tanah/shared'
import type { GameState, Player, RupiahAmount } from '@tuan-tanah/shared'
import { getTileDef, ownsFullRegion } from './board.js'
import { applyPassiveMultiplier, effectiveTier, tickEffects } from './effects.js'
import { chargeInterest } from './pinjol.js'
import { pushLog } from './util.js'

/** Passive income from a player's Property-track tiles (collected each turn). */
export function collectPassiveIncome(state: GameState, player: Player): RupiahAmount {
  let total = 0
  for (const tile of state.tiles) {
    if (tile.ownerId !== player.id) continue
    const tier = effectiveTier(state, tile.id, tile.tier)
    if (tier < 1) continue
    const def = getTileDef(tile.id)

    // Property-track tiles: region passive × tier × region-set bonus.
    if (tile.track === 'property') {
      const region = def.region
      if (!region) continue
      const regionDef = REGIONS[region]
      const tierDef = PROPERTY_TIERS[tier - 1]
      if (!tierDef) continue
      let passive = regionDef.passiveBase * tierDef.passiveMult
      if (ownsFullRegion(state, player.id, region)) passive *= REGION_SET_PASSIVE_MULTIPLIER
      total += passive
      continue
    }

    // Lahan Kosong businesses: tiered passive (bigger than property), treated like
    // property income — subject to passive multipliers and revenue-share deals.
    if (def.type === 'buildable_land' && tile.landBuild) {
      total += landTier(tile.landBuild, tier)?.passive ?? 0
    }
  }
  total = applyPassiveMultiplier(total, player.id, state)
  total = Math.round(total)
  if (total > 0) {
    player.cash += total
    state.bank -= total
    pushLog(
      state,
      `${player.name} collected Rp ${total.toLocaleString('id-ID')} passive income`,
      player.id,
    )
    payRevenueShares(state, player, total)
  }
  return total
}

/**
 * Redirect a cut of `player`'s passive income to any beneficiaries of an active
 * revenue-share deal (from an accepted negotiation). Mutates state.
 */
function payRevenueShares(state: GameState, player: Player, income: RupiahAmount): void {
  // Shares can stack; never pay out more than the income collected this lap.
  // Earlier effects take priority when total shares exceed 100%.
  let remaining = income
  for (const effect of state.activeEffects) {
    if (effect.type !== 'revenue_share' || effect.targetPlayerId !== player.id) continue
    const beneficiary = state.players.find((p) => p.id === effect.beneficiaryPlayerId)
    if (!beneficiary || beneficiary.isEliminated) continue
    let cut = Math.round(income * (effect.multiplier ?? 0))
    if (cut <= 0) continue
    cut = Math.min(cut, remaining)
    if (cut <= 0) break
    remaining -= cut
    player.cash -= cut
    beneficiary.cash += cut
    pushLog(
      state,
      `${player.name} shared Rp ${cut.toLocaleString('id-ID')} of passive income with ${beneficiary.name}`,
      player.id,
    )
  }
}

function resetTurnState(state: GameState): void {
  state.turn = {
    hasRolled: false,
    lastDice: null,
    rolledDoubles: false,
    pendingBuyTileId: null,
    pendingLawOffice: false,
    deadline: null,
  }
}

/**
 * If the given player has a pending `turn_skip` effect (e.g. from a Lobby meta
 * action), consume it and return true. Mutates state.
 */
function consumeTurnSkip(state: GameState, playerId: string): boolean {
  const idx = state.activeEffects.findIndex(
    (e) => e.type === 'turn_skip' && e.targetPlayerId === playerId,
  )
  if (idx === -1) return false
  state.activeEffects.splice(idx, 1)
  const player = state.players.find((p) => p.id === playerId)
  if (player) pushLog(state, `${player.name}'s turn was skipped`, playerId)
  return true
}

/** Run start-of-turn upkeep for the current player. */
export function startTurn(state: GameState): void {
  resetTurnState(state)
  const player = state.players[state.currentPlayerIndex]
  if (!player) return
  // Pinjol interest is charged per lap, the turn after they passed GO. Passive
  // income is also per lap now, collected on the pass-GO path (see movePlayer).
  if (player.owesLapInterest) {
    chargeInterest(state, player)
    player.owesLapInterest = false
  }
  pushLog(state, `${player.name}'s turn`, player.id)
}

/** Index of the next non-eliminated player; returns -1 if none remain. */
function nextActiveIndex(state: GameState): { index: number; wrapped: boolean } {
  const n = state.players.length
  for (let step = 1; step <= n; step++) {
    const raw = state.currentPlayerIndex + step
    const index = raw % n
    if (!state.players[index]?.isEliminated) {
      return { index, wrapped: raw >= n }
    }
  }
  return { index: -1, wrapped: false }
}

/** Advance to the next player, ticking the round when the turn order wraps. */
export function advanceTurn(state: GameState): void {
  const { index, wrapped } = nextActiveIndex(state)
  if (index === -1) return
  state.currentPlayerIndex = index
  if (wrapped) {
    state.round += 1
    tickEffects(state)
  }
  const next = state.players[index]
  if (next && consumeTurnSkip(state, next.id)) {
    // This player's turn is skipped (e.g. from a Lobby meta action); move on.
    advanceTurn(state)
    return
  }
  startTurn(state)
  // Start-of-turn pinjol interest can bankrupt a player with nothing to sell.
  // If that just eliminated the player whose turn we started (and no debt is
  // pending), skip past them to the next active player.
  const current = state.players[state.currentPlayerIndex]
  if (current?.isEliminated && state.pendingDebts.length === 0) advanceTurn(state)
}
