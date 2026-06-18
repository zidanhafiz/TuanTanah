import { JUDOL_JACKPOT_MULTIPLIER, META_ACTIONS_PER_LAP } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { performMetaAction } from '../src/engine/actions.js'
import { EngineError, rollDice } from '../src/engine/index.js'
import { makeGame, seqRng } from './helpers.js'

describe('performMetaAction — per-lap limits', () => {
  it('allows up to META_ACTIONS_PER_LAP distinct actions', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    // hustle, then korupsi, then work — three distinct, all non-targeted.
    performMetaAction(state, { action: 'hustle', playerId: p.id })
    performMetaAction(state, { action: 'korupsi', playerId: p.id }, () => 0.99) // caught → jailed, still counts
    performMetaAction(state, { action: 'work', playerId: p.id })
    expect(p.metaActionsUsed).toHaveLength(META_ACTIONS_PER_LAP)
  })

  it('rejects repeating the same action in a lap', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    performMetaAction(state, { action: 'hustle', playerId: p.id })
    expect(() => performMetaAction(state, { action: 'hustle', playerId: p.id })).toThrow(
      EngineError,
    )
  })

  it('rejects a fourth distinct action once the cap is reached', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    performMetaAction(state, { action: 'hustle', playerId: p.id })
    performMetaAction(state, { action: 'korupsi', playerId: p.id }, () => 0.0)
    performMetaAction(state, { action: 'work', playerId: p.id })
    expect(() =>
      performMetaAction(state, { action: 'lobby', playerId: p.id, targetId: players[1]!.id }),
    ).toThrow(EngineError)
  })

  it('does not count negotiate against the cap', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    performMetaAction(state, { action: 'negotiate', playerId: p.id, targetId: players[1]!.id })
    performMetaAction(state, { action: 'negotiate', playerId: p.id, targetId: players[1]!.id })
    expect(p.metaActionsUsed).toHaveLength(0)
  })

  it('resets the meta allowance when the player passes GO', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    performMetaAction(state, { action: 'hustle', playerId: p.id })
    expect(p.metaActionsUsed).toHaveLength(1)
    // rng 0.4 → both dice are 3 (sum 6); from tile 39 this wraps past GO.
    p.position = 39
    rollDice(state, p.id, () => 0.4)
    expect(p.metaActionsUsed).toHaveLength(0)
  })
})

describe('performMetaAction — judol', () => {
  const DEPOSIT = 10_000_000

  it('loses the deposit to the bank when the win roll fails', () => {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    const bank0 = state.bank
    // First roll ≥ JUDOL_WIN_RATE (0.1) → loss.
    performMetaAction(state, { action: 'judol', playerId: p.id, depositAmount: DEPOSIT }, () => 0.5)
    expect(p.cash).toBe(100_000_000 - DEPOSIT)
    expect(state.bank).toBe(bank0 + DEPOSIT)
    expect(p.metaActionsUsed).toEqual(['judol'])
  })

  it('pays deposit × integer multiplier on a non-jackpot win', () => {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    const bank0 = state.bank
    // win roll (0.05 < 0.1), jackpot sub-roll fails (0.5 ≥ 0.01), multiplier
    // roll 0.0 → min multiplier 3. Net gain = deposit × (3 - 1).
    performMetaAction(
      state,
      { action: 'judol', playerId: p.id, depositAmount: DEPOSIT },
      seqRng([0.05, 0.5, 0.0]),
    )
    expect(p.cash).toBe(100_000_000 + DEPOSIT * 2)
    expect(state.bank).toBe(bank0 - DEPOSIT * 2)
  })

  it('maps the multiplier roll across the 3–5 range', () => {
    const mults = [
      { roll: 0.0, mult: 3 },
      { roll: 0.5, mult: 4 },
      { roll: 0.99, mult: 5 },
    ]
    for (const { roll, mult } of mults) {
      const { state, players } = makeGame(2, { cash: 100_000_000 })
      const p = players[0]!
      state.currentPlayerIndex = 0
      performMetaAction(
        state,
        { action: 'judol', playerId: p.id, depositAmount: DEPOSIT },
        seqRng([0.05, 0.5, roll]),
      )
      expect(p.cash).toBe(100_000_000 + DEPOSIT * (mult - 1))
    }
  })

  it('pays the jackpot multiplier on a 1% sub-roll within a win', () => {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    // win roll (0.05 < 0.1) and jackpot sub-roll (0.005 < 0.01) → x10.
    performMetaAction(
      state,
      { action: 'judol', playerId: p.id, depositAmount: DEPOSIT },
      seqRng([0.05, 0.005]),
    )
    expect(p.cash).toBe(100_000_000 + DEPOSIT * (JUDOL_JACKPOT_MULTIPLIER - 1))
  })

  it('rejects a missing or non-positive deposit', () => {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    expect(() => performMetaAction(state, { action: 'judol', playerId: p.id })).toThrow(EngineError)
    expect(() =>
      performMetaAction(state, { action: 'judol', playerId: p.id, depositAmount: 0 }),
    ).toThrow(EngineError)
  })

  it('rejects a deposit larger than the player can afford', () => {
    const { state, players } = makeGame(2, { cash: 5_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    expect(() =>
      performMetaAction(state, { action: 'judol', playerId: p.id, depositAmount: 10_000_000 }),
    ).toThrow(EngineError)
  })

  it('counts against the per-lap cap (no repeats)', () => {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    const p = players[0]!
    state.currentPlayerIndex = 0
    performMetaAction(state, { action: 'judol', playerId: p.id, depositAmount: DEPOSIT }, () => 0.5)
    expect(() =>
      performMetaAction(
        state,
        { action: 'judol', playerId: p.id, depositAmount: DEPOSIT },
        () => 0.5,
      ),
    ).toThrow(EngineError)
  })
})
