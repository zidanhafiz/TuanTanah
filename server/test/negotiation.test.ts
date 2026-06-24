import { SALES_DEAL_BONUS_RATE } from '@tuan-tanah/shared'
import type { NegotiationDeal } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { hasRentImmunity, tickEffects, tickLapEffects } from '../src/engine/effects.js'
import { applyDeal, proposeDeal, respondToDeal, validateDeal } from '../src/engine/negotiation.js'
import { chargeInterest } from '../src/engine/pinjol.js'
import { collectPassiveIncome } from '../src/engine/turn.js'
import { addDebt, addEffect, makeGame, own } from './helpers.js'

function deal(partial: Partial<NegotiationDeal> & Pick<NegotiationDeal, 'type'>): NegotiationDeal {
  return {
    id: 'placeholder',
    fromPlayerId: 'placeholder',
    toPlayerId: 'placeholder',
    status: 'pending',
    ...partial,
  }
}

describe('validateDeal — property_swap', () => {
  it('accepts a swap where each side owns its tile', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    own(state, 2, players[1]!.id)
    const d = deal({
      type: 'property_swap',
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
      offerTileId: 1,
      requestTileId: 2,
    })
    expect(validateDeal(state, d)).toBeNull()
  })

  it('rejects when the proposer no longer owns the offered tile', () => {
    const { state, players } = makeGame(2)
    own(state, 2, players[1]!.id)
    const d = deal({
      type: 'property_swap',
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
      offerTileId: 1,
      requestTileId: 2,
    })
    expect(validateDeal(state, d)).not.toBeNull()
  })
})

describe('sell_property', () => {
  it('validates a sale of the proposer’s own tile the buyer can afford', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    own(state, 1, players[0]!.id)
    const d = deal({
      type: 'sell_property',
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
      offerTileId: 1,
      cashAmount: 5_000_000,
    })
    expect(validateDeal(state, d)).toBeNull()
  })

  it('rejects when the buyer cannot afford the price', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    own(state, 1, players[0]!.id)
    const d = deal({
      type: 'sell_property',
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
      offerTileId: 1,
      cashAmount: 5_000_000,
    })
    expect(validateDeal(state, d)).not.toBeNull()
  })

  it('transfers the tile to the buyer and pays the seller', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [seller, buyer] = players
    own(state, 1, seller!.id)
    const sellerCash = seller!.cash
    const buyerCash = buyer!.cash
    applyDeal(
      state,
      deal({
        type: 'sell_property',
        fromPlayerId: seller!.id,
        toPlayerId: buyer!.id,
        offerTileId: 1,
        cashAmount: 4_000_000,
      }),
    )
    expect(state.tiles[1]!.ownerId).toBe(buyer!.id)
    expect(seller!.cash).toBe(sellerCash + 4_000_000)
    expect(buyer!.cash).toBe(buyerCash - 4_000_000)
  })

  it('lets a broke debtor settle their debt by selling to another player', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const [debtor, buyer] = players
    state.currentPlayerIndex = 0
    own(state, 1, debtor!.id) // debtor's only asset
    buyer!.cash = 10_000_000
    addDebt(state, { debtorId: debtor!.id, amount: 3_000_000, creditorId: null, type: 'tax' })
    proposeDeal(
      state,
      debtor!.id,
      deal({
        type: 'sell_property',
        toPlayerId: buyer!.id,
        offerTileId: 1,
        cashAmount: 5_000_000,
      }),
    )
    const dealId = state.pendingDeals[0]!.id
    respondToDeal(state, buyer!.id, dealId, true)
    // Sale raised 5jt; the 3jt debt auto-settles, leaving the debtor solvent.
    expect(state.pendingDebts).toHaveLength(0)
    expect(state.tiles[1]!.ownerId).toBe(buyer!.id)
    expect(debtor!.cash).toBe(2_000_000) // 5jt from sale − 3jt debt paid
    expect(debtor!.isEliminated).toBe(false)
  })
})

