// Negotiation deal state machine (tech doc §11). Server-enforced player-to-player
// deals: property_swap, cash_for_property, rent_immunity, revenue_share.
// Proposing commits the proposer; the target accepts/rejects; on accept the deal is
// re-validated against the current state and applied atomically. Pure engine logic —
// throws EngineError on invalid input.
import {
  dealTypeP,
  PLAYER_LOAN_MAX_RATE,
  REGIONS,
  rpP,
  SALES_DEAL_BONUS_RATE,
  tileP,
  TRANSPORT_BUY_PRICE,
} from '@tuan-tanah/shared'
import type {
  GameState,
  LogParams,
  NegotiationDeal,
  Player,
  RupiahAmount,
  TileId,
} from '@tuan-tanah/shared'
import { getTileDef } from './board.js'
import { settleIfAble } from './elimination.js'
import { EngineError } from './index.js'
import { logKey, uid } from './util.js'

function findPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id)
}

function ownerOf(state: GameState, tileId: TileId): string | null {
  return state.tiles[tileId]?.ownerId ?? null
}

/** Bank buy price of a tile (used to value swaps for the Sales bonus). */
function tileBuyPrice(tileId: TileId): RupiahAmount {
  const def = getTileDef(tileId)
  if (def.type === 'transport') return TRANSPORT_BUY_PRICE
  if (def.type === 'property' && def.region) return REGIONS[def.region].buyPrice
  return 0
}

/** The cash value of a deal, used to size the Sales 15% bank bonus. */
function dealValue(deal: NegotiationDeal): RupiahAmount {
  switch (deal.type) {
    case 'cash_for_property':
    case 'sell_property':
    case 'rent_immunity':
      return deal.cashAmount ?? 0
    case 'property_swap': {
      // The requested tile's value plus any cash the proposer pays in (Sales bonus
      // tracks the value the initiator outlays).
      const base = deal.requestTileId != null ? tileBuyPrice(deal.requestTileId) : 0
      const cashIn = deal.cashFrom === 'proposer' ? (deal.cashAmount ?? 0) : 0
      return base + cashIn
    }
    case 'revenue_share':
    case 'player_loan':
    case 'cash_gift':
      return 0 // no Sales bonus: no upfront sale of value (loans/gifts aren't sales)
  }
}

/** A localizable validation failure: a message `code` plus its params. */
export interface DealError {
  code: string
  params?: LogParams
}

