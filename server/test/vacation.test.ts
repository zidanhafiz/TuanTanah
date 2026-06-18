import { RINJANI_FEE } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { rollDice } from '../src/engine/index.js'
import { makeGame, own, seqRng } from './helpers.js'

// Tile 24 is Gunung Rinjani (vacation). From position 15, seqRng([0.55, 0.7]) rolls
// 4 + 5 = 9 → lands on 24 without passing GO.
const ROLL_NINE = () => seqRng([0.55, 0.7])

describe('Gunung Rinjani (vacation)', () => {
  it('summons every active player to the mountain and charges the fee', () => {
    const { state, players } = makeGame(3, { cash: 1_000_000_000 })
    const [a, b, c] = players
    state.currentPlayerIndex = 0
    a!.position = 15
    b!.position = 5
    c!.position = 30
    rollDice(state, a!.id, ROLL_NINE())
    for (const p of players) {
      expect(p.position).toBe(24)
      expect(p.cash).toBe(1_000_000_000 - RINJANI_FEE)
    }
  })

  it('exempts jailed players from the gather and the fee', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const [a, b] = players
    state.currentPlayerIndex = 0
    a!.position = 15
    b!.inJail = true
    b!.position = 10
    const bCash = b!.cash
    rollDice(state, a!.id, ROLL_NINE())
    expect(b!.position).toBe(10)
    expect(b!.cash).toBe(bCash)
  })

  it('raises a pending debt for a player who cannot pay the fee', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    const [a, b] = players
    state.currentPlayerIndex = 0
    a!.position = 15
    b!.cash = 0
    own(state, 1, b!.id) // owns property, so the unpayable fee becomes a debt (not elimination)
    rollDice(state, a!.id, ROLL_NINE())
    expect(state.pendingDebts.some((d) => d.debtorId === b!.id)).toBe(true)
  })
})
