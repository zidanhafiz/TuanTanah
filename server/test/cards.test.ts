import {
  BANJIR_DURATION_ROUNDS,
  BANJIR_TIER_DROP,
  REGIONS,
  VIRAL_MEDSOS_MULTIPLIER,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { drawHustle, drawKejadian } from '../src/engine/cards.js'
import { makeGame, seqRng } from './helpers.js'

describe('drawHustle', () => {
  it('credits the card earnings and recycles the deck', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    state.hustleDeck = ['gofood_driver', 'dropshipper']
    const bankBefore = state.bank
    const drawn = drawHustle(state, p)
    expect(drawn).toEqual({ cardId: 'gofood_driver', name: 'GoFood Driver' })
    expect(p.cash).toBe(500_000)
    expect(state.bank).toBe(bankBefore - 500_000)
    // Drawn card recycles to the bottom.
    expect(state.hustleDeck).toEqual(['dropshipper', 'gofood_driver'])
  })
})

describe('drawKejadian — immediate cash effects', () => {
  it('lebaran pays every active player a THR bonus', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    state.kejadianDeck = ['lebaran']
    drawKejadian(state, players[0]!)
    expect(players[0]!.cash).toBe(2_000_000)
    expect(players[1]!.cash).toBe(2_000_000)
  })

  it('kenaikan_bbm taxes everyone but the tax-immune Ojol Driver', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000, roles: [null, 'ojol_driver'] })
    state.kejadianDeck = ['kenaikan_bbm']
    drawKejadian(state, players[0]!)
    expect(players[0]!.cash).toBe(500_000) // paid 500k
    expect(players[1]!.cash).toBe(1_000_000) // immune
  })
})

describe('drawKejadian — Pejabat block', () => {
  it('nullifies the drawn card when a block is armed', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    state.kejadianDeck = ['lebaran']
    state.pendingKejadianBlock = true
    const drawn = drawKejadian(state, players[0]!)
    expect(drawn).toEqual({ cardId: 'lebaran', name: 'Lebaran' })
    expect(players[0]!.cash).toBe(0) // no THR
    expect(state.pendingKejadianBlock).toBe(false)
  })
})

describe('drawKejadian — timed effects', () => {
  it('banjir_jakarta drops the tier of every Jakarta tile', () => {
    const { state, players } = makeGame(2)
    state.kejadianDeck = ['banjir_jakarta']
    drawKejadian(state, players[0]!)
    expect(state.activeEffects).toContainEqual(
      expect.objectContaining({
        type: 'tier_drop',
        targetTileIds: REGIONS.jakarta.tileIds,
        multiplier: BANJIR_TIER_DROP,
        roundsRemaining: BANJIR_DURATION_ROUNDS,
      }),
    )
  })

  it('viral_medsos boosts a deterministically chosen property tile', () => {
    const { state, players } = makeGame(2)
    state.kejadianDeck = ['viral_medsos']
    // rng() = 0 => first property tile in board order (id 1, Sentani).
    drawKejadian(state, players[0]!, seqRng([0]))
    expect(state.activeEffects).toContainEqual(
      expect.objectContaining({
        type: 'rent_multiplier',
        targetTileIds: [1],
        multiplier: VIRAL_MEDSOS_MULTIPLIER,
      }),
    )
  })
})
