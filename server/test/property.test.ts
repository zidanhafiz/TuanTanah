import { PROPERTY_TIERS, REGIONS, SELL_REFUND_RATE } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  buyTile,
  downgradeProperty,
  EngineError,
  sellProperty,
  upgradeProperty,
} from '../src/engine/index.js'
import { tileValue } from '../src/engine/elimination.js'
import { addDebt, makeGame, own } from './helpers.js'

const PAPUA = REGIONS.papua

describe('buyTile', () => {
  it('transfers cash to the bank and assigns ownership', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000 })
    const p = players[0]!
    const bankBefore = state.bank
    buyTile(state, p, 1)
    expect(p.cash).toBe(5_000_000 - PAPUA.buyPrice)
    expect(state.bank).toBe(bankBefore + PAPUA.buyPrice)
    expect(state.tiles[1]!.ownerId).toBe(p.id)
  })

  it('applies the Sales discount', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000, roles: ['sales'] })
    const p = players[0]!
    buyTile(state, p, 1)
    expect(p.cash).toBe(5_000_000 - Math.round(PAPUA.buyPrice * 0.75))
  })

  it('rejects an already-owned tile', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000 })
    own(state, 1, players[1]!.id)
    expect(() => buyTile(state, players[0]!, 1)).toThrow(EngineError)
  })

  it('rejects when the player cannot afford it', () => {
    const { state, players } = makeGame(2, { cash: 100_000 })
    expect(() => buyTile(state, players[0]!, 35)).toThrow(EngineError)
  })

  it('rejects a non-buyable tile', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000 })
    expect(() => buyTile(state, players[0]!, 0)).toThrow(EngineError) // GO
  })
})

describe('upgradeProperty', () => {
  it('builds the first tier and locks the chosen track', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id)
    upgradeProperty(state, p.id, 1, 'property')
    const cost = Math.round(PAPUA.buyPrice * PROPERTY_TIERS[0]!.buildCostMult)
    expect(p.cash).toBe(10_000_000 - cost)
    expect(state.tiles[1]!).toMatchObject({ track: 'property', tier: 1 })
  })

  it('builds as many tiers as cash allows in one turn (no per-turn cap)', () => {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id)
    upgradeProperty(state, p.id, 1, 'property')
    upgradeProperty(state, p.id, 1)
    upgradeProperty(state, p.id, 1)
    expect(state.tiles[1]!.tier).toBe(3)
  })

  it('charges a Pengusaha 20% less to build', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000, roles: ['pengusaha'] })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id)
    upgradeProperty(state, p.id, 1, 'property')
    const cost = Math.round(PAPUA.buyPrice * PROPERTY_TIERS[0]!.buildCostMult * 0.8)
    expect(p.cash).toBe(10_000_000 - cost)
  })

  it('rejects switching tracks once locked', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000, roles: ['pengusaha'] })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id, { track: 'property', tier: 1 })
    expect(() => upgradeProperty(state, p.id, 1, 'house')).toThrow(EngineError)
  })

  it('requires a track for the first build', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id)
    expect(() => upgradeProperty(state, p.id, 1)).toThrow(EngineError)
  })

  it('rejects building past the top tier', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id, { track: 'property', tier: PROPERTY_TIERS.length })
    expect(() => upgradeProperty(state, p.id, 1)).toThrow(EngineError)
  })
})

describe('sellProperty', () => {
  it('refunds a fraction of the tile value and clears ownership', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id)
    const refund = Math.round(tileValue(state, state.tiles[1]!) * SELL_REFUND_RATE)
    sellProperty(state, p.id, 1)
    expect(p.cash).toBe(refund)
    expect(state.tiles[1]!.ownerId).toBeNull()
  })
})

describe('requireFullRegionToBuild', () => {
  it('blocks building when the owner lacks the full region', () => {
    const { state, players } = makeGame(2, {
      cash: 1_000_000_000,
      settings: { requireFullRegionToBuild: true },
    })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, PAPUA.tileIds[0]!, p.id)
    expect(() => upgradeProperty(state, p.id, PAPUA.tileIds[0]!, 'property')).toThrow(EngineError)
  })

  it('allows building once the owner holds the whole region', () => {
    const { state, players } = makeGame(2, {
      cash: 1_000_000_000,
      settings: { requireFullRegionToBuild: true },
    })
    const p = players[0]!
    state.currentPlayerIndex = 0
    for (const tid of PAPUA.tileIds) own(state, tid, p.id)
    upgradeProperty(state, p.id, PAPUA.tileIds[0]!, 'property')
    expect(state.tiles[PAPUA.tileIds[0]!]!.tier).toBe(1)
  })
})

describe('downgradeProperty', () => {
  it('drops one tier and refunds that tier’s build cost fraction', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id, { track: 'property', tier: 2 })
    const refund = Math.round(PAPUA.buyPrice * PROPERTY_TIERS[1]!.buildCostMult * SELL_REFUND_RATE)
    downgradeProperty(state, p.id, 1)
    expect(p.cash).toBe(refund)
    expect(state.tiles[1]!).toMatchObject({ track: 'property', tier: 1 })
  })

  it('unlocks the track and keeps ownership when downgrading to tier 0', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id, { track: 'house', tier: 1 })
    downgradeProperty(state, p.id, 1)
    expect(state.tiles[1]!).toMatchObject({ ownerId: p.id, track: null, tier: 0 })
  })

  it('rejects downgrading an unbuilt tile', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id)
    expect(() => downgradeProperty(state, p.id, 1)).toThrow(EngineError)
  })

  it('rejects downgrading out of turn when not in debt', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    state.currentPlayerIndex = 1
    own(state, 1, p.id, { track: 'property', tier: 2 })
    expect(() => downgradeProperty(state, p.id, 1)).toThrow(EngineError)
  })

  it('lets an indebted player downgrade out of turn and settles the debt', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    state.currentPlayerIndex = 1 // not their turn
    own(state, 1, p.id, { track: 'property', tier: 2 })
    const refund = Math.round(PAPUA.buyPrice * PROPERTY_TIERS[1]!.buildCostMult * SELL_REFUND_RATE)
    addDebt(state, { debtorId: p.id, amount: 300_000, creditorId: null, type: 'rent' })
    downgradeProperty(state, p.id, 1)
    expect(state.pendingDebts).toHaveLength(0)
    expect(p.cash).toBe(refund - 300_000)
    expect(state.tiles[1]!).toMatchObject({ ownerId: p.id, track: 'property', tier: 1 })
  })
})
