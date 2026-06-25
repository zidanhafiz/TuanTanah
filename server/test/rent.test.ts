import {
  HOUSE_TIERS,
  PROPERTY_TIERS,
  REGIONS,
  REGION_SET_RENT_MULTIPLIER,
  TRANSPORT_RENT,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { computeRent, devTeleport } from '../src/engine/index.js'
import { addEffect, makeGame, own } from './helpers.js'

// Papua property tiles [1,2,3]; Bali [31,32]; transport tiles 5/14/28/33.
const PAPUA = REGIONS.papua
const BALI = REGIONS.bali

describe('computeRent — property track', () => {
  it('returns 0 for an unowned tile', () => {
    const { state } = makeGame(2)
    expect(computeRent(state, 1)).toBe(0)
  })

  it('charges the tier-1 property rate (half rentBase) for bare owned land at tier 0', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    expect(computeRent(state, 1)).toBe(Math.round(PAPUA.rentBase * PROPERTY_TIERS[0]!.rentMult))
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
    // Bare tiles rent at the tier-1 property rate; the set bonus applies on top.
    for (const id of BALI.tileIds) own(state, id, owner)
    const land = BALI.rentBase * PROPERTY_TIERS[0]!.rentMult
    expect(computeRent(state, 31)).toBe(Math.round(land * REGION_SET_RENT_MULTIPLIER))
  })

  it('does not apply the bonus when the set is incomplete', () => {
    const { state, players } = makeGame(2)
    own(state, 31, players[0]!.id) // owns only 1 of bali's 2 tiles
    expect(computeRent(state, 31)).toBe(Math.round(BALI.rentBase * PROPERTY_TIERS[0]!.rentMult))
  })
})

describe('computeRent — bare owned land', () => {
  it('rents tier-0 land at the tier-1 property rate (half rentBase) on a premium region', () => {
    const { state, players } = makeGame(2)
    own(state, 31, players[0]!.id) // Bali, bare land
    expect(computeRent(state, 31)).toBe(Math.round(BALI.rentBase * PROPERTY_TIERS[0]!.rentMult))
  })

  it('uses the same tier-1 property rate on a non-premium region', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id) // Papua, bare land
    expect(computeRent(state, 1)).toBe(Math.round(PAPUA.rentBase * PROPERTY_TIERS[0]!.rentMult))
  })

  it('switches to the building rate once a building is added', () => {
    const { state, players } = makeGame(2)
    own(state, 31, players[0]!.id, { track: 'house', tier: 1 })
    // Tier 1 house => full rentBase × tier mult, no land rate.
    expect(computeRent(state, 31)).toBe(BALI.rentBase * HOUSE_TIERS[0]!.rentMult)
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

describe('payRent — jailed owner', () => {
  it('charges no rent when the owner is in jail', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const [lander, owner] = players
    state.currentPlayerIndex = 0
    own(state, 1, owner!.id) // Papua property with rentBase rent
    owner!.inJail = true
    const landerCash = lander!.cash
    const ownerCash = owner!.cash
    devTeleport(state, lander!.id, 1) // land on the jailed owner's tile
    expect(lander!.cash).toBe(landerCash) // lander pays nothing
    expect(owner!.cash).toBe(ownerCash) // jailed owner collects nothing
  })

  it('charges rent normally once the owner is out of jail', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const [lander, owner] = players
    state.currentPlayerIndex = 0
    own(state, 1, owner!.id)
    const rent = computeRent(state, 1)
    const landerCash = lander!.cash
    const ownerCash = owner!.cash
    devTeleport(state, lander!.id, 1)
    expect(lander!.cash).toBe(landerCash - rent)
    expect(owner!.cash).toBe(ownerCash + rent)
  })
})

describe('computeRent — active effects', () => {
  it('multiplies property rent by a rent_multiplier effect', () => {
    const { state, players } = makeGame(2)
    own(state, 1, players[0]!.id)
    addEffect(state, { type: 'rent_multiplier', targetTileIds: [1], multiplier: 0.5 })
    expect(computeRent(state, 1)).toBe(
      Math.round(PAPUA.rentBase * PROPERTY_TIERS[0]!.rentMult * 0.5),
    )
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
