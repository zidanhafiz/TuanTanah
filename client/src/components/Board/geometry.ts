import type { TileId } from '@tuan-tanah/shared'

/**
 * Map a tile id (0–39) to an 11×11 grid cell, GO at bottom-right, going
 * counter-clockwise (left along the bottom) like a classic Monopoly board.
 */
export function gridPos(id: TileId): { row: number; col: number } {
  if (id === 0) return { row: 11, col: 11 }
  if (id < 10) return { row: 11, col: 11 - id }
  if (id === 10) return { row: 11, col: 1 }
  if (id < 20) return { row: 11 - (id - 10), col: 1 }
  if (id === 20) return { row: 1, col: 1 }
  if (id < 30) return { row: 1, col: 1 + (id - 20) }
  if (id === 30) return { row: 1, col: 11 }
  return { row: 1 + (id - 30), col: 11 }
}

/** Center of a tile as a percentage of the board (for absolutely-positioned tokens). */
export function tileCenter(id: TileId): { left: number; top: number } {
  const { row, col } = gridPos(id)
  return { left: ((col - 0.5) / 11) * 100, top: ((row - 0.5) / 11) * 100 }
}

/**
 * Small deterministic fan offset (in board %) so multiple tokens sharing a tile
 * don't fully overlap. Stable per seat index regardless of who else is co-located.
 */
export function tokenOffset(seatIndex: number, total: number): { dx: number; dy: number } {
  if (total <= 1) return { dx: 0, dy: 0 }
  const r = 1.7
  const ang = (seatIndex / total) * Math.PI * 2
  return { dx: Math.cos(ang) * r, dy: Math.sin(ang) * r }
}
