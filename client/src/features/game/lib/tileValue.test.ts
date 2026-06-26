import {
  BOARD,
  LAHAN_LAND_PRICE,
  PROPERTY_TIERS,
  REGION_SET_VALUE_MULTIPLIER,
  REGIONS,
  TRANSPORT_BUY_PRICE,
  type TileState,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { ownsFullRegion, tileValue } from './tileValue.js'

/** A board of unowned, unbuilt tiles — the createGameState default shape. */
function makeTiles(): TileState[] {
  return BOARD.map((t) => ({
    id: t.id,
    ownerId: null,
    track: null,
    tier: 0,
    builderId: null,
    landBuild: null,
    priceMultiplier: 1,
  }))
}

// Papua: tiles [1,2,3], buyPrice 1jt. Transport tile 5. Lahan Kosong tile 9. GO tile 0.
const PAPUA = REGIONS.papua
const papuaBuy = PAPUA.buyPrice

describe('tileValue', () => {
  it('values an unowned, unbuilt property at its region buy price', () => {
    const tiles = makeTiles()
    expect(tileValue(tiles[1]!, tiles)).toBe(papuaBuy)
  })

  it('scales by the Kantor Hukum price multiplier', () => {
    const tiles = makeTiles()
    tiles[1]!.priceMultiplier = 3
    expect(tileValue(tiles[1]!, tiles)).toBe(papuaBuy * 3)
  })

  it('doubles when the owner holds the full region', () => {
    const tiles = makeTiles()
    for (const id of PAPUA.tileIds) tiles[id]!.ownerId = 'p1'
    expect(tileValue(tiles[1]!, tiles)).toBe(papuaBuy * REGION_SET_VALUE_MULTIPLIER)
  })

  it('does not double when the region is only partly owned', () => {
    const tiles = makeTiles()
    tiles[1]!.ownerId = 'p1'
    tiles[2]!.ownerId = 'p1' // tile 3 still unowned -> not a full set
    expect(tileValue(tiles[1]!, tiles)).toBe(papuaBuy)
  })

  it('adds cumulative build cost for built tiers', () => {
    const tiles = makeTiles()
    tiles[1]!.ownerId = 'p1'
    tiles[1]!.track = 'property'
    tiles[1]!.tier = 2
    const expected =
      papuaBuy +
      papuaBuy * PROPERTY_TIERS[0]!.buildCostMult +
      papuaBuy * PROPERTY_TIERS[1]!.buildCostMult
    expect(tileValue(tiles[1]!, tiles)).toBe(Math.round(expected))
  })

  it('values transport tiles at the transport buy price', () => {
    const tiles = makeTiles()
    expect(tileValue(tiles[5]!, tiles)).toBe(TRANSPORT_BUY_PRICE)
  })

  it('values unbuilt buildable land at the land price', () => {
    const tiles = makeTiles()
    expect(tileValue(tiles[9]!, tiles)).toBe(LAHAN_LAND_PRICE)
  })

  it('returns 0 for non-buyable tiles (GO)', () => {
    const tiles = makeTiles()
    expect(tileValue(tiles[0]!, tiles)).toBe(0)
  })
})

describe('ownsFullRegion', () => {
  it('accepts a region id', () => {
    const tiles = makeTiles()
    for (const id of PAPUA.tileIds) tiles[id]!.ownerId = 'p1'
    expect(ownsFullRegion(tiles, 'papua', 'p1')).toBe(true)
  })

  it('accepts a resolved RegionDef', () => {
    const tiles = makeTiles()
    for (const id of PAPUA.tileIds) tiles[id]!.ownerId = 'p1'
    expect(ownsFullRegion(tiles, PAPUA, 'p1')).toBe(true)
  })

  it('is false for a partial set or a null owner', () => {
    const tiles = makeTiles()
    tiles[1]!.ownerId = 'p1'
    expect(ownsFullRegion(tiles, 'papua', 'p1')).toBe(false)
    expect(ownsFullRegion(tiles, 'papua', null)).toBe(false)
    expect(ownsFullRegion(tiles, undefined, 'p1')).toBe(false)
  })
})
