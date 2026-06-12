// Bankruptcy + win-condition checks — STUB for a later milestone.
import { REGIONS } from '@tuan-tanah/shared'
import type { GameState, Player, RupiahAmount } from '@tuan-tanah/shared'
import { getTileDef } from './board.js'

/** Total wealth = cash + value of all owned property at current tier. */
export function playerWealth(state: GameState, player: Player): RupiahAmount {
  let wealth = player.cash
  for (const tile of state.tiles) {
    if (tile.ownerId !== player.id) continue
    const region = getTileDef(tile.id).region
    if (region) {
      // Approximate value as the region buy price (tier valuation is TODO).
      wealth += REGIONS[region].buyPrice
    }
  }
  return wealth
}

export function checkWinCondition(_state: GameState): string | null {
  // TODO: time limit + target wealth resolution.
  return null
}

export function checkElimination(_state: GameState, _player: Player): boolean {
  // TODO: bankrupt → pinjol → sell → eliminate.
  return false
}
