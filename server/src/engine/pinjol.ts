// Pinjol (loan) system — STUB for a later milestone.
// Rules: 3 loan sizes (2/5/10jt), 10% interest per round, max 3 loans,
// borrow limit 3× total property value, Rentenir can lend directly.
import {
  PINJOL_AMOUNTS,
  PINJOL_INTEREST_RATE,
  PINJOL_MAX_LOANS,
} from '@tuan-tanah/shared'
import type { GameState, Player, RupiahAmount } from '@tuan-tanah/shared'

export function canTakeLoan(player: Player, _amount: RupiahAmount): boolean {
  if (player.loans.length >= PINJOL_MAX_LOANS) return false
  if (!PINJOL_AMOUNTS.includes(_amount)) return false
  // TODO: enforce borrow limit (≤ 3× total property value).
  return true
}

/** Charge interest on all active loans at the start of a player's turn. */
export function chargeInterest(_state: GameState, player: Player): RupiahAmount {
  let total = 0
  for (const loan of player.loans) {
    const interest = Math.round(loan.amount * PINJOL_INTEREST_RATE)
    loan.interestPerRound = interest
    total += interest
  }
  // TODO: deduct from cash; if unpayable, force sell / eliminate.
  return total
}
