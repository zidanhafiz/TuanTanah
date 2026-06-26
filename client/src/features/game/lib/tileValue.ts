// Client-side mirror of the engine's tile-value math (server/src/engine/
// elimination.ts `tileValue` + board.ts `ownsFullRegion`). Used by the property
// and Kantor Hukum modals to preview sell refunds / force-transfer prices. The
// server stays authoritative — this is display-only.
import {
  BOARD,
  HOUSE_TIERS,
  LAHAN_LAND_PRICE,
  landTier,
  PROPERTY_TIERS,
  REGION_SET_VALUE_MULTIPLIER,
  REGIONS,
  TRANSPORT_BUY_PRICE,
  type RegionDef,
  type RegionId,
  type RupiahAmount,
  type TileState,
} from '@tuan-tanah/shared'

/**
 * True if `ownerId` owns every tile in `region`. Mirrors the engine's
 * ownsFullRegion. Accepts a region id or an already-resolved RegionDef so both
 * modal call styles share one implementation.
 */
export function ownsFullRegion(
  tiles: TileState[],
  region: RegionId | RegionDef | undefined,
  ownerId: string | null,
): boolean {
  if (!region || !ownerId) return false
  const def = typeof region === 'string' ? REGIONS[region] : region
  return def.tileIds.every((tid) => tiles[tid]?.ownerId === ownerId)
}

/**
 * Current market value of a tile: base buy price + cumulative build cost, scaled by
 * the Kantor Hukum price multiplier and doubled while the owner holds the full
 * region. Mirrors the engine's `tileValue`.
 */
export function tileValue(tile: TileState, tiles: TileState[]): RupiahAmount {
  const def = BOARD[tile.id]
  if (!def) return 0
  if (def.type === 'buildable_land') {
    let value = LAHAN_LAND_PRICE
    if (tile.landBuild) {
      for (let t = 1; t <= tile.tier; t++) value += landTier(tile.landBuild, t)?.buildCost ?? 0
    }
    return Math.round(value * tile.priceMultiplier)
  }
  const base =
    def.type === 'transport' ? TRANSPORT_BUY_PRICE : def.region ? REGIONS[def.region].buyPrice : 0
  if (base === 0) return 0
  let value = base
  if (tile.tier >= 1) {
    const tiers = tile.track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
    for (let t = 1; t <= tile.tier; t++) {
      const tierDef = tiers[t - 1]
      if (tierDef) value += base * tierDef.buildCostMult
    }
  }
  let market = Math.round(value * tile.priceMultiplier)
  if (tile.ownerId && def.region && ownsFullRegion(tiles, def.region, tile.ownerId)) {
    market *= REGION_SET_VALUE_MULTIPLIER
  }
  return market
}
