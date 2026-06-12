// Board helpers derived from the shared game data.
import { BOARD, REGIONS, type RegionId, type TileDef } from '@tuan-tanah/shared'
import type { GameState, TileId } from '@tuan-tanah/shared'

export function getTileDef(id: TileId): TileDef {
  const def = BOARD[id]
  if (!def) throw new Error(`No tile definition for id ${id}`)
  return def
}

export function regionOfTile(id: TileId): RegionId | null {
  return getTileDef(id).region ?? null
}

/** True if `playerId` owns every property tile in the given region. */
export function ownsFullRegion(state: GameState, playerId: string, region: RegionId): boolean {
  const ids = REGIONS[region].tileIds
  return ids.every((tid) => state.tiles[tid]?.ownerId === playerId)
}

/** How many transport tiles `playerId` owns. */
export function transportOwnedCount(state: GameState, playerId: string): number {
  return state.tiles.filter((t) => getTileDef(t.id).type === 'transport' && t.ownerId === playerId)
    .length
}
