import { LAHAN_LAND_PRICE, LAND_BUSINESS_TIERS, landTier } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  buildLahan,
  buyTile,
  collectPassiveIncome,
  computeRent,
  downgradeProperty,
  EngineError,
  rollDice,
} from '../src/engine/index.js'
import { addEffect, makeGame, own, seqRng } from './helpers.js'

// Tiles 9 and 29 are Lahan Kosong (buildable_land). seqRng([0.55, 0.7]) rolls 4 + 5 = 9.
const ROLL_NINE = () => seqRng([0.55, 0.7])

const dapur = (tier: number) => landTier('dapur_mbg', tier)!
const warkop = (tier: number) => landTier('warkop_cafe', tier)!

describe('Lahan Kosong (buildable_land)', () => {
  it('buys bare land at the flat land price', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const a = players[0]!
    const cash = a.cash
    buyTile(state, a, 9)
    expect(state.tiles[9]!.ownerId).toBe(a.id)
    expect(state.tiles[9]!.tier).toBe(0)
    expect(a.cash).toBe(cash - LAHAN_LAND_PRICE)
  })

  it('builds tier 1, locks the business, and rejects the other business', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const a = players[0]!
    state.currentPlayerIndex = 0
    own(state, 9, a.id)
    const cash = a.cash
    buildLahan(state, a.id, 9, 'dapur_mbg')
    expect(state.tiles[9]!.landBuild).toBe('dapur_mbg')
    expect(state.tiles[9]!.tier).toBe(1)
    expect(a.cash).toBe(cash - dapur(1).buildCost)
    expect(() => buildLahan(state, a.id, 9, 'warkop_cafe')).toThrow(EngineError)
  })

  it('upgrades through all 4 tiers in one turn (no per-turn cap) then rejects past the top', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const a = players[0]!
    state.currentPlayerIndex = 0
    own(state, 9, a.id)
    let spent = 0
    for (let tier = 1; tier <= 4; tier++) {
      buildLahan(state, a.id, 9, 'dapur_mbg')
      spent += dapur(tier).buildCost
      expect(state.tiles[9]!.tier).toBe(tier)
    }
    expect(a.cash).toBe(1_000_000_000 - spent)
    expect(() => buildLahan(state, a.id, 9, 'dapur_mbg')).toThrow(EngineError)
  })

  it('rejects building on land you do not own or a non-land tile', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    state.currentPlayerIndex = 0
    own(state, 9, players[1]!.id)
    expect(() => buildLahan(state, players[0]!.id, 9, 'dapur_mbg')).toThrow(EngineError)
    own(state, 1, players[0]!.id)
    expect(() => buildLahan(state, players[0]!.id, 1, 'dapur_mbg')).toThrow(EngineError)
  })

  it('computeRent returns the per-tier landing rent for both businesses', () => {
    const { state, players } = makeGame(2)
    own(state, 9, players[0]!.id, { landBuild: 'warkop_cafe', tier: 3 })
    own(state, 29, players[0]!.id, { landBuild: 'dapur_mbg', tier: 2 })
    expect(computeRent(state, 9)).toBe(warkop(3).rent)
    expect(computeRent(state, 29)).toBe(dapur(2).rent)
  })

  it('charges per-tier landing rent to the owner', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const [a, b] = players
    state.currentPlayerIndex = 0
    a!.position = 0
    own(state, 9, b!.id, { landBuild: 'warkop_cafe', tier: 2 })
    const rent = warkop(2).rent
    const aCash = a!.cash
    const bCash = b!.cash
    rollDice(state, a!.id, ROLL_NINE())
    expect(a!.position).toBe(9)
    expect(a!.cash).toBe(aCash - rent)
    expect(b!.cash).toBe(bCash + rent)
  })

  it('pays tiered passive income for both businesses', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const a = players[0]!
    own(state, 9, a.id, { landBuild: 'dapur_mbg', tier: 4 })
    own(state, 29, a.id, { landBuild: 'warkop_cafe', tier: 1 })
    const expected = dapur(4).passive + warkop(1).passive
    const gained = collectPassiveIncome(state, a)
    expect(gained).toBe(expected)
    expect(a.cash).toBe(expected)
  })

  it('land passive is subject to the Demo Buruh halving (like property)', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const a = players[0]!
    own(state, 9, a.id, { landBuild: 'dapur_mbg', tier: 2 })
    addEffect(state, { type: 'passive_halved', multiplier: 0.5, roundsRemaining: 2 })
    collectPassiveIncome(state, a)
    expect(a.cash).toBe(Math.round(dapur(2).passive * 0.5))
  })

  it('charges land price plus cumulative build cost across buy + upgrades', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const a = players[0]!
    state.currentPlayerIndex = 0
    a.position = 9
    buyTile(state, a, 9)
    buildLahan(state, a.id, 9, 'warkop_cafe')
    buildLahan(state, a.id, 9, 'warkop_cafe')
    // tier 2: land + warkop tier1 + tier2 build costs.
    const invested = LAHAN_LAND_PRICE + warkop(1).buildCost + warkop(2).buildCost
    expect(a.cash).toBe(1_000_000_000 - invested)
    expect(invested).toBe(
      LAHAN_LAND_PRICE + LAND_BUSINESS_TIERS.warkop_cafe[0]!.buildCost + warkop(2).buildCost,
    )
  })

  it('downgrades a land tier, refunding part of its build cost and clearing the business at tier 0', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const a = players[0]!
    state.currentPlayerIndex = 0
    own(state, 9, a.id, { landBuild: 'dapur_mbg', tier: 1 })
    const cash = a.cash
    downgradeProperty(state, a.id, 9)
    expect(state.tiles[9]!.tier).toBe(0)
    expect(state.tiles[9]!.landBuild).toBeNull()
    expect(a.cash).toBe(cash + Math.round(dapur(1).buildCost * 0.5))
  })
})
