import { AFK_FINE_STEP } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { applyAfkTimeout } from '../src/engine/elimination.js'
import { rollDice } from '../src/engine/index.js'
import { makeGame, own, seqRng } from './helpers.js'

describe('applyAfkTimeout', () => {
  it('fines Rp 1jt and skips the turn on the first AFK', () => {
    const { state, players } = makeGame(2, { cash: 10_000_000 })
    const p0 = players[0]!
    applyAfkTimeout(state, p0.id)

    expect(p0.afkStrikes).toBe(1)
    expect(p0.cash).toBe(10_000_000 - AFK_FINE_STEP)
    expect(state.bank).toBeGreaterThan(0)
    // Turn advanced off the AFK player.
    expect(state.currentPlayerIndex).toBe(1)
    expect(state.pendingDebts).toHaveLength(0)
    expect(p0.isEliminated).toBe(false)
  })

  it('escalates the fine 1jt → 2jt → 3jt over consecutive AFK turns', () => {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    const p0 = players[0]!
    applyAfkTimeout(state, p0.id)
    applyAfkTimeout(state, p0.id)
    applyAfkTimeout(state, p0.id)

    expect(p0.afkStrikes).toBe(3)
    // Cumulative fines: 1 + 2 + 3 = 6 × the step.
    expect(p0.cash).toBe(100_000_000 - 6 * AFK_FINE_STEP)
    expect(p0.isEliminated).toBe(false)
    expect(state.pendingDebts).toHaveLength(0)
  })

  it('caps the fine at available cash and never opens a debt', () => {
    const { state, players } = makeGame(2, { cash: 500_000 })
    const p0 = players[0]!
    applyAfkTimeout(state, p0.id)

    expect(p0.cash).toBe(0)
    expect(p0.cash).toBeGreaterThanOrEqual(0)
    expect(state.pendingDebts).toHaveLength(0)
    expect(p0.isEliminated).toBe(false)
  })

  it('kicks (eliminates) the player on the AFK turn after the third fine', () => {
    const { state, players } = makeGame(2, { cash: 100_000_000 })
    const p0 = players[0]!
    // Give them a property so the kick exercises the full forfeit/return-to-bank path.
    own(state, 1, p0.id)

    applyAfkTimeout(state, p0.id) // strike 1 — fine
    applyAfkTimeout(state, p0.id) // strike 2 — fine
    applyAfkTimeout(state, p0.id) // strike 3 — fine
    expect(p0.isEliminated).toBe(false)

    applyAfkTimeout(state, p0.id) // strike 4 — kick
    expect(p0.afkStrikes).toBe(4)
    expect(p0.isEliminated).toBe(true)
    // Their property reverted to the bank.
    expect(state.tiles[1]!.ownerId).toBeNull()
  })

  it('does nothing for an already-eliminated player', () => {
    const { state, players } = makeGame(2)
    const p0 = players[0]!
    p0.isEliminated = true
    applyAfkTimeout(state, p0.id)
    expect(p0.afkStrikes).toBe(0)
  })
})

describe('rollDice resets AFK strikes', () => {
  it('clears accumulated strikes when the player shows up and rolls', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const p0 = players[0]!
    p0.afkStrikes = 2

    rollDice(state, p0.id, seqRng([0, 0]))

    expect(p0.afkStrikes).toBe(0)
  })
})
