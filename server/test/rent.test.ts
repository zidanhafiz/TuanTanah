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

  it('charges the flat tier-1 rent price for property tiers 1–4', () => {
    const { state, players } = makeGame(2)
    // Tiers 2–4 all collapse to the tier-1 (Warung) rent price.
    for (const tier of [1, 2, 3, 4]) {
      own(state, 1, players[0]!.id, { track: 'property', tier })
      const expected = PAPUA.rentBase * PROPERTY_TIERS[0]!.rentMult // ×0.5
      expect(computeRent(state, 1)).toBe(expected)
    }
  })

  it('charges the tier-2 rent price at property max tier', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id, { track: 'property', tier: PROPERTY_TIERS.length })
    const expected = PAPUA.rentBase * PROPERTY_TIERS[1]!.rentMult // tier 5 => tier-2 price (×1)
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
    // Bare Bali tiles: the land-only discount applies before the set bonus.
    for (const id of BALI.tileIds) own(state, id, owner)
    const land = BALI.rentBase * (BALI.landRentMult ?? 1)
    expect(computeRent(state, 31)).toBe(land * REGION_SET_RENT_MULTIPLIER)
  })

  it('does not apply the bonus when the set is incomplete', () => {
    const { state, players } = makeGame(2)
    own(state, 31, players[0]!.id) // owns only 1 of bali's 2 tiles
    expect(computeRent(state, 31)).toBe(BALI.rentBase * (BALI.landRentMult ?? 1))
  })
})

describe('computeRent — bare-land discount (premium regions)', () => {
  it('discounts tier-0 rent by landRentMult on a premium region', () => {
    const { state, players } = makeGame(2)
    own(state, 31, players[0]!.id) // Bali, bare land
    expect(BALI.landRentMult).toBe(0.6)
    expect(computeRent(state, 31)).toBe(Math.round(BALI.rentBase * BALI.landRentMult!))
  })

  it('does not discount once a building is added', () => {
    const { state, players } = makeGame(2)
    own(state, 31, players[0]!.id, { track: 'house', tier: 1 })
    // Tier 1 house => full rentBase × tier mult, no land discount.
    expect(computeRent(state, 31)).toBe(BALI.rentBase * HOUSE_TIERS[0]!.rentMult)
  })

  it('leaves non-premium regions at full rentBase when bare', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id) // Papua, no landRentMult
    expect(PAPUA.landRentMult).toBeUndefined()
    expect(computeRent(state, 1)).toBe(PAPUA.rentBase)
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