describe('proposeDeal / respondToDeal', () => {
  it('queues a validated deal stamped with the trusted proposer', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    own(state, 2, players[1]!.id)
    const stored = proposeDeal(
      state,
      players[0]!.id,
      deal({
        type: 'property_swap',
        fromPlayerId: 'spoofed',
        toPlayerId: players[1]!.id,
        offerTileId: 1,
        requestTileId: 2,
      }),
    )
    expect(stored.fromPlayerId).toBe(players[0]!.id)
    expect(stored.status).toBe('pending')
    expect(state.pendingDeals).toHaveLength(1)
  })

  it('applies the swap on accept and clears the pending deal', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    own(state, 2, players[1]!.id)
    const stored = proposeDeal(
      state,
      players[0]!.id,
      deal({
        type: 'property_swap',
        fromPlayerId: players[0]!.id,
        toPlayerId: players[1]!.id,
        offerTileId: 1,
        requestTileId: 2,
      }),
    )
    respondToDeal(state, players[1]!.id, stored.id, true)
    expect(state.tiles[1]!.ownerId).toBe(players[1]!.id)
    expect(state.tiles[2]!.ownerId).toBe(players[0]!.id)
    expect(state.pendingDeals).toHaveLength(0)
  })

  it('drops the deal on reject without applying it', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    own(state, 2, players[1]!.id)
    const stored = proposeDeal(
      state,
      players[0]!.id,
      deal({
        type: 'property_swap',
        fromPlayerId: players[0]!.id,
        toPlayerId: players[1]!.id,
        offerTileId: 1,
        requestTileId: 2,
      }),
    )
    respondToDeal(state, players[1]!.id, stored.id, false)
    expect(state.tiles[1]!.ownerId).toBe(players[0]!.id) // unchanged
    expect(state.pendingDeals).toHaveLength(0)
  })
})

describe('applyDeal', () => {
  it('cash_for_property transfers cash and the tile', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [buyer, seller] = [players[0]!, players[1]!]
    own(state, 2, seller.id)
    applyDeal(
      state,
      deal({
        type: 'cash_for_property',
        fromPlayerId: buyer.id,
        toPlayerId: seller.id,
        requestTileId: 2,
        cashAmount: 3_000_000,
      }),
    )
    expect(buyer.cash).toBe(7_000_000)
    expect(seller.cash).toBe(13_000_000)
    expect(state.tiles[2]!.ownerId).toBe(buyer.id)
  })

  it('rent_immunity (self) pays the owner and creates an owner-scoped lap immunity effect', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [immune, owner] = [players[0]!, players[1]!]
    own(state, 2, owner.id) // Timika (papua)
    applyDeal(
      state,
      deal({
        type: 'rent_immunity',
        fromPlayerId: immune.id,
        toPlayerId: owner.id,
        immuneFor: 'proposer',
        cashAmount: 1_000_000,
        laps: 3,
      }),
    )
    expect(immune.cash).toBe(9_000_000)
    expect(owner.cash).toBe(11_000_000)
    expect(state.activeEffects).toContainEqual(
      expect.objectContaining({
        type: 'rent_immunity',
        targetPlayerId: immune.id,
        ownerId: owner.id,
        lapsRemaining: 3,
        lapAnchorPlayerId: immune.id,
      }),
    )
  })

  it('rent_immunity (give) makes the target immune and the target pays the proposer', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [proposer, target] = [players[0]!, players[1]!]
    own(state, 2, proposer.id) // proposer owns the covered tile
    applyDeal(
      state,
      deal({
        type: 'rent_immunity',
        fromPlayerId: proposer.id,
        toPlayerId: target.id,
        immuneFor: 'target',
        cashAmount: 2_000_000,
        laps: 2,
      }),
    )
    // The immune player (target) pays the owner (proposer).
    expect(target.cash).toBe(8_000_000)
    expect(proposer.cash).toBe(12_000_000)
    expect(state.activeEffects).toContainEqual(
      expect.objectContaining({
        type: 'rent_immunity',
        targetPlayerId: target.id,
        ownerId: proposer.id,
        lapAnchorPlayerId: target.id,
      }),
    )
  })

  it('revenue_share creates a lap-based share effect from the chosen source', () => {
    const { state, players } = makeGame(2)
    const [from, to] = [players[0]!, players[1]!]
    applyDeal(
      state,
      deal({
        type: 'revenue_share',
        fromPlayerId: from.id,
        toPlayerId: to.id,
        sharePercent: 25,
        laps: 2,
        shareFrom: 'target',
      }),
    )
    expect(state.activeEffects).toContainEqual(
      expect.objectContaining({
        type: 'revenue_share',
        targetPlayerId: to.id, // shareFrom 'target'
        beneficiaryPlayerId: from.id,
        multiplier: 0.25,
        lapsRemaining: 2,
        lapAnchorPlayerId: to.id,
      }),
    )
  })

  it('property_swap moves cash per cashFrom and swaps ownership', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [a, b] = [players[0]!, players[1]!]
    own(state, 1, a.id)
    own(state, 2, b.id)
    applyDeal(
      state,
      deal({
        type: 'property_swap',
        fromPlayerId: a.id,
        toPlayerId: b.id,
        offerTileId: 1,
        requestTileId: 2,
        cashAmount: 3_000_000,
        cashFrom: 'proposer',
      }),
    )
    expect(a.cash).toBe(7_000_000)
    expect(b.cash).toBe(13_000_000)
    expect(state.tiles[1]!.ownerId).toBe(b.id)
    expect(state.tiles[2]!.ownerId).toBe(a.id)
  })

  it('player_loan moves the principal and records the loan with a custom rate', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [lender, borrower] = [players[0]!, players[1]!]
    applyDeal(
      state,
      deal({
        type: 'player_loan',
        fromPlayerId: lender.id,
        toPlayerId: borrower.id,
        cashAmount: 4_000_000,
        cashFrom: 'proposer',
        interestRate: 0.2,
      }),
    )
    expect(lender.cash).toBe(6_000_000)
    expect(borrower.cash).toBe(14_000_000)
    expect(borrower.loans).toHaveLength(1)
    expect(borrower.loans[0]).toMatchObject({
      amount: 4_000_000,
      lenderId: lender.id,
      interestRate: 0.2,
      interestPerLap: 800_000,
    })
  })

  it('cash_gift moves cash in the chosen direction', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [from, to] = [players[0]!, players[1]!]
    // Giver = target (a "minta uang" / ask-for-money deal).
    applyDeal(
      state,
      deal({
        type: 'cash_gift',
        fromPlayerId: from.id,
        toPlayerId: to.id,
        cashAmount: 2_000_000,
        cashFrom: 'target',
      }),
    )
    expect(from.cash).toBe(12_000_000)
    expect(to.cash).toBe(8_000_000)
  })

  it('awards the Sales bonus on a deal it initiates', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000, roles: ['sales'] })
    const [salesPlayer, seller] = [players[0]!, players[1]!]
    own(state, 2, seller.id)
    const bankBefore = state.bank
    applyDeal(
      state,
      deal({
        type: 'cash_for_property',
        fromPlayerId: salesPlayer.id,
        toPlayerId: seller.id,
        requestTileId: 2,
        cashAmount: 4_000_000,
      }),
    )
    const bonus = Math.round(4_000_000 * SALES_DEAL_BONUS_RATE)
    // Paid 4jt for the tile, then earned the bonus back from the bank.
    expect(salesPlayer.cash).toBe(10_000_000 - 4_000_000 + bonus)
    expect(state.bank).toBe(bankBefore - bonus)
  })
})

