import {
  BANJIR_DURATION_ROUNDS,
  BANJIR_TIER_DROP,
  DOLLAR_NAIK_CASH_RATE,
  GO_TILE_ID,
  INVESTASI_ASING_BONUS,
  LAW_OFFICE_TILE_ID,
  REGIONS,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { drawHustle, drawKejadian } from '../src/engine/cards.js'
import { salaryFor } from '../src/engine/roles.js'
import { addEffect, makeGame, own } from './helpers.js'

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

  it('a cost card deducts cash from the drawer', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    state.hustleDeck = ['undangan_kondangan']
    drawHustle(state, p)
    expect(p.cash).toBe(500_000) // -Rp 500rb
  })

  it('a pass card grants a free-pass into the inventory', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    state.hustleDeck = ['ulang_tahun']
    drawHustle(state, p)
    expect(p.cash).toBe(0) // no cash change
    expect(p.ownedCards).toHaveLength(1)
    expect(p.ownedCards[0]!.type).toBe('jail_free')
  })

  it('the advance-to-GO card moves the player to GO and pays pass-GO salary', () => {
    const { state, players } = makeGame(2, { cash: 0, roles: ['ojol_driver', null] })
    const p = players[0]!
    p.position = 35 // mid-board: advancing to GO wraps and passes GO
    state.hustleDeck = ['advance_go']
    const salary = salaryFor(p)
    expect(salary).toBeGreaterThan(0)
    drawHustle(state, p)
    expect(p.position).toBe(GO_TILE_ID)
    expect(p.cash).toBe(salary) // no properties → only salary, no passive income
  })

  it('the advance-to-GO card pays salary even when the player is already on GO', () => {
    const { state, players } = makeGame(2, { cash: 0, roles: ['ojol_driver', null] })
    const p = players[0]!
    p.position = GO_TILE_ID // a full lap back to GO still collects salary
    state.hustleDeck = ['advance_go']
    drawHustle(state, p)
    expect(p.position).toBe(GO_TILE_ID)
    expect(p.cash).toBe(salaryFor(p))
  })

  it('the advance-to-Law-Office card moves the player to Kantor Hukum and opens its menu', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    const p = players[0]!
    p.position = 5 // forward to tile 19, no wrap → no salary
    state.hustleDeck = ['advance_law_office']
    drawHustle(state, p)
    expect(p.position).toBe(LAW_OFFICE_TILE_ID)
    expect(state.turn.pendingLawOffice).toBe(true)
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
})

describe('drawKejadian — overhauled cards', () => {
  it("dollar_naik takes 10% of every active player's cash", () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    state.kejadianDeck = ['dollar_naik']
    drawKejadian(state, players[0]!)
    const expected = 1_000_000 - Math.round(1_000_000 * DOLLAR_NAIK_CASH_RATE)
    expect(players[0]!.cash).toBe(expected)
    expect(players[1]!.cash).toBe(expected)
  })

  it('investasi_asing pays the bonus only to property-track owners', () => {
    const { state, players } = makeGame(2, { cash: 0 })
    own(state, 1, players[0]!.id, { track: 'property', tier: 1 })
    state.kejadianDeck = ['investasi_asing']
    drawKejadian(state, players[0]!)
    expect(players[0]!.cash).toBe(INVESTASI_ASING_BONUS)
    expect(players[1]!.cash).toBe(0) // owns nothing
  })

  it('reshuffle_kabinet wipes card effects and free-passes but keeps deals', () => {
    const { state, players } = makeGame(2)
    addEffect(state, { sourceCard: 'banjir_jakarta', type: 'tier_drop' })
    addEffect(state, { sourceCard: 'deal_abc', type: 'rent_immunity' })
    players[0]!.ownedCards.push({ id: 'c1', type: 'rent_free' })
    players[1]!.ownedCards.push({ id: 'c2', type: 'jail_free' })
    state.kejadianDeck = ['reshuffle_kabinet']
    drawKejadian(state, players[0]!)
    expect(state.activeEffects).toHaveLength(1)
    expect(state.activeEffects[0]!.sourceCard).toBe('deal_abc')
    expect(players[0]!.ownedCards).toHaveLength(0)
    expect(players[1]!.ownedCards).toHaveLength(0)
  })
})
