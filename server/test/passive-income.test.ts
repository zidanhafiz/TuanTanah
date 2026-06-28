import { PROPERTY_TIERS, REGIONS, REGION_SET_PASSIVE_MULTIPLIER } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { collectPassiveIncome } from '../src/engine/turn.js'
import { addEffect, makeGame, own } from './helpers.js'

const PAPUA = REGIONS.papua

describe('collectPassiveIncome', () => {
  it('pays base × tier passiveMult for a property-track tile', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    own(state, 1, p.id, { track: 'property', tier: 3 })
    const expected = Math.round(PAPUA.passiveBase * PROPERTY_TIERS[2]!.passiveMult) // ×2.2
    expect(collectPassiveIncome(state, p)).toBe(expected)
    expect(p.cash).toBe(expected)
    expect(state.bank).toBe(1_000_000_000_000 - expected)
  })

  it('pays nothing for house-track tiles', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    own(state, 1, p.id, { track: 'house', tier: 4 })
    expect(collectPassiveIncome(state, p)).toBe(0)
    expect(p.cash).toBe(0)
  })

  it('pays nothing for an undeveloped (tier 0) property', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    own(state, 1, p.id, { track: 'property', tier: 0 })
    expect(collectPassiveIncome(state, p)).toBe(0)
  })

  it('applies the full-region passive multiplier', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    for (const id of PAPUA.tileIds) own(state, id, p.id, { track: 'property', tier: 1 })
    // 3 tiles × base × passiveMult(1) × region bonus.
    const expected =
      PAPUA.tileIds.length *
      PAPUA.passiveBase *
      PROPERTY_TIERS[0]!.passiveMult *
      REGION_SET_PASSIVE_MULTIPLIER
    expect(collectPassiveIncome(state, p)).toBe(expected)
  })

  it('halves passive income under a global passive_halved effect', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    own(state, 1, p.id, { track: 'property', tier: 1 })
    addEffect(state, { type: 'passive_halved', multiplier: 0.5 })
    expect(collectPassiveIncome(state, p)).toBe(PAPUA.passiveBase * 0.5)
  })

  it('boosts passive income under a per-player passive_multiplier effect', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    own(state, 1, p.id, { track: 'property', tier: 1 })
    addEffect(state, { type: 'passive_multiplier', targetPlayerId: p.id, multiplier: 3 })
    expect(collectPassiveIncome(state, p)).toBe(PAPUA.passiveBase * 3)
  })

  it('redirects a revenue_share cut to the beneficiary', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const earner = players[0]!
    const beneficiary = players[1]!
    own(state, 1, earner.id, { track: 'property', tier: 1 })
    addEffect(state, {
      type: 'revenue_share',
      targetPlayerId: earner.id,
      beneficiaryPlayerId: beneficiary.id,
      multiplier: 0.5,
    })
    const income = PAPUA.passiveBase // 100k
    collectPassiveIncome(state, earner)
    expect(earner.cash).toBe(income - income * 0.5)
    expect(beneficiary.cash).toBe(income * 0.5)
  })
})
