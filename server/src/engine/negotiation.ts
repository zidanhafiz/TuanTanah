// Negotiation deal state machine (tech doc §11). Server-enforced player-to-player
// deals: property_swap, cash_for_property, rent_immunity, revenue_share.
// Proposing commits the proposer; the target accepts/rejects; on accept the deal is
// re-validated against the current state and applied atomically. Pure engine logic —
// throws EngineError on invalid input.
import { REGIONS, SALES_DEAL_BONUS_RATE, TRANSPORT_BUY_PRICE } from '@tuan-tanah/shared'
import type { GameState, NegotiationDeal, Player, RupiahAmount, TileId } from '@tuan-tanah/shared'
import { getTileDef } from './board.js'
import { EngineError, rupiah } from './index.js'
import { pushLog, uid } from './util.js'

function findPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id)
}

function ownerOf(state: GameState, tileId: TileId): string | null {
  return state.tiles[tileId]?.ownerId ?? null
}

function tileName(tileId: TileId): string {
  return getTileDef(tileId).name
}

/** Bank buy price of a tile (used to value swaps for the Sales bonus). */
function tileBuyPrice(tileId: TileId): RupiahAmount {
  const def = getTileDef(tileId)
  if (def.type === 'transport') return TRANSPORT_BUY_PRICE
  if (def.type === 'property' && def.region) return REGIONS[def.region].buyPrice
  return 0
}

function dealLabel(deal: NegotiationDeal): string {
  switch (deal.type) {
    case 'property_swap':
      return 'property swap'
    case 'cash_for_property':
      return 'cash-for-property deal'
    case 'rent_immunity':
      return 'rent-immunity deal'
    case 'revenue_share':
      return 'revenue-share deal'
  }
}

/** The cash value of a deal, used to size the Sales 15% bank bonus. */
function dealValue(deal: NegotiationDeal): RupiahAmount {
  switch (deal.type) {
    case 'cash_for_property':
    case 'rent_immunity':
      return deal.cashAmount ?? 0
    case 'property_swap':
      return deal.requestTileId != null ? tileBuyPrice(deal.requestTileId) : 0
    case 'revenue_share':
      return 0 // no upfront cash changes hands
  }
}

/** Returns a human-readable error string if the deal is invalid, else null. */
export function validateDeal(state: GameState, deal: NegotiationDeal): string | null {
  const from = findPlayer(state, deal.fromPlayerId)
  const to = findPlayer(state, deal.toPlayerId)
  if (!from) return 'Proposer is not in the game'
  if (!to) return 'Target player not found'
  if (from.id === to.id) return 'You cannot make a deal with yourself'
  if (from.isEliminated || to.isEliminated) return 'Both players must be active'

  switch (deal.type) {
    case 'property_swap': {
      if (deal.offerTileId == null || deal.requestTileId == null)
        return 'Select a tile from each side'
      if (deal.offerTileId === deal.requestTileId) return 'Pick two different tiles'
      if (ownerOf(state, deal.offerTileId) !== from.id) return 'You no longer own the offered tile'
      if (ownerOf(state, deal.requestTileId) !== to.id)
        return `${to.name} no longer owns the requested tile`
      return null
    }
    case 'cash_for_property': {
      if (deal.requestTileId == null) return 'Select a tile to buy'
      if ((deal.cashAmount ?? 0) <= 0) return 'Enter a price'
      if (ownerOf(state, deal.requestTileId) !== to.id) return `${to.name} no longer owns that tile`
      if (from.cash < (deal.cashAmount ?? 0)) return 'You cannot afford this offer'
      return null
    }
    case 'rent_immunity': {
      if (deal.requestTileId == null) return 'Select a tile for immunity'
      if ((deal.rounds ?? 0) < 1) return 'Immunity must last at least 1 round'
      if (ownerOf(state, deal.requestTileId) !== to.id) return `${to.name} no longer owns that tile`
      if (from.cash < (deal.cashAmount ?? 0)) return 'You cannot afford this offer'
      return null
    }
    case 'revenue_share': {
      const pct = deal.sharePercent ?? 0
      if (pct <= 0 || pct > 100) return 'Share must be between 1% and 100%'
      if ((deal.rounds ?? 0) < 1) return 'Share must last at least 1 round'
      if (deal.shareFrom !== 'proposer' && deal.shareFrom !== 'target')
        return 'Choose who shares income'
      return null
    }
    default:
      return 'Unknown deal type'
  }
}

/**
 * Register a new deal offer from `fromPlayerId` (overriding any client-supplied
 * proposer to prevent spoofing). Validates, stamps an id, and queues it for the
 * target's response. Returns the stored deal so the handler can notify the target.
 */
