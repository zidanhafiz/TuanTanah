// Bankruptcy + win-condition checks.
import { HOUSE_TIERS, PROPERTY_TIERS, REGIONS, TRANSPORT_BUY_PRICE } from '@tuan-tanah/shared'
import type { FinalStanding, GameState, Player, RupiahAmount, TileState } from '@tuan-tanah/shared'
import { getTileDef } from './board.js'
import { rupiah } from './index.js'
import { pushLog } from './util.js'

/** Market value of a single owned tile at its current tier. */
export function tileValue(tile: TileState): RupiahAmount {
  const def = getTileDef(tile.id)
  const base =
    def.type === 'transport' ? TRANSPORT_BUY_PRICE : def.region ? REGIONS[def.region].buyPrice : 0
  if (base === 0) return 0
  // Add the cumulative build cost invested up to the current tier.
  let value = base
  if (tile.tier >= 1) {
    const tiers = tile.track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
    for (let t = 1; t <= tile.tier; t++) {
      const tierDef = tiers[t - 1]
      if (tierDef) value += base * tierDef.buildCostMult
    }
  }
  return value
}

/** Total wealth = cash + value of all owned property at current tier. */
export function playerWealth(state: GameState, player: Player): RupiahAmount {
  let wealth = player.cash
  for (const tile of state.tiles) {
    if (tile.ownerId !== player.id) continue
    wealth += tileValue(tile)
  }
  return Math.round(wealth)
}

export type WinReason = 'time' | 'wealth' | 'last_standing'
export interface WinResult {
  winnerId: string
  reason: WinReason
}

/** Active (non-eliminated) player with the most wealth, or null if none. */
function richestActive(state: GameState): Player | null {
  let best: Player | null = null
  let bestWealth = -Infinity
  for (const p of state.players) {
    if (p.isEliminated) continue
    const w = playerWealth(state, p)
    if (w > bestWealth) {
      best = p
      bestWealth = w
    }
  }
  return best
}

/**
 * Resolve whether the game has been won. `now` is injected (epoch ms) so the
 * engine stays I/O-free. Returns the winner + reason, or null if play continues.
 */
export function checkWinCondition(state: GameState, now: number): WinResult | null {
  const active = state.players.filter((p) => !p.isEliminated)

  // Last player standing (links to elimination, TTG-4).
  if (active.length <= 1) {
    const winner = active[0]
    if (winner) return { winnerId: winner.id, reason: 'last_standing' }
    return null
  }

  const { winCondition, targetWealth, timeLimitMinutes } = state.settings

  // Target wealth: first to reach it wins (richest if several cross at once).
  if ((winCondition === 'wealth' || winCondition === 'both') && targetWealth) {
    const richest = richestActive(state)
    if (richest && playerWealth(state, richest) >= targetWealth) {
      return { winnerId: richest.id, reason: 'wealth' }
    }
  }

  // Time limit: when the clock runs out, the richest active player wins.
  if ((winCondition === 'time' || winCondition === 'both') && timeLimitMinutes && state.startedAt) {
    if (now - state.startedAt >= timeLimitMinutes * 60_000) {
      const richest = richestActive(state)
      if (richest) return { winnerId: richest.id, reason: 'time' }
    }
  }

  return null
}

/** Transition the game to `ended` and crown the winner. No-op if already ended. */
export function endGame(state: GameState, winnerId: string, reason: WinReason): void {
  if (state.phase === 'ended') return
  state.phase = 'ended'
  state.winner = winnerId
  const winner = state.players.find((p) => p.id === winnerId)
  const name = winner?.name ?? 'Someone'
  const why =
    reason === 'time'
      ? 'time ran out'
      : reason === 'wealth'
        ? 'reached the target wealth'
        : 'is the last player standing'
  pushLog(state, `🏆 ${name} wins — ${why}!`, winnerId)
}

/** Check + apply game-over in one step. Returns true if the game just ended. */
export function resolveGameOver(state: GameState, now: number): boolean {
  if (state.phase !== 'playing') return false
  const result = checkWinCondition(state, now)
  if (!result) return false
  endGame(state, result.winnerId, result.reason)
  return true
}

/** Final standings, richest first, for the `game_over` event. */
export function finalStandings(state: GameState): FinalStanding[] {
  return state.players
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      role: p.role,
      wealth: playerWealth(state, p),
      eliminated: p.isEliminated,
    }))
    .sort((a, b) => b.wealth - a.wealth)
}

export function checkElimination(_state: GameState, _player: Player): boolean {
  // TODO: bankrupt → pinjol → sell → eliminate.
  return false
}

/**
 * Entry point for the can't-pay flow (TTG-7). Called when a player's cash has
 * gone negative (e.g. unpayable pinjol interest). For now it only flags the
 * insolvency in the log; the forced sell → eliminate flow is TTG-16.
 */
export function triggerInsolvency(state: GameState, player: Player): void {
  if (player.cash >= 0) return
  pushLog(
    state,
    `${player.name} can't cover their debts (${rupiah(player.cash)}) — must sell property or be eliminated`,
    player.id,
  )
  // TODO (TTG-16): force property sale, then elimination if nothing left to sell.
}
