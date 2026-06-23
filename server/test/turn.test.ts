import { JAIL_TILE_ID, PINJOL_INTEREST_RATE, PROPERTY_TIERS, REGIONS } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { rollDice } from '../src/engine/index.js'
import { salaryFor } from '../src/engine/roles.js'
import { advanceTurn, startTurn } from '../src/engine/turn.js'
import { addEffect, makeGame, own, seqRng } from './helpers.js'

// rng 0.4 → both dice 3 (doubles, sum 6); seqRng([0.2, 0.7]) → dice 2 + 5 (not doubles).
const DOUBLE = () => 0.4
const NOT_DOUBLE = () => seqRng([0.2, 0.7])

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

describe('rollDice doubles', () => {
  it('grants an extra roll after a non-jail double', () => {
    const { state, players } = makeGame(2)
    state.currentPlayerIndex = 0
    const p = players[0]!
    rollDice(state, p.id, DOUBLE) // 3 + 3 → move to 6
    expect(state.turn.rolledDoubles).toBe(true)
    expect(state.turn.doublesCount).toBe(1)
    expect(p.position).toBe(6)
    // A second roll is allowed (the bonus roll); a non-double ends the chain.
    expect(() => rollDice(state, p.id, NOT_DOUBLE())).not.toThrow()
    expect(state.turn.rolledDoubles).toBe(false)
  })

  it('rejects a third roll after two doubles and a non-double', () => {
    const { state, players } = makeGame(2)
    state.currentPlayerIndex = 0
    const p = players[0]!
    rollDice(state, p.id, DOUBLE) // double #1
    rollDice(state, p.id, DOUBLE) // double #2
    expect(state.turn.doublesCount).toBe(2)
    rollDice(state, p.id, NOT_DOUBLE()) // non-double — chain ends
    expect(() => rollDice(state, p.id, DOUBLE)).toThrow('Already rolled this turn')
  })

  it('sends the player straight to jail on the third consecutive double (no move)', () => {
    const { state, players } = makeGame(2)
    state.currentPlayerIndex = 0
    const p = players[0]!
    rollDice(state, p.id, DOUBLE) // → 6
    rollDice(state, p.id, DOUBLE) // → 12
    const posBeforeThird = p.position
    rollDice(state, p.id, DOUBLE) // third double → jail
    expect(p.inJail).toBe(true)
    expect(p.position).toBe(JAIL_TILE_ID)
    expect(p.position).not.toBe(posBeforeThird + 6) // did not advance on the third roll
    expect(state.turn.rolledDoubles).toBe(false)
    expect(() => rollDice(state, p.id, DOUBLE)).toThrow('Already rolled this turn')
  })

  it('escaping jail via doubles moves but grants no extra roll', () => {
    const { state, players } = makeGame(2)
    state.currentPlayerIndex = 0
    const p = players[0]!
    p.inJail = true
    p.jailTurnsLeft = 2
    p.position = JAIL_TILE_ID
    rollDice(state, p.id, DOUBLE) // doubles → escape and move 6 from tile 10
    expect(p.inJail).toBe(false)
    expect(p.position).toBe(16)
    expect(state.turn.rolledDoubles).toBe(false)
    expect(state.turn.doublesCount).toBe(0) // a jail-escape double does not count
    expect(() => rollDice(state, p.id, DOUBLE)).toThrow('Already rolled this turn')
  })
})