describe('validateDeal — new deal types', () => {
  it('rejects rent_immunity without a direction or laps', () => {
    const { state, players } = makeGame(2)
    const base = deal({
      type: 'rent_immunity',
      fromPlayerId: players[0]!.id,
      toPlayerId: players[1]!.id,
    })
    expect(validateDeal(state, { ...base, laps: 2 })).toMatch(/immune/i)
    expect(validateDeal(state, { ...base, immuneFor: 'proposer', laps: 0 })).toMatch(/lap/i)
    expect(validateDeal(state, { ...base, immuneFor: 'proposer', laps: 2 })).toBeNull()
  })

  it('rejects a player_loan the lender cannot afford and an out-of-range rate', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const [from, to] = [players[0]!, players[1]!]
    expect(
      validateDeal(
        state,
        deal({
          type: 'player_loan',
          fromPlayerId: from.id,
          toPlayerId: to.id,
          cashAmount: 5_000_000,
          cashFrom: 'proposer',
          interestRate: 0.1,
        }),
      ),
    ).toMatch(/afford/i)
    expect(
      validateDeal(
        state,
        deal({
          type: 'player_loan',
          fromPlayerId: from.id,
          toPlayerId: to.id,
          cashAmount: 500_000,
          cashFrom: 'proposer',
          interestRate: 0.9,
        }),
      ),
    ).toMatch(/interest/i)
  })

  it('rejects a cash_gift the giver cannot afford', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    expect(
      validateDeal(
        state,
        deal({
          type: 'cash_gift',
          fromPlayerId: players[0]!.id,
          toPlayerId: players[1]!.id,
          cashAmount: 5_000_000,
          cashFrom: 'proposer',
        }),
      ),
    ).toMatch(/afford/i)
  })
})

