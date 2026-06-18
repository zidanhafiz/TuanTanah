import { DAPUR_PASSIVE, LAHAN_BUILD_COST, LAHAN_LAND_PRICE, WARKOP_RENT } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  buildLahan,
  buyTile,
  collectPassiveIncome,
  EngineError,
  rollDice,
} from '../src/engine/index.js'
import { addEffect, makeGame, own, seqRng } from './helpers.js'

// Tiles 9 and 29 are Lahan Kosong (buildable_land). seqRng([0.55, 0.7]) rolls 4 + 5 = 9.
const ROLL_NINE = () => seqRng([0.55, 0.7])

describe('Lahan Kosong (buildable_land)', () => {
  it('buys bare land at the flat land price', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const a = players[0]!
    const cash = a.cash
    buyTile(state, a, 9)
    expect(state.tiles[9]!.ownerId).toBe(a.id)
    expect(a.cash).toBe(cash - LAHAN_LAND_PRICE)
  })

  it('builds a business, locks it, and rejects a second build', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const a = players[0]!
    state.currentPlayerIndex = 0
    own(state, 9, a.id)
    const cash = a.cash
    buildLahan(state, a.id, 9, 'dapur_mbg')
    expect(state.tiles[9]!.landBuild).toBe('dapur_mbg')
    expect(a.cash).toBe(cash - LAHAN_BUILD_COST)
    expect(() => buildLahan(state, a.id, 9, 'warkop_cafe')).toThrow(EngineError)
  })

  it('rejects building on land you do not own or a non-land tile', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    state.currentPlayerIndex = 0
    own(state, 9, players[1]!.id)
    expect(() => buildLahan(state, players[0]!.id, 9, 'dapur_mbg')).toThrow(EngineError)
    own(state, 1, players[0]!.id)
    expect(() => buildLahan(state, players[0]!.id, 1, 'dapur_mbg')).toThrow(EngineError)
  })

  it('charges Warkop-Cafe landing rent to the owner', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const [a, b] = players
    state.currentPlayerIndex = 0
    a!.position = 0
    own(state, 9, b!.id, { landBuild: 'warkop_cafe' })
    const aCash = a!.cash
    const bCash = b!.cash
    rollDice(state, a!.id, ROLL_NINE())
    expect(a!.position).toBe(9)
    expect(a!.cash).toBe(aCash - WARKOP_RENT)
    expect(b!.cash).toBe(bCash + WARKOP_RENT)
  })

  it('Dapur MBG pays a flat passive income', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const a = players[0]!
    own(state, 9, a.id, { landBuild: 'dapur_mbg' })
    const gained = collectPassiveIncome(state, a)
    expect(gained).toBe(DAPUR_PASSIVE)
    expect(a.cash).toBe(DAPUR_PASSIVE)
  })

  it('Dapur MBG passive is immune to the Demo Buruh halving', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const a = players[0]!
    own(state, 9, a.id, { landBuild: 'dapur_mbg' })
    addEffect(state, { type: 'passive_halved', multiplier: 0.5, roundsRemaining: 2 })
    collectPassiveIncome(state, a)
    expect(a.cash).toBe(DAPUR_PASSIVE)
  })
})
