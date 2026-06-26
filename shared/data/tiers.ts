// Build tracks — the upgrade ladders for houses, properties, and buildable land.
import type { LandBusiness, RupiahAmount } from '../types/game.js'
import { jt } from './units.js'

// ---- House track (4 tiers) ----
export interface HouseTierDef {
  tier: number
  name: string
  buildCostMult: number // × region buyPrice
  rentMult: number // × region rentBase
}
export const HOUSE_TIERS: HouseTierDef[] = [
  { tier: 1, name: 'Rumah Kecil', buildCostMult: 0.5, rentMult: 1 },
  { tier: 2, name: 'Rumah Sedang', buildCostMult: 1, rentMult: 2.5 },
  { tier: 3, name: 'Rumah Besar', buildCostMult: 2, rentMult: 5 },
  { tier: 4, name: 'Villa / Hotel', buildCostMult: 4, rentMult: 10 },
]

// ---- Property track (5 tiers) ----
export interface PropertyTierDef {
  tier: number
  name: string
  buildCostMult: number // × region buyPrice
  rentMult: number // × region rentBase
  passiveMult: number // × region passiveBase
}
export const PROPERTY_TIERS: PropertyTierDef[] = [
  { tier: 1, name: 'Warung', buildCostMult: 0.3, rentMult: 0.5, passiveMult: 1 },
  { tier: 2, name: 'Toko', buildCostMult: 0.7, rentMult: 1, passiveMult: 2 },
  { tier: 3, name: 'Minimarket', buildCostMult: 1.5, rentMult: 2, passiveMult: 4 },
  { tier: 4, name: 'Mall', buildCostMult: 3, rentMult: 4, passiveMult: 7 },
  { tier: 5, name: 'Konglomerat', buildCostMult: 6, rentMult: 7, passiveMult: 12 },
]

// ---- Special tiles (board re-layout, TTG-29) ----
// Lahan Kosong (buildable_land): buy bare land, then build & upgrade a business
// through 4 tiers. Each business earns both landing rent and per-lap passive,
// like a property — but the two stay mechanically distinct (Dapur leans passive,
// Warkop leans rent).
export const LAHAN_LAND_PRICE: RupiahAmount = jt(1.5)

export interface LandTierDef {
  tier: number
  name: string
  buildCost: RupiahAmount // flat cost to upgrade INTO this tier
  rent: RupiahAmount // landing rent charged to others at this tier
  passive: RupiahAmount // per-lap passive income at this tier
}

// Starting balance — all tunable here. Rent ≈ 30% of cumulative investment
// (land 1.5jt + builds): tier totals 3.5 / 6.5 / 11.5 / 19.5jt.
export const LAND_BUSINESS_TIERS: Record<LandBusiness, LandTierDef[]> = {
  dapur_mbg: [
    // passive-leaning
    { tier: 1, name: 'Dapur Rumahan', buildCost: jt(2), rent: jt(1), passive: jt(1.5) },
    { tier: 2, name: 'Katering MBG', buildCost: jt(3), rent: jt(1.5), passive: jt(2.5) },
    { tier: 3, name: 'Dapur Sentral', buildCost: jt(5), rent: jt(2.5), passive: jt(4) },
    { tier: 4, name: 'Dapur MBG Nasional', buildCost: jt(8), rent: jt(4), passive: jt(6) },
  ],
  warkop_cafe: [
    // rent-leaning
    { tier: 1, name: 'Warkop', buildCost: jt(2), rent: jt(1.5), passive: jt(0.8) },
    { tier: 2, name: 'Kopi Kekinian', buildCost: jt(3), rent: jt(3), passive: jt(1.2) },
    { tier: 3, name: 'Cafe', buildCost: jt(5), rent: jt(5), passive: jt(2) },
    { tier: 4, name: 'Coffee Chain', buildCost: jt(8), rent: jt(8), passive: jt(3.5) },
  ],
}

export const LAND_MAX_TIER = 4

/** Tier def for a built land tile, or null if not built / out of range. */
export const landTier = (business: LandBusiness, tier: number): LandTierDef | null =>
  tier >= 1 && tier <= LAND_MAX_TIER ? (LAND_BUSINESS_TIERS[business][tier - 1] ?? null) : null
