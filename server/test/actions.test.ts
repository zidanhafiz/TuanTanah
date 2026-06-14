import { META_ACTIONS_PER_LAP } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { performMetaAction } from '../src/engine/actions.js'
import { EngineError, rollDice } from '../src/engine/index.js'
import { makeGame } from './helpers.js'

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
