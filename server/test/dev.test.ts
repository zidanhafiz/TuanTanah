import { JAIL_TILE_ID, REGIONS } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { devTeleport } from '../src/engine/index.js'
import { makeGame, own } from './helpers.js'

// devTeleport is a dev-only helper: it drops the current player on a tile and
// resolves it exactly like a landing, without a dice roll. These tests pin that
// it reuses the real resolveTile path (rather than a parallel implementation).
describe('devTeleport', () => {
  it('lands on an unowned property and prompts a buy, marking the turn rolled', () => {
    const { state, players } = makeGame(2)
    const res = devTeleport(state, players[0]!.id, 1) // Sentani (unowned property)
    expect(players[0]!.position).toBe(1)
    expect(state.turn.pendingBuyTileId).toBe(1)
    expect(state.turn.hasRolled).toBe(true)
    expect(state.turn.lastDice).toBeNull()
    expect(res.card).toBeUndefined()
  })

  it('charges tax when landing on a tax tile', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const before = players[0]!.cash
    devTeleport(state, players[0]!.id, 4) // Pajak Penghasilan (11%)
    expect(players[0]!.cash).toBeLessThan(before)
  })

  it('Pajak Penghasilan taxes cash on hand, ignoring property value', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    own(state, 1, p.id) // owning property must not raise the income-tax bill
    devTeleport(state, p.id, 4) // Pajak Penghasilan: 11% of cash
    expect(p.cash).toBe(1_000_000 - Math.round(1_000_000 * 0.11))
  })

  it('Pajak Kemewahan taxes total wealth at 20%', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const p = players[0]!
    own(state, 1, p.id)
    const wealth = 1_000_000 + REGIONS.papua.buyPrice
    devTeleport(state, p.id, 30) // Pajak Kemewahan: 20% of total wealth
    expect(p.cash).toBe(1_000_000 - Math.round(wealth * 0.2))
  })

  it('sends the player to jail when landing on the go-to-jail corner', () => {
    const { state, players } = makeGame(2)
    devTeleport(state, players[0]!.id, 20) // Masuk Penjara (jail_go)
    expect(players[0]!.inJail).toBe(true)
    expect(players[0]!.position).toBe(JAIL_TILE_ID)
  })

  it('rejects an out-of-range tile', () => {
    const { state, players } = makeGame(2)
    expect(() => devTeleport(state, players[0]!.id, 99)).toThrow()
  })

  it("rejects a teleport for a player who isn't the current one", () => {
    const { state, players } = makeGame(2)
    state.currentPlayerIndex = 0
    expect(() => devTeleport(state, players[1]!.id, 1)).toThrow()
  })
})
