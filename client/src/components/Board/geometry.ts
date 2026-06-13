import type { TileId } from '@tuan-tanah/shared'

/** Which edge of the board a perimeter tile sits on (drives pip placement). */
export type Side = 'top' | 'bottom' | 'left' | 'right'

/**
 * The outer ring tracks are this much taller/wider than an inner track, so the
 * playable tiles get more depth while the board stays square. Shared by the CSS
 * grid template (Board.tsx) and the token geometry below so they stay in sync.
 */
export const EDGE_TRACK = 1.45
const INNER_TRACKS = 9
const TOTAL = INNER_TRACKS + 2 * EDGE_TRACK

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

/** Center (% of board) of a 1-based grid line index, honoring the wider edges. */
function axisCenter(i: number): number {
  let before: number
  let width: number
  if (i === 1) {
    before = 0
    width = EDGE_TRACK
  } else if (i === 11) {
    before = EDGE_TRACK + INNER_TRACKS
    width = EDGE_TRACK
  } else {
    before = EDGE_TRACK + (i - 2)
    width = 1
  }
  return ((before + width / 2) / TOTAL) * 100
}

/** Center of a tile as a percentage of the board (for absolutely-positioned tokens). */
export function tileCenter(id: TileId): { left: number; top: number } {
  const { row, col } = gridPos(id)
  return { left: axisCenter(col), top: axisCenter(row) }
}

/** The inner edge (toward board center) an owned tile's pips should sit on. */
export function innerSide(id: TileId): Side {
  const { row, col } = gridPos(id)
  if (row === 11) return 'top' // bottom row → pips above the tile
  if (row === 1) return 'bottom' // top row → pips below the tile
  if (col === 1) return 'right' // left column → pips to the right
  return 'left' // right column → pips to the left
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