export function proposeDeal(
  state: GameState,
  fromPlayerId: string,
  input: NegotiationDeal,
): NegotiationDeal {
  const deal: NegotiationDeal = {
    ...input,
    id: uid(),
    fromPlayerId, // trust the session, not the client payload
    status: 'pending',
  }
  const error = validateDeal(state, deal)
  if (error) throw new EngineError(error)

  state.pendingDeals.push(deal)
  const from = findPlayer(state, deal.fromPlayerId)!
  const to = findPlayer(state, deal.toPlayerId)!
  pushLog(state, `${from.name} proposed a ${dealLabel(deal)} to ${to.name}`, from.id)
  return deal
}

/** The target accepts or rejects a pending deal. On accept it is applied atomically. */
export function respondToDeal(
  state: GameState,
  playerId: string,
  dealId: string,
  accept: boolean,
): void {
  const idx = state.pendingDeals.findIndex((d) => d.id === dealId)
  if (idx === -1) throw new EngineError('That deal is no longer available')
  const deal = state.pendingDeals[idx]!
  if (deal.toPlayerId !== playerId)
    throw new EngineError('Only the target can respond to this deal')

  const from = findPlayer(state, deal.fromPlayerId)
  const to = findPlayer(state, deal.toPlayerId)

  if (accept) {
    // Re-validate: the world may have moved since the offer was made.
    const error = validateDeal(state, deal)
    if (error) throw new EngineError(error)
    applyDeal(state, deal)
    if (from && to) pushLog(state, `${to.name} accepted ${from.name}'s ${dealLabel(deal)}`, to.id)
  } else if (from && to) {
    pushLog(state, `${to.name} rejected ${from.name}'s ${dealLabel(deal)}`, to.id)
  }
  state.pendingDeals.splice(idx, 1)
}

/** Execute an accepted deal. Assumes the deal has just been validated. Mutates state. */
export function applyDeal(state: GameState, deal: NegotiationDeal): void {
  const from = findPlayer(state, deal.fromPlayerId)
  const to = findPlayer(state, deal.toPlayerId)
  if (!from || !to) throw new EngineError('A player in this deal is no longer available')

  switch (deal.type) {
    case 'property_swap': {
      state.tiles[deal.offerTileId!]!.ownerId = to.id
      state.tiles[deal.requestTileId!]!.ownerId = from.id
      pushLog(
        state,
        `${from.name} and ${to.name} swapped ${tileName(deal.offerTileId!)} ↔ ${tileName(deal.requestTileId!)}`,
        from.id,
      )
      break
    }
    case 'cash_for_property': {
      const amount = deal.cashAmount ?? 0
      from.cash -= amount
      to.cash += amount
      state.tiles[deal.requestTileId!]!.ownerId = from.id
      pushLog(
        state,
        `${from.name} bought ${tileName(deal.requestTileId!)} from ${to.name} for ${rupiah(amount)}`,
        from.id,
      )
      break
    }
    case 'rent_immunity': {
      const amount = deal.cashAmount ?? 0
      from.cash -= amount
      to.cash += amount
      state.activeEffects.push({
        id: uid(),
        type: 'rent_immunity',
        targetPlayerId: from.id, // the payer is immune to rent on the tile
        targetTileIds: [deal.requestTileId!],
        roundsRemaining: deal.rounds ?? 1,
        sourceCard: `deal_${deal.id}`,
      })
      pushLog(
        state,
        `${from.name} paid ${rupiah(amount)} for ${deal.rounds}-round rent immunity on ${tileName(deal.requestTileId!)}`,
        from.id,
      )
      break
    }
    case 'revenue_share': {
      const source = deal.shareFrom === 'proposer' ? from : to
      const beneficiary = source.id === from.id ? to : from
      state.activeEffects.push({
        id: uid(),
        type: 'revenue_share',
        targetPlayerId: source.id, // whose passive income is shared
        beneficiaryPlayerId: beneficiary.id,
        multiplier: (deal.sharePercent ?? 0) / 100,
        roundsRemaining: deal.rounds ?? 1,
        sourceCard: `deal_${deal.id}`,
      })
      pushLog(
        state,
        `${source.name} will share ${deal.sharePercent}% of passive income with ${beneficiary.name} for ${deal.rounds} rounds`,
        source.id,
      )
      break
    }
  }

  // Sales role earns a 15% bank bonus on deals it initiates.
  if (from.role === 'sales') {
    const bonus = Math.round(dealValue(deal) * SALES_DEAL_BONUS_RATE)
    if (bonus > 0) {
      from.cash += bonus
      state.bank -= bonus
      pushLog(state, `${from.name} earned a ${rupiah(bonus)} Sales bonus on the deal`, from.id)
    }
  }
}
