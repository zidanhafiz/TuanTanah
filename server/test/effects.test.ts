import { describe, expect, it } from 'vitest'
import {
  applyPassiveMultiplier,
  applyRentEffects,
  effectiveTier,
  hasRentImmunity,
  tickEffects,
} from '../src/engine/effects.js'
import { addEffect, makeGame } from './helpers.js'

describe('tickEffects', () => {
  it('decrements remaining rounds and drops expired effects', () => {
    const { state } = makeGame(2)
    const expiring = addEffect(state, { roundsRemaining: 1 })
    const lasting = addEffect(state, { roundsRemaining: 3 })
    tickEffects(state)
    expect(state.activeEffects.find((e) => e.id === expiring.id)).toBeUndefined()
    expect(state.activeEffects.find((e) => e.id === lasting.id)?.roundsRemaining).toBe(2)
  })
})

describe('applyRentEffects', () => {
  it('stacks rent and transport multipliers on a matching tile', () => {
    const { state } = makeGame(2)
    addEffect(state, { type: 'rent_multiplier', targetTileIds: [1], multiplier: 2 })
    addEffect(state, { type: 'transport_multiplier', targetTileIds: [1], multiplier: 3 })
    expect(applyRentEffects(1_000, 1, state)).toBe(6_000)
  })

  it('ignores effects targeting other tiles', () => {
    const { state } = makeGame(2)
    addEffect(state, { type: 'rent_multiplier', targetTileIds: [2], multiplier: 2 })
    expect(applyRentEffects(1_000, 1, state)).toBe(1_000)
  })
})

describe('applyPassiveMultiplier', () => {
  it('applies a per-player multiplier', () => {
    const { state, players } = makeGame(2)
    addEffect(state, { type: 'passive_multiplier', targetPlayerId: players[0]!.id, multiplier: 3 })
    expect(applyPassiveMultiplier(1_000, players[0]!.id, state)).toBe(3_000)
    expect(applyPassiveMultiplier(1_000, players[1]!.id, state)).toBe(1_000)
  })

  it('applies a global passive_halved multiplier to everyone', () => {
    const { state, players } = makeGame(2)
    addEffect(state, { type: 'passive_halved', multiplier: 0.5 })
    expect(applyPassiveMultiplier(1_000, players[1]!.id, state)).toBe(500)
  })
})

describe('effectiveTier', () => {
  it('drops the tier by a tier_drop effect, clamped at 0', () => {
    const { state } = makeGame(2)
    addEffect(state, { type: 'tier_drop', targetTileIds: [1], multiplier: 1 })
    expect(effectiveTier(state, 1, 3)).toBe(2)
    expect(effectiveTier(state, 1, 0)).toBe(0)
  })
})

describe('hasRentImmunity', () => {
  it('detects an active immunity for the payer on the tile', () => {
    const { state, players } = makeGame(2)
    addEffect(state, {
      type: 'rent_immunity',
      targetPlayerId: players[0]!.id,
      targetTileIds: [1],
    })
    expect(hasRentImmunity(state, players[0]!.id, 1)).toBe(true)
    expect(hasRentImmunity(state, players[0]!.id, 2)).toBe(false)
    expect(hasRentImmunity(state, players[1]!.id, 1)).toBe(false)
  })
})
