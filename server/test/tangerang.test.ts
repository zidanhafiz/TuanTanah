import { REGION_SET_RENT_MULTIPLIER, REGIONS } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { buyTile, computeRent } from '../src/engine/index.js'
import { makeGame, own } from './helpers.js'

const TANGERANG = REGIONS.tangerang // new top-tier region at tiles 38 & 39

describe('Tangerang region', () => {
  it('buys at the region price', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const p = players[0]!
    const cash = p.cash
    buyTile(state, p, 38)
    expect(state.tiles[38]!.ownerId).toBe(p.id)
    expect(p.cash).toBe(cash - TANGERANG.buyPrice)
  })

  it('charges land rent and doubles it on a full set', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const owner = players[1]!
    // Bare premium land is discounted by landRentMult before the set bonus.
    const land = TANGERANG.rentBase * (TANGERANG.landRentMult ?? 1)
    own(state, 38, owner.id)
    expect(computeRent(state, 38)).toBe(Math.round(land))
    own(state, 39, owner.id)
    expect(computeRent(state, 38)).toBe(Math.round(land * REGION_SET_RENT_MULTIPLIER))
  })
})
