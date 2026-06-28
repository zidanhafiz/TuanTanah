// Regions — the nine themed property groups of the classic board.
import type { RupiahAmount, TileId } from '../types/game.js'
import { jt, rb } from './units.js'

export type RegionId =
  | 'papua'
  | 'kalimantan'
  | 'medan'
  | 'yogyakarta'
  | 'lombok'
  | 'surabaya'
  | 'bali'
  | 'jakarta'
  | 'tangerang'

export interface RegionDef {
  id: RegionId
  name: string
  color: string // tailwind-ish hex for board rendering
  buyPrice: RupiahAmount
  rentBase: RupiahAmount // "House Rent Base"
  passiveBase: RupiahAmount // "Property Passive Base"
  tileIds: TileId[]
}

export const REGIONS: Record<RegionId, RegionDef> = {
  papua: {
    id: 'papua',
    name: 'Papua',
    color: '#8B5A2B', // brown
    buyPrice: jt(1),
    rentBase: rb(600),
    passiveBase: rb(400),
    tileIds: [1, 2, 3],
  },
  kalimantan: {
    id: 'kalimantan',
    name: 'Kalimantan',
    color: '#14532D', // dark green
    buyPrice: jt(1.5),
    rentBase: rb(700),
    passiveBase: rb(500),
    tileIds: [6, 7, 8],
  },
  medan: {
    id: 'medan',
    name: 'Medan',
    color: '#CA8A04', // yellow
    buyPrice: jt(2),
    rentBase: rb(800),
    passiveBase: rb(600),
    tileIds: [11, 12, 13],
  },
  yogyakarta: {
    id: 'yogyakarta',
    name: 'Yogyakarta',
    color: '#7DD3FC', // light blue
    buyPrice: jt(2.5),
    rentBase: rb(850),
    passiveBase: rb(700),
    tileIds: [15, 17, 18],
  },
  lombok: {
    id: 'lombok',
    name: 'Lombok',
    color: '#F472B6', // pink
    buyPrice: jt(3),
    rentBase: rb(950),
    passiveBase: rb(800),
    tileIds: [21, 22, 23],
  },
  surabaya: {
    id: 'surabaya',
    name: 'Surabaya',
    color: '#DC2626', // red
    buyPrice: jt(3.5),
    rentBase: jt(1),
    passiveBase: rb(900),
    tileIds: [25, 26, 27],
  },
  bali: {
    id: 'bali',
    name: 'Bali',
    color: '#EA580C', // orange
    buyPrice: jt(4),
    rentBase: jt(1.1),
    passiveBase: rb(950),
    tileIds: [31, 32],
  },
  jakarta: {
    id: 'jakarta',
    name: 'Jakarta',
    color: '#374151', // dark grey
    buyPrice: jt(5),
    rentBase: jt(1.3),
    passiveBase: jt(1.05),
    tileIds: [35, 36],
  },
  tangerang: {
    id: 'tangerang',
    name: 'Tangerang',
    color: '#581C87', // deep purple — new top tier (premium townships)
    buyPrice: jt(6),
    rentBase: jt(1.45),
    passiveBase: jt(1.15),
    tileIds: [38, 39],
  },
}

// Full-set bonus when one player owns every tile in a region.
// Rent doubles (the weapon is rewarded); passive and market value do NOT — passive
// is a survival floor, not a snowball, and not inflating value keeps the wealth-win
// and pinjol leverage in check (Balance Pass v2, rent-dominant rebalance).
export const REGION_SET_RENT_MULTIPLIER = 2
export const REGION_SET_PASSIVE_MULTIPLIER = 1
export const REGION_SET_VALUE_MULTIPLIER = 1
