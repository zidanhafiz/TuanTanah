// Pinjol (loan) system (TTG-7).
// Rules: 3 loan sizes (2/5/10jt), 10% interest per round, max 3 active loans,
// borrow limit 3× total property value, Rentenir can lend directly and earns
// the interest. Pure engine logic — throws EngineError on invalid input.
import {
  PINJOL_AMOUNTS,
  PINJOL_BORROW_LIMIT_MULTIPLE,
  PINJOL_INTEREST_RATE,
  PINJOL_MAX_LOANS,
  REGIONS,
} from '@tuan-tanah/shared'
import type { GameState, Player, RupiahAmount } from '@tuan-tanah/shared'
import { getTileDef } from './board.js'
import { triggerInsolvency } from './elimination.js'
import { EngineError, requireTurn, rupiah } from './index.js'
import { pushLog, uid } from './util.js'

/** Sum of the buy price of every tile the player owns (property value only). */
export function propertyValue(state: GameState, player: Player): RupiahAmount {
  let total = 0
  for (const tile of state.tiles) {
    if (tile.ownerId !== player.id) continue
    const region = getTileDef(tile.id).region
    if (region) total += REGIONS[region].buyPrice
  }
  return total
}

/** Sum of the principal of all the player's active loans. */
export function outstandingPrincipal(player: Player): RupiahAmount {
  return player.loans.reduce((sum, loan) => sum + loan.amount, 0)
}

export function canTakeLoan(state: GameState, player: Player, amount: RupiahAmount): boolean {
  if (!PINJOL_AMOUNTS.includes(amount)) return false
  if (player.loans.length >= PINJOL_MAX_LOANS) return false
  const limit = PINJOL_BORROW_LIMIT_MULTIPLE * propertyValue(state, player)
  return outstandingPrincipal(player) + amount <= limit
}

/**
 * Borrow a pinjol loan on the current player's turn. Lender is the bank by
 * default, or a Rentenir player (passed as `lenderId`) who fronts the cash and
 * later earns the interest. Mutates state; throws EngineError on invalid input.
 */
export function takeLoan(
  state: GameState,
  playerId: string,
  amount: RupiahAmount,
  lenderId?: string,
): void {
  const player = requireTurn(state, playerId)

  if (!PINJOL_AMOUNTS.includes(amount)) throw new EngineError('Invalid loan size')
  if (player.loans.length >= PINJOL_MAX_LOANS) {
    throw new EngineError(`You already have ${PINJOL_MAX_LOANS} active loans`)
  }
  const limit = PINJOL_BORROW_LIMIT_MULTIPLE * propertyValue(state, player)
  if (outstandingPrincipal(player) + amount > limit) {
    throw new EngineError(
      `Borrow limit is ${rupiah(limit)} (3× your property value); you can't borrow this much`,
    )
  }

  let lender: Player | null = null
  if (lenderId) {
    if (lenderId === player.id) throw new EngineError('You cannot borrow from yourself')
    const found = state.players.find((p) => p.id === lenderId)
    if (!found) throw new EngineError('Lender not found')
    if (found.role !== 'rentenir') throw new EngineError('Only a Rentenir can lend pinjol')
    if (found.isEliminated) throw new EngineError('That lender is eliminated')
    if (found.cash < amount) throw new EngineError('Lender does not have enough cash')
    lender = found
  }

  if (lender) {
    lender.cash -= amount
  } else {
    state.bank -= amount
  }
  player.cash += amount
  player.loans.push({
    id: uid(),
    amount,
    interestPerRound: Math.round(amount * PINJOL_INTEREST_RATE),
    lenderId: lender ? lender.id : null,
    roundBorrowed: state.round,
  })
  pushLog(
    state,
    `${player.name} took a ${rupiah(amount)} pinjol from ${lender ? lender.name : 'the bank'}`,
    player.id,
  )
}

/**
 * Charge interest on all active loans at the start of a player's turn. Interest
 * goes to the lending Rentenir (if still in the game) or the bank. If the player
 * can't cover it, cash goes negative and the insolvency flow is triggered.
 */
export function chargeInterest(state: GameState, player: Player): RupiahAmount {
  if (player.loans.length === 0) return 0
  let total = 0
  for (const loan of player.loans) {
    const interest = Math.round(loan.amount * PINJOL_INTEREST_RATE)
    loan.interestPerRound = interest
    total += interest
    const lender = loan.lenderId
      ? state.players.find((p) => p.id === loan.lenderId && !p.isEliminated)
      : null
    if (lender) lender.cash += interest
    else state.bank += interest
  }
  player.cash -= total
  pushLog(state, `${player.name} paid ${rupiah(total)} pinjol interest`, player.id)
  if (player.cash < 0) triggerInsolvency(state, player)
  return total
}
