import {
  LAW_OFFICE_FREEPASS_PRICE,
  LAW_OFFICE_JAIL_FEE,
  LAW_OFFICE_TRANSFER_RATE,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  EngineError,
  computeRent,
  concedeAuction,
  lawOfficeBuy,
  lawOfficeFreepass,
  lawOfficeJail,
  lawOfficePriceUpgrade,
  lawOfficeSkip,
  sellProperty,
  startLawOfficeAuction,
  upgradeProperty,
} from '../src/engine/index.js'
import { tileValue } from '../src/engine/elimination.js'
import { collectPassiveIncome } from '../src/engine/turn.js'
import { makeGame, own } from './helpers.js'

/** A 2+ player game with the current player parked on the Kantor Hukum (tile 19). */
function atLawOffice(count = 2) {
  const g = makeGame(count, { cash: 1_000_000_000 })
  g.state.currentPlayerIndex = 0
  g.state.turn.pendingLawOffice = true
  return g
}

describe('Kantor Hukum (law_office)', () => {
  it('buys an unowned tile remotely and clears the pending state', () => {
    const { state, players } = atLawOffice()
    lawOfficeBuy(state, players[0]!.id, 1) // Papua / Sentani
    expect(state.tiles[1]!.ownerId).toBe(players[0]!.id)
    expect(state.turn.pendingLawOffice).toBe(false)
  })

  it('force-buys a rival property at 70% when the owner does not defend, keeping tier & track', () => {
    const { state, players } = atLawOffice()
    const [a, b] = players
    own(state, 1, b!.id, { track: 'property', tier: 2 })
    const price = Math.round(tileValue(state.tiles[1]!) * LAW_OFFICE_TRANSFER_RATE)
    const aCash = a!.cash
    const bCash = b!.cash
    startLawOfficeAuction(state, a!.id, 1)
    expect(state.turn.pendingLawOffice).toBe(false)
    concedeAuction(state, b!.id) // owner declines to defend → attacker wins at the 70% open
    expect(state.tiles[1]!.ownerId).toBe(a!.id)
    expect(state.tiles[1]!).toMatchObject({ track: 'property', tier: 2 })
    expect(a!.cash).toBe(aCash - price)
    expect(b!.cash).toBe(bCash + price)
    expect(state.pendingAuction).toBeNull()
  })

  it('rejects auctioning an unowned or own tile', () => {
    const { state, players } = atLawOffice()
    expect(() => startLawOfficeAuction(state, players[0]!.id, 1)).toThrow(EngineError)
    own(state, 2, players[0]!.id)
    expect(() => startLawOfficeAuction(state, players[0]!.id, 2)).toThrow(EngineError)
  })

  it('rejects opening an auction the actor cannot afford', () => {
    const { state, players } = makeGame(2, { cash: 100 })
    state.currentPlayerIndex = 0
    state.turn.pendingLawOffice = true
    own(state, 1, players[1]!.id)
    expect(() => startLawOfficeAuction(state, players[0]!.id, 1)).toThrow(EngineError)
  })

  it('jails a rival and charges the bribe to the bank', () => {
    const { state, players } = atLawOffice()
    const [a, b] = players
    const aCash = a!.cash
    const bankBefore = state.bank
    lawOfficeJail(state, a!.id, b!.id)
    expect(b!.inJail).toBe(true)
    expect(a!.cash).toBe(aCash - LAW_OFFICE_JAIL_FEE)
    expect(state.bank).toBe(bankBefore + LAW_OFFICE_JAIL_FEE)
    expect(state.turn.pendingLawOffice).toBe(false)
  })

  it('rejects jailing yourself', () => {
    const { state, players } = atLawOffice()
    expect(() => lawOfficeJail(state, players[0]!.id, players[0]!.id)).toThrow(EngineError)
  })

  it('buys a free-pass card into inventory', () => {
    const { state, players } = atLawOffice()
    const a = players[0]!
    const cash = a.cash
    lawOfficeFreepass(state, a.id, 'tax_free')
    expect(a.ownedCards).toHaveLength(1)
    expect(a.ownedCards[0]!.type).toBe('tax_free')
    expect(a.cash).toBe(cash - LAW_OFFICE_FREEPASS_PRICE)
    expect(state.turn.pendingLawOffice).toBe(false)
  })

  it('skips and clears the pending state', () => {
    const { state, players } = atLawOffice()
    lawOfficeSkip(state, players[0]!.id)
    expect(state.turn.pendingLawOffice).toBe(false)
  })

  it('rejects actions when the player is not at the Kantor Hukum', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    state.currentPlayerIndex = 0
    expect(() => lawOfficeSkip(state, players[0]!.id)).toThrow(EngineError)
    expect(() => lawOfficeBuy(state, players[0]!.id, 1)).toThrow(EngineError)
  })

  it('upgrades a tile price, charging value × multiplier and scaling rent & value', () => {
    const { state, players } = atLawOffice()
    const a = players[0]!
    own(state, 1, a.id, { track: 'property', tier: 2 })
    const value0 = tileValue(state.tiles[1]!)
    const rent0 = computeRent(state, 1)
    const cash0 = a.cash
    const bank0 = state.bank

    lawOfficePriceUpgrade(state, a.id, 1, 3)

    expect(state.tiles[1]!.priceMultiplier).toBe(3)
    expect(a.cash).toBe(cash0 - value0 * 3)
    expect(state.bank).toBe(bank0 + value0 * 3)
    expect(tileValue(state.tiles[1]!)).toBe(value0 * 3)
    expect(computeRent(state, 1)).toBe(rent0 * 3)
    expect(state.turn.pendingLawOffice).toBe(false)
  })

  it('scales property-track passive income by the multiplier', () => {
    const { state, players } = atLawOffice()
    const a = players[0]!
    own(state, 1, a.id, { track: 'property', tier: 2 })
    const passive0 = collectPassiveIncome(state, a)
    lawOfficePriceUpgrade(state, a.id, 1, 2)
    expect(collectPassiveIncome(state, a)).toBe(passive0 * 2)
  })

  it('stacks multiplicatively, basing each cost on the already-boosted value', () => {
    const { state, players } = atLawOffice()
    const a = players[0]!
    own(state, 1, a.id, { track: 'property', tier: 2 })
    const value0 = tileValue(state.tiles[1]!)
    const cash0 = a.cash

    lawOfficePriceUpgrade(state, a.id, 1, 2) // cost = value0 × 2
    state.turn.pendingLawOffice = true
    lawOfficePriceUpgrade(state, a.id, 1, 3) // cost = (value0 × 2) × 3

    expect(state.tiles[1]!.priceMultiplier).toBe(6)
    expect(a.cash).toBe(cash0 - value0 * 2 - value0 * 2 * 3)
  })

  it('rejects upgrading a tile you do not own', () => {
    const { state, players } = atLawOffice()
    own(state, 1, players[1]!.id, { track: 'property', tier: 1 })
    expect(() => lawOfficePriceUpgrade(state, players[0]!.id, 1, 3)).toThrow(EngineError)
  })

  it('rejects an out-of-range or non-integer multiplier', () => {
    const { state, players } = atLawOffice()
    own(state, 1, players[0]!.id, { track: 'property', tier: 1 })
    expect(() => lawOfficePriceUpgrade(state, players[0]!.id, 1, 1)).toThrow(EngineError)
    expect(() => lawOfficePriceUpgrade(state, players[0]!.id, 1, 6)).toThrow(EngineError)
    expect(() => lawOfficePriceUpgrade(state, players[0]!.id, 1, 2.5)).toThrow(EngineError)
  })

  it('rejects an upgrade the actor cannot afford', () => {
    const { state, players } = makeGame(2, { cash: 100 })
    state.currentPlayerIndex = 0
    state.turn.pendingLawOffice = true
    own(state, 1, players[0]!.id, { track: 'property', tier: 1 })
    expect(() => lawOfficePriceUpgrade(state, players[0]!.id, 1, 5)).toThrow(EngineError)
  })

  it('scales the level-up build cost by the price multiplier', () => {
    // Baseline: cost to build the next tier with no boost.
    const base = atLawOffice()
    own(base.state, 1, base.players[0]!.id, { track: 'property', tier: 1 })
    const cash0 = base.players[0]!.cash
    upgradeProperty(base.state, base.players[0]!.id, 1)
    const baseCost = cash0 - base.players[0]!.cash

    // Same build after a ×3 price boost costs 3× as much.
    const boosted = atLawOffice()
    own(boosted.state, 1, boosted.players[0]!.id, { track: 'property', tier: 1 })
    lawOfficePriceUpgrade(boosted.state, boosted.players[0]!.id, 1, 3)
    const cash1 = boosted.players[0]!.cash
    upgradeProperty(boosted.state, boosted.players[0]!.id, 1)
    expect(cash1 - boosted.players[0]!.cash).toBe(baseCost * 3)
  })

  it('resets the multiplier on sell but carries it through a force-transfer', () => {
    const { state, players } = atLawOffice()
    const [a, b] = players

    // Sell clears the boost.
    own(state, 1, a!.id, { track: 'property', tier: 1 })
    state.tiles[1]!.priceMultiplier = 4
    sellProperty(state, a!.id, 1)
    expect(state.tiles[1]!.priceMultiplier).toBe(1)

    // Force-transfer keeps the boost on the stolen tile.
    own(state, 2, b!.id, { track: 'property', tier: 1 })
    state.tiles[2]!.priceMultiplier = 2
    startLawOfficeAuction(state, a!.id, 2)
    concedeAuction(state, b!.id)
    expect(state.tiles[2]!.ownerId).toBe(a!.id)
    expect(state.tiles[2]!.priceMultiplier).toBe(2)
  })
})
