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
import { charge, settleIfAble } from './elimination.js'
import { EngineError, requireDebtorOrTurn, requireTurn, rupiah } from './index.js'
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
  // Allowed on your turn, or out of turn while you owe a debt (to raise cash).
  const player = requireDebtorOrTurn(state, playerId)

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

  grantLoan(state, player, amount, lender)
  pushLog(
    state,
    `${player.name} took a ${rupiah(amount)} pinjol from ${lender ? lender.name : 'the bank'}`,
    player.id,
  )
  // Borrowing to cover a pending debt settles it once the cash is in hand.
  settleIfAble(state, playerId)
}

/**
 * Rentenir's signature loanshark power: on their turn, force a rival to take a
 * pinjol they didn't ask for. The Rentenir fronts the cash (so it lands on the
 * target) and becomes the lender, collecting 10%/lap interest for the loan's
 * life. Limited to once per round. The target still can't be pushed past the
 * normal pinjol limits (max active loans, 3× property-value borrow ceiling), so
 * only rivals with collateral and loan headroom can be saddled. Mutates state;
 * throws EngineError on invalid input.
 */
export function forceLoan(
  state: GameState,
  rentenirId: string,
  targetId: string,
  amount: RupiahAmount,
): void {
  const rentenir = requireTurn(state, rentenirId)
  if (rentenir.role !== 'rentenir') throw new EngineError('Only a Rentenir can force a loan')
  if (rentenir.forcedLoanRound === state.round) {
    throw new EngineError('You can only force one loan per round')
  }
  if (!PINJOL_AMOUNTS.includes(amount)) throw new EngineError('Invalid loan size')

  if (targetId === rentenir.id) throw new EngineError('You cannot force a loan on yourself')
  const target = state.players.find((p) => p.id === targetId)
  if (!target) throw new EngineError('Target not found')
  if (target.isEliminated) throw new EngineError('That player is eliminated')

  if (target.loans.length >= PINJOL_MAX_LOANS) {
    throw new EngineError(`${target.name} already has ${PINJOL_MAX_LOANS} active loans`)
  }
  const limit = PINJOL_BORROW_LIMIT_MULTIPLE * propertyValue(state, target)
  if (outstandingPrincipal(target) + amount > limit) {
    throw new EngineError(`${target.name} can't be forced past their ${rupiah(limit)} borrow limit`)
  }
  if (rentenir.cash < amount) throw new EngineError('You do not have enough cash to fund the loan')

  grantLoan(state, target, amount, rentenir)
  rentenir.forcedLoanRound = state.round
  pushLog(
    state,
    `${rentenir.name} forced a ${rupiah(amount)} pinjol on ${target.name}`,
    rentenir.id,
  )
}

/**
 * Credit `borrower` with `amount`, debiting the funding Rentenir (or the bank
 * when `lender` is null), and record the loan. Shared by the voluntary
 * (`takeLoan`) and forced (`forceLoan`) paths.
 */
function grantLoan(
  state: GameState,
  borrower: Player,
  amount: RupiahAmount,
  lender: Player | null,
): void {
  if (lender) {
    lender.cash -= amount
  } else {
    state.bank -= amount
  }
  borrower.cash += amount
  borrower.loans.push({
    id: uid(),
    amount,
    interestPerLap: Math.round(amount * PINJOL_INTEREST_RATE),
    lenderId: lender ? lender.id : null,
    roundBorrowed: state.round,
    interestPaid: 0,
  })
}

/**
 * Charge a lap's interest on all active loans (called once at the start of the
 * turn after the borrower passed GO). Interest goes to the lending Rentenir (if
 * still in the game) or the bank. If the player can't cover it, cash goes
 * negative and the insolvency flow is triggered.
 */
export function chargeInterest(state: GameState, player: Player): RupiahAmount {
  if (player.loans.length === 0) return 0
  let total = 0
  for (const loan of player.loans) {
    // Negotiated peer loans carry their own rate; bank/Rentenir loans use the default.
    const rate = loan.interestRate ?? PINJOL_INTEREST_RATE
    const interest = Math.round(loan.amount * rate)
    loan.interestPerLap = interest
    total += interest
  }

  if (player.cash >= total) {
    // Affordable: pay each lender (or the bank) their share directly.
    for (const loan of player.loans) {
      const lender = loan.lenderId
        ? state.players.find((p) => p.id === loan.lenderId && !p.isEliminated)
        : null
      if (lender) lender.cash += loan.interestPerLap
      else state.bank += loan.interestPerLap
      loan.interestPaid += loan.interestPerLap
    }
    player.cash -= total
    pushLog(state, `${player.name} paid ${rupiah(total)} pinjol interest`, player.id)
  } else {
    // Can't cover it → opens a pending debt (multi-lender interest is collapsed
    // into a single bank debt; lenders forgo it in this bankruptcy edge case).
    charge(state, player, total, null, 'interest', 'pinjol interest')
  }
  return total
}
