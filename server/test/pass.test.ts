// Free-pass inventory: passes auto-consume on a matching rent / tax / jailing.
import { describe, expect, it } from 'vitest'
import { rollDice, sendToJail } from '../src/engine/index.js'
import { consumeOwnedCard } from '../src/engine/effects.js'
import { makeGame, own, seqRng } from './helpers.js'

describe('consumeOwnedCard', () => {
  it('removes one matching pass and reports success', () => {
    const { players } = makeGame(1)
    const p = players[0]!
    p.ownedCards.push({ id: 'a', type: 'rent_free' }, { id: 'b', type: 'rent_free' })
    expect(consumeOwnedCard(p, 'rent_free')).toBe(true)
    expect(p.ownedCards).toHaveLength(1) // only one consumed
    expect(consumeOwnedCard(p, 'tax_free')).toBe(false) // none held
  })
})

describe('pass auto-consumption', () => {
  it('a rent-free pass waives rent and is consumed', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const [me, other] = players as [(typeof players)[0], (typeof players)[0]]
    own(state, 3, other.id, { track: 'house', tier: 1 }) // a tile with positive rent
    me.position = 0
    me.ownedCards.push({ id: 'rf', type: 'rent_free' })
    // seqRng → dice 1 + 2 = 3: land on tile 3 without passing GO.
    rollDice(state, me.id, seqRng([0, 0.3]))
    expect(me.cash).toBe(1_000_000) // no rent charged
    expect(me.ownedCards).toHaveLength(0)
  })

  it('a tax-free pass waives a tax tile and is consumed', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000 })
    const me = players[0]!
    me.position = 0
    me.ownedCards.push({ id: 'tf', type: 'tax_free' })
    // seqRng → dice 1 + 3 = 4: land on tile 4 (Pajak Penghasilan).
    rollDice(state, me.id, seqRng([0, 0.4]))
    expect(me.cash).toBe(1_000_000) // no tax charged
    expect(me.ownedCards).toHaveLength(0)
  })

  it('a jail-free pass prevents jailing and is consumed', () => {
    const { state, players } = makeGame(2)
    const me = players[0]!
    me.ownedCards.push({ id: 'jf', type: 'jail_free' })
    sendToJail(state, me)
    expect(me.inJail).toBe(false)
    expect(me.ownedCards).toHaveLength(0)
  })

  it('without a jail-free pass the player goes to jail', () => {
    const { state, players } = makeGame(2)
    const me = players[0]!
    sendToJail(state, me)
    expect(me.inJail).toBe(true)
  })
})