/** Returns a structured, localizable error if the deal is invalid, else null. */
export function validateDeal(state: GameState, deal: NegotiationDeal): DealError | null {
  const e = (code: string, params?: LogParams): DealError => ({ code, params })
  const from = findPlayer(state, deal.fromPlayerId)
  const to = findPlayer(state, deal.toPlayerId)
  if (!from) return e('negotiation.proposerNotInGame')
  if (!to) return e('negotiation.targetNotFound')
  if (from.id === to.id) return e('negotiation.dealWithSelf')
  if (from.isEliminated || to.isEliminated) return e('negotiation.bothMustBeActive')

  switch (deal.type) {
    case 'property_swap': {
      if (deal.offerTileId == null || deal.requestTileId == null)
        return e('negotiation.selectTileEachSide')
      if (deal.offerTileId === deal.requestTileId) return e('negotiation.pickTwoDifferent')
      if (ownerOf(state, deal.offerTileId) !== from.id) return e('negotiation.noLongerOwnOffered')
      if (ownerOf(state, deal.requestTileId) !== to.id)
        return e('negotiation.targetNoLongerOwnsRequested', { name: to.name })
      const cash = deal.cashAmount ?? 0
      if (cash < 0) return e('negotiation.cashTopupNegative')
      if (cash > 0) {
        if (deal.cashFrom !== 'proposer' && deal.cashFrom !== 'target')
          return e('negotiation.chooseTopupPayer')
        const payer = deal.cashFrom === 'proposer' ? from : to
        if (payer.cash < cash) return e('negotiation.payerCannotAffordTopup', { name: payer.name })
      }
      return null
    }
    case 'cash_for_property': {
      if (deal.requestTileId == null) return e('negotiation.selectTileToBuy')
      if ((deal.cashAmount ?? 0) <= 0) return e('negotiation.enterPrice')
      if (ownerOf(state, deal.requestTileId) !== to.id)
        return e('negotiation.targetNoLongerOwnsThat', { name: to.name })
      if (from.cash < (deal.cashAmount ?? 0)) return e('negotiation.cannotAffordOffer')
      return null
    }
    case 'sell_property': {
      // Proposer sells their own tile to the target for cash (the buyer pays).
      if (deal.offerTileId == null) return e('negotiation.selectTileToSell')
      if ((deal.cashAmount ?? 0) <= 0) return e('negotiation.enterPrice')
      if (ownerOf(state, deal.offerTileId) !== from.id) return e('negotiation.noLongerOwnOffered')
      if (to.cash < (deal.cashAmount ?? 0))
        return e('negotiation.namedCannotAffordOffer', { name: to.name })
      return null
    }
    case 'rent_immunity': {
      if (deal.immuneFor !== 'proposer' && deal.immuneFor !== 'target')
        return e('negotiation.chooseImmune')
      if ((deal.laps ?? 0) < 1) return e('negotiation.immunityMinLap')
      const cash = deal.cashAmount ?? 0
      if (cash < 0) return e('negotiation.immunityFeeNegative')
      // The immune player pays the owner (the non-immune party); fee may be 0 (free).
      const immune = deal.immuneFor === 'proposer' ? from : to
      if (immune.cash < cash) return e('negotiation.namedCannotAffordOffer', { name: immune.name })
      return null
    }
    case 'revenue_share': {
      const pct = deal.sharePercent ?? 0
      if (pct <= 0 || pct > 100) return e('negotiation.shareRange')
      if ((deal.laps ?? 0) < 1) return e('negotiation.shareMinLap')
      if (deal.shareFrom !== 'proposer' && deal.shareFrom !== 'target')
        return e('negotiation.chooseSharer')
      return null
    }
    case 'player_loan': {
      const principal = deal.cashAmount ?? 0
      if (principal < 1) return e('negotiation.enterLoanAmount')
      if (deal.cashFrom !== 'proposer' && deal.cashFrom !== 'target')
        return e('negotiation.chooseLender')
      const rate = deal.interestRate ?? 0
      if (rate < 0 || rate > PLAYER_LOAN_MAX_RATE)
        return e('negotiation.interestRange', { max: Math.round(PLAYER_LOAN_MAX_RATE * 100) })
      const lender = deal.cashFrom === 'proposer' ? from : to
      if (lender.cash < principal)
        return e('negotiation.lenderCannotAffordLend', { name: lender.name })
      return null
    }
    case 'cash_gift': {
      const amount = deal.cashAmount ?? 0
      if (amount < 1) return e('negotiation.enterAmount')
      if (deal.cashFrom !== 'proposer' && deal.cashFrom !== 'target')
        return e('negotiation.chooseGiver')
      const giver = deal.cashFrom === 'proposer' ? from : to
      if (giver.cash < amount) return e('negotiation.giverCannotAfford', { name: giver.name })
      return null
    }
    default:
      return e('negotiation.unknownDealType')
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
  if (error) throw new EngineError(error.code, error.params)

  state.pendingDeals.push(deal)
  const from = findPlayer(state, deal.fromPlayerId)!
  const to = findPlayer(state, deal.toPlayerId)!
  logKey(
    state,
    'negotiation.proposed',
    { name: from.name, deal: dealTypeP(deal.type), to: to.name },
    from.id,
  )
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
  if (idx === -1) throw new EngineError('negotiation.dealGone')
  const deal = state.pendingDeals[idx]!
  if (deal.toPlayerId !== playerId) throw new EngineError('negotiation.notTarget')

  const from = findPlayer(state, deal.fromPlayerId)
  const to = findPlayer(state, deal.toPlayerId)

  if (accept) {
    // Re-validate: the world may have moved since the offer was made.
    const error = validateDeal(state, deal)
    if (error) throw new EngineError(error.code, error.params)
    applyDeal(state, deal)
    if (from && to)
      logKey(
        state,
        'negotiation.accepted',
        { name: to.name, proposer: from.name, deal: dealTypeP(deal.type) },
        to.id,
      )
    // A deal that raised cash for a player in debt should clear it automatically,
    // so a broke seller can settle by selling to another player (not just the bank).
    settleIfAble(state, deal.fromPlayerId)
    settleIfAble(state, deal.toPlayerId)
  } else if (from && to) {
    logKey(
      state,
      'negotiation.rejected',
      { name: to.name, proposer: from.name, deal: dealTypeP(deal.type) },
      to.id,
    )
  }
  state.pendingDeals.splice(idx, 1)
}

/** Execute an accepted deal. Assumes the deal has just been validated. Mutates state. */
export function applyDeal(state: GameState, deal: NegotiationDeal): void {
  const from = findPlayer(state, deal.fromPlayerId)
  const to = findPlayer(state, deal.toPlayerId)
  if (!from || !to) throw new EngineError('negotiation.playerGone')

  switch (deal.type) {
    case 'property_swap': {
      const cash = deal.cashAmount ?? 0
      if (cash > 0) {
        const payer = deal.cashFrom === 'proposer' ? from : to
        const payee = payer.id === from.id ? to : from
        payer.cash -= cash
        payee.cash += cash
      }
      state.tiles[deal.offerTileId!]!.ownerId = to.id
      state.tiles[deal.requestTileId!]!.ownerId = from.id
      if (cash > 0) {
        logKey(
          state,
          'negotiation.swapWithCash',
          {
            name: from.name,
            other: to.name,
            tile1: tileP(deal.offerTileId!),
            tile2: tileP(deal.requestTileId!),
            amount: rpP(cash),
            payer: (deal.cashFrom === 'proposer' ? from : to).name,
          },
          from.id,
        )
      } else {
        logKey(
          state,
          'negotiation.swap',
          {
            name: from.name,
            other: to.name,
            tile1: tileP(deal.offerTileId!),
            tile2: tileP(deal.requestTileId!),
          },
          from.id,
        )
      }
      break
    }
    case 'cash_for_property': {
      const amount = deal.cashAmount ?? 0
      from.cash -= amount
      to.cash += amount
      state.tiles[deal.requestTileId!]!.ownerId = from.id
      logKey(
        state,
        'negotiation.bought',
        { name: from.name, tile: tileP(deal.requestTileId!), from: to.name, amount: rpP(amount) },
        from.id,
      )
      break
    }
    case 'sell_property': {
      // Proposer (seller) hands their tile to the target (buyer) for cash.
      const amount = deal.cashAmount ?? 0
      to.cash -= amount
      from.cash += amount
      state.tiles[deal.offerTileId!]!.ownerId = to.id
      logKey(
        state,
        'negotiation.sold',
        { name: from.name, tile: tileP(deal.offerTileId!), to: to.name, amount: rpP(amount) },
        from.id,
      )
      break
    }
    case 'rent_immunity': {
      const immune = deal.immuneFor === 'proposer' ? from : to
      const owner = immune.id === from.id ? to : from
      const amount = deal.cashAmount ?? 0
      if (amount > 0) {
        immune.cash -= amount
        owner.cash += amount
      }
      const laps = deal.laps ?? 1
      state.activeEffects.push({
        id: uid(),
        type: 'rent_immunity',
        targetPlayerId: immune.id, // the immune player pays no rent...
        ownerId: owner.id, // ...on any tile owned by this player.
        roundsRemaining: 0, // lap-based; skipped by tickEffects
        lapsRemaining: laps,
        lapAnchorPlayerId: immune.id, // decays on the immune player's own laps
        sourceCard: `deal_${deal.id}`,
      })
      if (amount > 0) {
        logKey(
          state,
          'negotiation.rentImmunityPaid',
          { name: immune.name, amount: rpP(amount), owner: owner.name, laps },
          immune.id,
        )
      } else {
        logKey(
          state,
          'negotiation.rentImmunityFree',
          { name: immune.name, owner: owner.name, laps },
          immune.id,
        )
      }
      break
    }
    case 'revenue_share': {
      const source = deal.shareFrom === 'proposer' ? from : to
      const beneficiary = source.id === from.id ? to : from
      const laps = deal.laps ?? 1
      state.activeEffects.push({
        id: uid(),
        type: 'revenue_share',
        targetPlayerId: source.id, // whose passive income is shared
        beneficiaryPlayerId: beneficiary.id,
        multiplier: (deal.sharePercent ?? 0) / 100,
        roundsRemaining: 0, // lap-based; skipped by tickEffects
        lapsRemaining: laps,
        lapAnchorPlayerId: source.id, // decays on the sharer's laps
        sourceCard: `deal_${deal.id}`,
      })
      logKey(
        state,
        'negotiation.revenueShare',
        {
          name: source.name,
          percent: deal.sharePercent ?? 0,
          beneficiary: beneficiary.name,
          laps,
        },
        source.id,
      )
      break
    }
    case 'player_loan': {
      const lender = deal.cashFrom === 'proposer' ? from : to
      const borrower = lender.id === from.id ? to : from
      const principal = deal.cashAmount ?? 0
      const rate = deal.interestRate ?? 0
      lender.cash -= principal
      borrower.cash += principal
      borrower.loans.push({
        id: uid(),
        amount: principal,
        interestPerLap: Math.round(principal * rate),
        lenderId: lender.id,
        roundBorrowed: state.round,
        interestPaid: 0,
        interestRate: rate,
      })
      logKey(
        state,
        'negotiation.playerLoan',
        {
          name: borrower.name,
          amount: rpP(principal),
          lender: lender.name,
          rate: Math.round(rate * 100),
        },
        borrower.id,
      )
      break
    }
    case 'cash_gift': {
      const giver = deal.cashFrom === 'proposer' ? from : to
      const receiver = giver.id === from.id ? to : from
      const amount = deal.cashAmount ?? 0
      giver.cash -= amount
      receiver.cash += amount
      logKey(
        state,
        'negotiation.cashGift',
        { name: giver.name, amount: rpP(amount), to: receiver.name },
        giver.id,
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
      logKey(state, 'negotiation.salesBonus', { name: from.name, amount: rpP(bonus) }, from.id)
    }
  }
}
