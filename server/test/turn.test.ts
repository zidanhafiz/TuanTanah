import { PINJOL_INTEREST_RATE, PROPERTY_TIERS, REGIONS } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { rollDice } from '../src/engine/index.js'
import { salaryFor } from '../src/engine/roles.js'
import { advanceTurn, startTurn } from '../src/engine/turn.js'
import { addEffect, makeGame, own } from './helpers.js'

describe('advanceTurn', () => {
  it('moves to the next player without ticking the round', () => {
    const { state } = makeGame(3)
    state.currentPlayerIndex = 0
    advanceTurn(state)
    expect(state.currentPlayerIndex).toBe(1)
    expect(state.round).toBe(1)
  })

  it('increments the round and ticks effects when the order wraps', () => {
    const { state } = makeGame(3)
    state.currentPlayerIndex = 2
    const expiring = addEffect(state, { roundsRemaining: 1 })
    const lasting = addEffect(state, { roundsRemaining: 2 })
    advanceTurn(state)
    expect(state.currentPlayerIndex).toBe(0)
    expect(state.round).toBe(2)
    // Expiring effect dropped; lasting effect decremented.
    expect(state.activeEffects.find((e) => e.id === expiring.id)).toBeUndefined()
    expect(state.activeEffects.find((e) => e.id === lasting.id)?.roundsRemaining).toBe(1)
  })

  it('skips eliminated players', () => {
    const { state, players } = makeGame(3)
    state.currentPlayerIndex = 0
    players[1]!.isEliminated = true
    advanceTurn(state)
    expect(state.currentPlayerIndex).toBe(2)
  })

  it('consumes a turn_skip effect and skips that player', () => {
    const { state, players } = makeGame(3)
    state.currentPlayerIndex = 0
    const skip = addEffect(state, { type: 'turn_skip', targetPlayerId: players[1]!.id })
    advanceTurn(state)
    expect(state.currentPlayerIndex).toBe(2)
    expect(state.activeEffects.find((e) => e.id === skip.id)).toBeUndefined()
  })
})

describe('startTurn upkeep', () => {
  it('charges pinjol interest at turn start when a lap is due (no passive income)', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id, { track: 'property', tier: 1 })
    p.loans = [
      {
        id: 'l1',
        amount: 2_000_000,
        interestPerLap: 0,
        lenderId: null,
        roundBorrowed: 1,
        interestPaid: 0,
      },
    ]
    p.owesLapInterest = true // interest is per-lap; flag it as due this turn

    const interest = Math.round(2_000_000 * PINJOL_INTEREST_RATE) // 200k
    startTurn(state)
    // Passive income moved to the pass-GO path, so turn start only charges interest.
    expect(p.cash).toBe(1_000_000 - interest)
  })

  it('does nothing to cash at turn start when no lap is due', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id, { track: 'property', tier: 1 })
    p.loans = [
      {
        id: 'l1',
        amount: 2_000_000,
        interestPerLap: 0,
        lenderId: null,
        roundBorrowed: 1,
        interestPaid: 0,
      },
    ]
    p.owesLapInterest = false // hasn't passed GO since last charge

    startTurn(state)
    expect(p.cash).toBe(1_000_000) // no interest, no passive
  })

  it('collects passive income once per lap, on the pass-GO path', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    own(state, 1, p.id, { track: 'property', tier: 1 })
    const passive = REGIONS.papua.passiveBase * PROPERTY_TIERS[0]!.passiveMult // 100k

    // Turn start no longer pays passive income.
    startTurn(state)
    expect(p.cash).toBe(1_000_000)

    // rng 0.4 → both dice are 3 (sum 6); from tile 39 this wraps past GO and
    // pays salary + one lap of passive income.
    p.position = 39
    const salary = salaryFor(p)
    rollDice(state, p.id, () => 0.4)
    expect(p.cash).toBe(1_000_000 + salary + passive)
  })
})
