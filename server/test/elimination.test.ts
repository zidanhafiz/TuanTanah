import {
  INVESTOR_RENT_CUT_RATE,
  KONTRAKTOR_CUT_RATE,
  PROPERTY_TIERS,
  REGIONS,
  TRANSPORT_BUY_PRICE,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  charge,
  eliminate,
  forfeit,
  playerWealth,
  resolveDebt,
  settleIfAble,
  tileValue,
} from '../src/engine/elimination.js'
import { EngineError } from '../src/engine/index.js'
import { addDebt, makeGame, own } from './helpers.js'

describe('tileValue', () => {
  it('values an undeveloped property at its buy price', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    expect(tileValue(state.tiles[1]!)).toBe(REGIONS.papua.buyPrice)
  })

  it('values a transport tile at the transport buy price', () => {
    const { state, players } = makeGame(2)
    own(state, 5, players[0]!.id)
    expect(tileValue(state.tiles[5]!)).toBe(TRANSPORT_BUY_PRICE)
  })

  it('adds cumulative build costs for a developed property', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id, { track: 'property', tier: 2 })
    const base = REGIONS.papua.buyPrice
    const expected =
      base + base * PROPERTY_TIERS[0]!.buildCostMult + base * PROPERTY_TIERS[1]!.buildCostMult
    expect(tileValue(state.tiles[1]!)).toBe(expected)
  })
})

describe('playerWealth', () => {
  it('sums cash and owned tile value', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    expect(playerWealth(state, p)).toBe(5_000_000 + REGIONS.papua.buyPrice)
  })
})

describe('charge', () => {
  it('pays immediately when the player can afford it', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000 })
    const [payer, owner] = [players[0]!, players[1]!]
    owner.cash = 0
    charge(state, payer, 2_000_000, owner.id, 'rent', 'rent', 1)
    expect(payer.cash).toBe(3_000_000)
    expect(owner.cash).toBe(2_000_000)
    expect(state.pendingDebts).toHaveLength(0)
  })

  it('applies the investor cut on rent (from the bank)', () => {
    const { state, players } = makeGame(3, { cash: 5_000_000, roles: [null, null, 'investor'] })
    const [payer, owner, investor] = [players[0]!, players[1]!, players[2]!]
    investor.cash = 0
    const bankBefore = state.bank
    charge(state, payer, 2_000_000, owner.id, 'rent', 'rent', 1)
    const cut = Math.round(2_000_000 * INVESTOR_RENT_CUT_RATE)
    expect(investor.cash).toBe(cut)
    expect(state.bank).toBe(bankBefore - cut)
  })

  it('applies the builder cut on rent (from the owner)', () => {
    const { state, players } = makeGame(3, { cash: 5_000_000, roles: [null, null, 'kontraktor'] })
    const [payer, owner, builder] = [players[0]!, players[1]!, players[2]!]
    owner.cash = 0
    builder.cash = 0
    own(state, 1, owner.id, { track: 'property', tier: 1, builderId: builder.id })
    charge(state, payer, 1_000_000, owner.id, 'rent', 'rent', 1)
    const cut = Math.round(1_000_000 * KONTRAKTOR_CUT_RATE)
    expect(builder.cash).toBe(cut)
    expect(owner.cash).toBe(1_000_000 - cut)
  })

  it('opens a pending debt when unaffordable but the player owns property', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    charge(state, p, 2_000_000, null, 'tax', 'luxury tax')
    expect(state.pendingDebts).toHaveLength(1)
    expect(state.pendingDebts[0]!.amount).toBe(2_000_000)
    expect(p.cash).toBe(1_000_000) // untouched until settled
  })

  it('eliminates a player who cannot pay and owns nothing', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    state.currentPlayerIndex = 1
    const p = players[0]!
    charge(state, p, 2_000_000, null, 'tax', 'luxury tax')
    expect(p.isEliminated).toBe(true)
    expect(state.pendingDebts).toHaveLength(0)
  })
})

