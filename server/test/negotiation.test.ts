import { SALES_DEAL_BONUS_RATE } from '@tuan-tanah/shared'
import type { NegotiationDeal } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { applyDeal, proposeDeal, respondToDeal, validateDeal } from '../src/engine/negotiation.js'
import { makeGame, own } from './helpers.js'

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

  it('rent_immunity pays cash and creates an immunity effect', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [payer, owner] = [players[0]!, players[1]!]
    own(state, 2, owner.id)
    applyDeal(
      state,
      deal({
        type: 'rent_immunity',
        fromPlayerId: payer.id,
        toPlayerId: owner.id,
        requestTileId: 2,
        cashAmount: 1_000_000,
        rounds: 3,
      }),
    )
    expect(payer.cash).toBe(9_000_000)
    expect(owner.cash).toBe(11_000_000)
    expect(state.activeEffects).toContainEqual(
      expect.objectContaining({
        type: 'rent_immunity',
        targetPlayerId: payer.id,
        targetTileIds: [2],
        roundsRemaining: 3,
      }),
    )
  })

  it('revenue_share creates a share effect from the chosen source', () => {
    const { state, players } = makeGame(2)
    const [from, to] = [players[0]!, players[1]!]
    applyDeal(
      state,
      deal({
        type: 'revenue_share',
        fromPlayerId: from.id,
        toPlayerId: to.id,
        sharePercent: 25,
        rounds: 2,
        shareFrom: 'target',
      }),
    )
    expect(state.activeEffects).toContainEqual(
      expect.objectContaining({
        type: 'revenue_share',
        targetPlayerId: to.id, // shareFrom 'target'
        beneficiaryPlayerId: from.id,
        multiplier: 0.25,
        roundsRemaining: 2,
      }),
    )
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
