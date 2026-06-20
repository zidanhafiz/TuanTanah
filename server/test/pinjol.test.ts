import { PINJOL_INTEREST_RATE, REGIONS } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { EngineError, repayPinjol } from '../src/engine/index.js'
import {
  canTakeLoan,
  chargeInterest,
  outstandingPrincipal,
  propertyValue,
  takeLoan,
} from '../src/engine/pinjol.js'
import { makeGame, own } from './helpers.js'

const loan = (amount: number, lenderId: string | null = null) => ({
  id: `loan-${amount}`,
  amount,
  interestPerLap: 0,
  lenderId,
  roundBorrowed: 1,
  interestPaid: 0,
})

describe('chargeInterest', () => {
  it('charges 10% per loan and pays the bank when affordable', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000 })
    const p = players[0]!
    p.loans = [loan(2_000_000)]
    const bankBefore = state.bank
    const total = chargeInterest(state, p)
    expect(total).toBe(200_000)
    expect(p.cash).toBe(4_800_000)
    expect(state.bank).toBe(bankBefore + 200_000)
  })

  it('sums interest across multiple loans', () => {
    const { state, players } = makeGame(2, { cash: 50_000_000 })
    const p = players[0]!
    p.loans = [loan(2_000_000), loan(5_000_000)]
    expect(chargeInterest(state, p)).toBe(700_000)
  })

  it('routes interest to a Rentenir lender', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000, roles: [null, 'rentenir'] })
    const [borrower, rentenir] = [players[0]!, players[1]!]
    rentenir.cash = 0
    borrower.loans = [loan(5_000_000, rentenir.id)]
    chargeInterest(state, borrower)
    expect(rentenir.cash).toBe(500_000)
  })

  it('opens a pending debt when the player cannot cover interest', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    own(state, 1, p.id) // owns property => not auto-eliminated
    p.loans = [loan(10_000_000)]
    chargeInterest(state, p)
    expect(state.pendingDebts).toHaveLength(1)
    expect(state.pendingDebts[0]).toMatchObject({ amount: 1_000_000, type: 'interest' })
  })
})

describe('canTakeLoan', () => {
  it('rejects amounts above the 3× property-value borrow limit', () => {
    const { state, players } = makeGame(2)
    const p = players[0]!
    own(state, 1, p.id) // papua buyPrice 1jt => limit 3jt; 5jt loan exceeds it
    expect(canTakeLoan(state, p, 5_000_000)).toBe(false)
  })

  it('allows a loan within the borrow limit', () => {
    const { state, players } = makeGame(2)
    const p = players[0]!
    own(state, 35, p.id) // jakarta buyPrice 6jt => limit 18jt; 10jt loan fits
    expect(canTakeLoan(state, p, 10_000_000)).toBe(true)
  })

  it('rejects invalid loan sizes', () => {
    const { state, players } = makeGame(2)
    const p = players[0]!
    own(state, 35, p.id)
    expect(canTakeLoan(state, p, 3_000_000)).toBe(false)
  })

  it('rejects when the player already has the max number of loans', () => {
    const { state, players } = makeGame(2)
    const p = players[0]!
    own(state, 35, p.id)
    p.loans = [loan(2_000_000), loan(2_000_000), loan(2_000_000)]
    expect(canTakeLoan(state, p, 2_000_000)).toBe(false)
  })
})

describe('takeLoan', () => {
  it('borrows from the bank, crediting cash and recording the loan', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 35, p.id)
    const bankBefore = state.bank
    takeLoan(state, p.id, 5_000_000)
    expect(p.cash).toBe(5_000_000)
    expect(state.bank).toBe(bankBefore - 5_000_000)
    expect(p.loans).toHaveLength(1)
    expect(p.loans[0]).toMatchObject({
      amount: 5_000_000,
      lenderId: null,
      interestPerLap: Math.round(5_000_000 * PINJOL_INTEREST_RATE),
    })
  })

  it('borrows from a Rentenir, drawing from their cash', () => {
    const { state, players } = makeGame(2, { cash: 0, roles: [null, 'rentenir'] })
    const [borrower, rentenir] = [players[0]!, players[1]!]
    state.currentPlayerIndex = 0
    own(state, 35, borrower.id)
    rentenir.cash = 5_000_000
    takeLoan(state, borrower.id, 5_000_000, rentenir.id)
    expect(borrower.cash).toBe(5_000_000)
    expect(rentenir.cash).toBe(0)
    expect(borrower.loans[0]!.lenderId).toBe(rentenir.id)
  })

  it('rejects borrowing from a non-Rentenir', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const [borrower, other] = [players[0]!, players[1]!]
    state.currentPlayerIndex = 0
    own(state, 35, borrower.id)
    expect(() => takeLoan(state, borrower.id, 5_000_000, other.id)).toThrow(EngineError)
  })
})

describe('value helpers', () => {
  it('propertyValue sums owned buy prices', () => {
    const { state, players } = makeGame(2)
    const p = players[0]!
    own(state, 1, p.id)
    own(state, 35, p.id)
    expect(propertyValue(state, p)).toBe(REGIONS.papua.buyPrice + REGIONS.jakarta.buyPrice)
  })

  it('outstandingPrincipal sums loan amounts', () => {
    const { players } = makeGame(2)
    const p = players[0]!
    p.loans = [loan(2_000_000), loan(5_000_000)]
    expect(outstandingPrincipal(p)).toBe(7_000_000)
  })
})

describe('repayPinjol', () => {
  it('repays all loans, returning principal to the bank', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    p.loans = [loan(2_000_000), loan(5_000_000)]
    const bankBefore = state.bank
    repayPinjol(state, p.id)
    expect(p.loans).toHaveLength(0)
    expect(p.cash).toBe(3_000_000)
    expect(state.bank).toBe(bankBefore + 7_000_000)
  })

  it('repays a single loan by id and routes principal to a Rentenir lender', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000, roles: [null, 'rentenir'] })
    const [borrower, rentenir] = [players[0]!, players[1]!]
    state.currentPlayerIndex = 0
    rentenir.cash = 0
    borrower.loans = [loan(2_000_000), loan(5_000_000, rentenir.id)]
    repayPinjol(state, borrower.id, borrower.loans[1]!.id)
    expect(borrower.loans).toHaveLength(1)
    expect(rentenir.cash).toBe(5_000_000)
  })

  it('rejects repaying more than the player can afford', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    p.loans = [loan(5_000_000)]
    expect(() => repayPinjol(state, p.id)).toThrow(EngineError)
  })
})
