import {
  HOUSE_TIERS,
  PROPERTY_TIERS,
  REGIONS,
  REGION_SET_RENT_MULTIPLIER,
  TRANSPORT_RENT,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { computeRent } from '../src/engine/index.js'
import { addEffect, makeGame, own } from './helpers.js'

// Papua property tiles [1,2,3]; Bali [31,32]; transport tiles 5/14/28/33.
const PAPUA = REGIONS.papua
const BALI = REGIONS.bali

describe('computeRent — property track', () => {
  it('returns 0 for an unowned tile', () => {
    const { state } = makeGame(2)
    expect(computeRent(state, 1)).toBe(0)
  })

  it('charges the region rent base at tier 0', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    expect(computeRent(state, 1)).toBe(PAPUA.rentBase)
  })

  it('applies the property-track tier multiplier', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id, { track: 'property', tier: 3 })
    const expected = PAPUA.rentBase * PROPERTY_TIERS[2]!.rentMult // tier 3 => ×2
    expect(computeRent(state, 1)).toBe(expected)
  })

  it('applies the house-track tier multiplier', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id, { track: 'house', tier: 2 })
    const expected = PAPUA.rentBase * HOUSE_TIERS[1]!.rentMult // tier 2 => ×2.5
    expect(computeRent(state, 1)).toBe(expected)
  })
})

describe('computeRent — region full-set bonus', () => {
  it('doubles rent when the owner holds every tile in the region', () => {
    const { state, players } = makeGame(2)
    const owner = players[0]!.id
    for (const id of BALI.tileIds) own(state, id, owner)
    expect(computeRent(state, 31)).toBe(BALI.rentBase * REGION_SET_RENT_MULTIPLIER)
  })

  it('does not apply the bonus when the set is incomplete', () => {
    const { state, players } = makeGame(2)
    own(state, 31, players[0]!.id) // owns only 1 of bali's 2 tiles
    expect(computeRent(state, 31)).toBe(BALI.rentBase)
  })
})

describe('computeRent — transport ladder', () => {
  it('scales with the number of transport tiles the owner holds', () => {
    const { state, players } = makeGame(2)
    const owner = players[0]!.id
    own(state, 5, owner)
    expect(computeRent(state, 5)).toBe(TRANSPORT_RENT[1])

    own(state, 14, owner)
    expect(computeRent(state, 5)).toBe(TRANSPORT_RENT[2])

    own(state, 28, owner)
    expect(computeRent(state, 5)).toBe(TRANSPORT_RENT[3])

    own(state, 33, owner)
    expect(computeRent(state, 5)).toBe(TRANSPORT_RENT[4])
  })
})

describe('computeRent — active effects', () => {
  it('multiplies property rent by a rent_multiplier effect', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    addEffect(state, { type: 'rent_multiplier', targetTileIds: [1], multiplier: 0.5 })
    expect(computeRent(state, 1)).toBe(PAPUA.rentBase * 0.5)
  })

  it('multiplies transport rent by a transport_multiplier effect', () => {
    const { state, players } = makeGame(2)
    own(state, 5, players[0]!.id)
    addEffect(state, { type: 'transport_multiplier', targetTileIds: [5], multiplier: 2 })
    expect(computeRent(state, 5)).toBe(TRANSPORT_RENT[1]! * 2)
  })

  it('lowers rent via a tier_drop effect (effective tier)', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id, { track: 'house', tier: 2 })
    addEffect(state, { type: 'tier_drop', targetTileIds: [1], multiplier: 1 })
    // Effective tier 1 => HOUSE_TIERS[0].rentMult (×1).
    expect(computeRent(state, 1)).toBe(PAPUA.rentBase * HOUSE_TIERS[0]!.rentMult)
  })
})
