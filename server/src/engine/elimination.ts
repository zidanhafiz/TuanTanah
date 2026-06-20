// Bankruptcy cascade + win-condition checks.
import {
  HOUSE_TIERS,
  KONTRAKTOR_CUT_RATE,
  LAHAN_LAND_PRICE,
  landTier,
  PROPERTY_TIERS,
  REGIONS,
  TRANSPORT_BUY_PRICE,
} from '@tuan-tanah/shared'
import type {
  FinalStanding,
  GameState,
  PendingDebt,
  Player,
  RupiahAmount,
  TileId,
  TileState,
  WinReason,
} from '@tuan-tanah/shared'
import { getTileDef } from './board.js'
import { EngineError, rupiah } from './index.js'
import { investorCut } from './roles.js'
import { advanceTurn } from './turn.js'
import { pushLog, uid } from './util.js'

/** Market value of a single owned tile at its current tier. */
export function tileValue(tile: TileState): RupiahAmount {
  const def = getTileDef(tile.id)
  // Lahan Kosong: bare land plus the cumulative build cost of its business tiers.
  if (def.type === 'buildable_land') {
    let value = LAHAN_LAND_PRICE
    if (tile.landBuild) {
      for (let t = 1; t <= tile.tier; t++) {
        value += landTier(tile.landBuild, t)?.buildCost ?? 0
      }
    }
    return value
  }
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
  state.winReason = reason
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

// ---- Bankruptcy cascade (TTG-16) ----
// Every forced payment goes through `charge`. If the payer can cover it the
// money moves immediately; otherwise the charge becomes a pending debt that
// pauses the game until the debtor raises the cash (sell/pinjol) or gives up.

/** Credit `amount` to a creditor (null = bank). Eliminated creditors fall back to the bank. */
function creditTo(state: GameState, creditorId: string | null, amount: RupiahAmount): void {
  if (creditorId === null) {
    state.bank += amount
    return
  }
  const creditor = state.players.find((p) => p.id === creditorId)
  if (creditor && !creditor.isEliminated) creditor.cash += amount
  else state.bank += amount
}

/** Investor role skims a cut (from the bank) of rent paid between two other players. */
export function applyInvestorCut(
  state: GameState,
  payerId: string,
  ownerId: string,
  amount: RupiahAmount,
): void {
  for (const inv of state.players) {
    if (inv.role !== 'investor' || inv.isEliminated) continue
    if (inv.id === payerId || inv.id === ownerId) continue
    const cut = investorCut(amount)
    if (cut <= 0) continue
    inv.cash += cut
    state.bank -= cut
    pushLog(state, `${inv.name} earned ${rupiah(cut)} investor cut on rent`, inv.id)
  }
}

/**
 * Kontraktor role skims a cut of rent paid on a tile they built on (the cut is
 * taken from the owner's rent income, not the bank). No-op if the tile has no
 * builder, the builder is gone, or the builder now owns the tile.
 */
export function applyBuilderCut(
  state: GameState,
  ownerId: string,
  tileId: TileId | undefined,
  amount: RupiahAmount,
): void {
  if (tileId === undefined) return
  const tile = state.tiles[tileId]
  if (!tile || tile.builderId === null || tile.builderId === ownerId) return
  const builder = state.players.find((p) => p.id === tile.builderId)
  if (!builder || builder.isEliminated) return
  const owner = state.players.find((p) => p.id === ownerId)
  if (!owner) return
  const cut = Math.round(amount * KONTRAKTOR_CUT_RATE)
  if (cut <= 0) return
  owner.cash -= cut
  builder.cash += cut
  pushLog(state, `${builder.name} earned ${rupiah(cut)} builder cut on rent`, builder.id)
}

/**
 * The single primitive for every forced payment (rent, tax, fines, interest).
 * Pays immediately when affordable; otherwise records a pending debt (or
 * eliminates a player who has nothing left to sell). `creditorId` null = bank.
 */
export function charge(
  state: GameState,
  player: Player,
  amount: RupiahAmount,
  creditorId: string | null,
  type: PendingDebt['type'],
  reason: string,
  tileId?: TileId,
): void {
  if (amount <= 0) return
  if (player.cash >= amount) {
    player.cash -= amount
    creditTo(state, creditorId, amount)
    if (type === 'rent' && creditorId) {
      applyInvestorCut(state, player.id, creditorId, amount)
      applyBuilderCut(state, creditorId, tileId, amount)
    }
    pushLog(state, `${player.name} paid ${rupiah(amount)} — ${reason}`, player.id)
    return
  }
  oweDebt(state, player, creditorId, amount, type, reason, tileId)
}

/** Record an unpayable charge, or eliminate the player if they have nothing to sell. */
function oweDebt(
  state: GameState,
  player: Player,
  creditorId: string | null,
  amount: RupiahAmount,
  type: PendingDebt['type'],
  reason: string,
  tileId?: TileId,
): void {
  // No property → borrow capacity is 0 too → no way to ever raise the cash.
  if (!state.tiles.some((t) => t.ownerId === player.id)) {
    eliminate(state, player)
    return
  }
  state.pendingDebts.push({
    id: uid(),
    debtorId: player.id,
    creditorId,
    amount,
    type,
    reason,
    tileId,
  })
  pushLog(
    state,
    `${player.name} owes ${rupiah(amount)} (${reason}) and must sell property or take a pinjol`,
    player.id,
  )
}

/** Pay off a pending debt the debtor can now afford, then remove it. */
function payOwed(state: GameState, debt: PendingDebt): void {
  const debtor = state.players.find((p) => p.id === debt.debtorId)
  if (!debtor) return
  debtor.cash -= debt.amount
  creditTo(state, debt.creditorId, debt.amount)
  if (debt.type === 'rent' && debt.creditorId) {
    applyInvestorCut(state, debt.debtorId, debt.creditorId, debt.amount)
    applyBuilderCut(state, debt.creditorId, debt.tileId, debt.amount)
  }
  state.pendingDebts = state.pendingDebts.filter((d) => d.id !== debt.id)
  pushLog(
    state,
    `${debtor.name} settled their ${rupiah(debt.amount)} debt (${debt.reason})`,
    debtor.id,
  )
}

/**
 * Eliminate a bankrupt player: properties revert to the bank, loans are wiped,
 * residual cash returns to the bank (keeping the ledger balanced), and they
 * become a spectator skipped in turn order.
 */
export function eliminate(state: GameState, player: Player): void {
  if (player.isEliminated) return
  for (const tile of state.tiles) {
    if (tile.ownerId !== player.id) continue
    tile.ownerId = null
    tile.track = null
    tile.tier = 0
    tile.builderId = null
    tile.landBuild = null
  }
  if (player.cash > 0) state.bank += player.cash
  player.cash = 0
  player.loans = []
  player.isEliminated = true
  state.pendingDebts = state.pendingDebts.filter((d) => d.debtorId !== player.id)
  pushLog(state, `💀 ${player.name} went bankrupt and was eliminated`, player.id)
}

/**
 * Voluntary forfeit: a player deliberately leaves an in-progress game. We reuse
 * the bankruptcy path (frees their tiles, voids their debts) and, if it was
 * their turn, advance the turn so the table doesn't stall. The game-over check
 * runs afterwards in the handler.
 */
export function forfeit(state: GameState, playerId: string): void {
  const player = state.players.find((p) => p.id === playerId)
  if (!player || player.isEliminated) return
  eliminate(state, player)
  pushLog(state, `🏳️ ${player.name} left the game`, playerId)
  const current = state.players[state.currentPlayerIndex]
  if (current?.id === playerId && state.pendingDebts.length === 0) advanceTurn(state)
}

/** After raising cash (sell/pinjol), settle the player's debt if they can now afford it. */
export function settleIfAble(state: GameState, playerId: string): void {
  const debt = state.pendingDebts.find((d) => d.debtorId === playerId)
  if (!debt) return
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return
  if (player.cash >= debt.amount) payOwed(state, debt)
  // Sold everything off and still short → nothing left to do but go under.
  else if (!state.tiles.some((t) => t.ownerId === playerId)) eliminate(state, player)
  finalizeDebtState(state)
}

/**
 * Resolve a player's pending debt on request. `giveUp` declares bankruptcy;
 * otherwise we pay if able, eliminate if there's nothing left to sell, or tell
 * the player to keep raising funds.
 */
export function resolveDebt(state: GameState, playerId: string, giveUp: boolean): void {
  const debt = state.pendingDebts.find((d) => d.debtorId === playerId)
  if (!debt) throw new EngineError('You have no outstanding debt')
  const player = state.players.find((p) => p.id === playerId)
  if (!player) throw new EngineError('Player not found')

  if (giveUp) {
    eliminate(state, player)
  } else if (player.cash >= debt.amount) {
    payOwed(state, debt)
  } else if (!state.tiles.some((t) => t.ownerId === playerId)) {
    eliminate(state, player)
  } else {
    throw new EngineError(
      `You still owe ${rupiah(debt.amount - player.cash)} — sell or downgrade property, or take a pinjol`,
    )
  }
  finalizeDebtState(state)
}

/** Once all debts clear, move the turn off an eliminated active player. */
function finalizeDebtState(state: GameState): void {
  if (state.pendingDebts.length > 0) return
  const current = state.players[state.currentPlayerIndex]
  if (current?.isEliminated) advanceTurn(state)
}