describe('hasRentImmunity — owner scoping', () => {
  it('covers all of the owner tiles, but not third-party tiles', () => {
    const { state, players } = makeGame(3)
    const [immune, owner, third] = [players[0]!, players[1]!, players[2]!]
    own(state, 2, owner.id) // Timika (papua)
    own(state, 3, third.id) // Jayapura — owned by a third party
    own(state, 6, owner.id) // Balikpapan (kalimantan) — different region, same owner
    addEffect(state, {
      type: 'rent_immunity',
      targetPlayerId: immune.id,
      ownerId: owner.id,
      roundsRemaining: 0,
      lapsRemaining: 2,
      lapAnchorPlayerId: immune.id,
    })
    expect(hasRentImmunity(state, immune.id, 2)).toBe(true) // owner tile
    expect(hasRentImmunity(state, immune.id, 6)).toBe(true) // owner tile, any region
    expect(hasRentImmunity(state, immune.id, 3)).toBe(false) // third-party owner
    expect(hasRentImmunity(state, owner.id, 2)).toBe(false) // not the immune player
  })

  it('still honours legacy single-tile immunity effects', () => {
    const { state, players } = makeGame(2)
    const immune = players[0]!
    addEffect(state, {
      type: 'rent_immunity',
      targetPlayerId: immune.id,
      targetTileIds: [2],
      roundsRemaining: 3,
    })
    expect(hasRentImmunity(state, immune.id, 2)).toBe(true)
    expect(hasRentImmunity(state, immune.id, 3)).toBe(false)
  })
})

describe('lap-based effect decay', () => {
  it('tickEffects leaves lap-based effects untouched; tickLapEffects decays the anchor', () => {
    const { state, players } = makeGame(2)
    const anchor = players[0]!
    addEffect(state, {
      type: 'rent_immunity',
      targetPlayerId: anchor.id,
      ownerId: players[1]!.id,
      roundsRemaining: 0,
      lapsRemaining: 2,
      lapAnchorPlayerId: anchor.id,
    })
    tickEffects(state) // round tick must not touch a lap-based effect
    expect(state.activeEffects[0]?.lapsRemaining).toBe(2)
    tickLapEffects(state, players[1]!.id) // wrong anchor — no change
    expect(state.activeEffects[0]?.lapsRemaining).toBe(2)
    tickLapEffects(state, anchor.id)
    expect(state.activeEffects[0]?.lapsRemaining).toBe(1)
    tickLapEffects(state, anchor.id)
    expect(state.activeEffects).toHaveLength(0) // expired
  })
})

describe('revenue_share stacking', () => {
  it('caps total payout at the income collected this lap', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const [source, beneficiary] = [players[0]!, players[1]!]
    own(state, 1, source.id, { track: 'property', tier: 1 })
    // Two stacked shares totalling 140% of income.
    for (const mult of [0.7, 0.7]) {
      addEffect(state, {
        type: 'revenue_share',
        targetPlayerId: source.id,
        beneficiaryPlayerId: beneficiary.id,
        multiplier: mult,
      })
    }
    const income = collectPassiveIncome(state, source)
    expect(income).toBeGreaterThan(0)
    // Source kept the income then paid out at most `income`; never goes negative.
    expect(source.cash).toBe(0)
    expect(beneficiary.cash).toBe(income)
  })
})

describe('player_loan interest', () => {
  it('charges the loan custom rate (not the pinjol default) to the player lender', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [lender, borrower] = [players[0]!, players[1]!]
    applyDeal(
      state,
      deal({
        type: 'player_loan',
        fromPlayerId: lender.id,
        toPlayerId: borrower.id,
        cashAmount: 4_000_000,
        cashFrom: 'proposer',
        interestRate: 0.2,
      }),
    )
    const lenderAfterLoan = lender.cash // 6_000_000
    const borrowerAfterLoan = borrower.cash // 14_000_000
    chargeInterest(state, borrower)
    const interest = Math.round(4_000_000 * 0.2) // 800k at the custom 20% rate
    expect(borrower.cash).toBe(borrowerAfterLoan - interest)
    expect(lender.cash).toBe(lenderAfterLoan + interest)
  })
})