describe('eliminate', () => {
  it('reverts tiles + cash to the bank and wipes loans/debts', () => {
    const { state, players } = makeGame(2, { cash: 3_000_000 })
    state.currentPlayerIndex = 1
    const p = players[0]!
    own(state, 1, p.id, { track: 'property', tier: 2 })
    p.loans = [
      {
        id: 'l',
        amount: 2_000_000,
        interestPerLap: 0,
        lenderId: null,
        roundBorrowed: 1,
        interestPaid: 0,
      },
    ]
    addDebt(state, { debtorId: p.id, amount: 5_000_000 })
    const bankBefore = state.bank

    eliminate(state, p)

    expect(p.isEliminated).toBe(true)
    expect(p.cash).toBe(0)
    expect(p.loans).toHaveLength(0)
    expect(state.bank).toBe(bankBefore + 3_000_000)
    expect(state.tiles[1]!.ownerId).toBeNull()
    expect(state.tiles[1]!.tier).toBe(0)
    expect(state.pendingDebts).toHaveLength(0)
  })
})

describe('forfeit', () => {
  it('eliminates the leaver and frees their tiles', () => {
    const { state, players } = makeGame(3)
    const leaver = players[1]!
    own(state, 1, leaver.id)

    forfeit(state, leaver.id)

    expect(leaver.isEliminated).toBe(true)
    expect(state.tiles[1]!.ownerId).toBeNull()
  })

  it('advances the turn when the leaver was the current player', () => {
    const { state, players } = makeGame(3)
    state.currentPlayerIndex = 0

    forfeit(state, players[0]!.id)

    // Turn must move off the player who just left so the table doesn't stall.
    expect(state.currentPlayerIndex).not.toBe(0)
    expect(state.players[state.currentPlayerIndex]!.isEliminated).toBe(false)
  })

  it('leaves the turn put when a non-current player forfeits', () => {
    const { state, players } = makeGame(3)
    state.currentPlayerIndex = 0

    forfeit(state, players[2]!.id)

    expect(state.currentPlayerIndex).toBe(0)
  })

  it('is a no-op for an unknown or already-eliminated player', () => {
    const { state, players } = makeGame(2)
    players[0]!.isEliminated = true

    expect(() => forfeit(state, players[0]!.id)).not.toThrow()
    expect(() => forfeit(state, 'nobody')).not.toThrow()
  })
})

describe('settleIfAble', () => {
  it('settles a debt once the player can afford it', () => {
    const { state, players } = makeGame(2, { cash: 3_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    addDebt(state, { debtorId: p.id, amount: 2_000_000, creditorId: null, type: 'rent' })
    settleIfAble(state, p.id)
    expect(state.pendingDebts).toHaveLength(0)
    expect(p.cash).toBe(1_000_000)
  })

  it('eliminates the player if still short with nothing left to sell', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    state.currentPlayerIndex = 1
    const p = players[0]!
    addDebt(state, { debtorId: p.id, amount: 2_000_000 })
    settleIfAble(state, p.id)
    expect(p.isEliminated).toBe(true)
  })
})

describe('resolveDebt', () => {
  it('eliminates the player when they give up', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    state.currentPlayerIndex = 1
    const p = players[0]!
    own(state, 1, p.id)
    addDebt(state, { debtorId: p.id, amount: 2_000_000 })
    resolveDebt(state, p.id, true)
    expect(p.isEliminated).toBe(true)
  })

  it('pays off the debt when the player can afford it', () => {
    const { state, players } = makeGame(2, { cash: 3_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    addDebt(state, { debtorId: p.id, amount: 2_000_000 })
    resolveDebt(state, p.id, false)
    expect(state.pendingDebts).toHaveLength(0)
    expect(p.cash).toBe(1_000_000)
  })

  it('throws when still short but the player still owns sellable property', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    addDebt(state, { debtorId: p.id, amount: 2_000_000 })
    expect(() => resolveDebt(state, p.id, false)).toThrow(EngineError)
  })

  it('throws when there is no outstanding debt', () => {
    const { state, players } = makeGame(2)
    expect(() => resolveDebt(state, players[0]!.id, false)).toThrow(EngineError)
  })
})
