import {
  LAW_OFFICE_FREEPASS_PRICE,
  LAW_OFFICE_JAIL_FEE,
  LAW_OFFICE_TRANSFER_RATE,
} from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  EngineError,
  lawOfficeBuy,
  lawOfficeFreepass,
  lawOfficeJail,
  lawOfficeSkip,
  lawOfficeTransfer,
} from '../src/engine/index.js'
import { tileValue } from '../src/engine/elimination.js'
import { makeGame, own } from './helpers.js'

/** A 2+ player game with the current player parked on the Kantor Hukum (tile 19). */
function atLawOffice(count = 2) {
  const g = makeGame(count, { cash: 1_000_000_000 })
  g.state.currentPlayerIndex = 0
  g.state.turn.pendingLawOffice = true
  return g
}

describe('Kantor Hukum (law_office)', () => {
  it('buys an unowned tile remotely and clears the pending state', () => {
    const { state, players } = atLawOffice()
    lawOfficeBuy(state, players[0]!.id, 1) // Papua / Sentani
    expect(state.tiles[1]!.ownerId).toBe(players[0]!.id)
    expect(state.turn.pendingLawOffice).toBe(false)
  })

  it('force-buys a rival property at 70% of invested value, keeping tier & track', () => {
    const { state, players } = atLawOffice()
    const [a, b] = players
    own(state, 1, b!.id, { track: 'property', tier: 2 })
    const price = Math.round(tileValue(state.tiles[1]!) * LAW_OFFICE_TRANSFER_RATE)
    const aCash = a!.cash
    const bCash = b!.cash
    lawOfficeTransfer(state, a!.id, 1)
    expect(state.tiles[1]!.ownerId).toBe(a!.id)
    expect(state.tiles[1]!).toMatchObject({ track: 'property', tier: 2 })
    expect(a!.cash).toBe(aCash - price)
    expect(b!.cash).toBe(bCash + price)
    expect(state.turn.pendingLawOffice).toBe(false)
  })

  it('rejects transferring an unowned or own tile', () => {
    const { state, players } = atLawOffice()
    expect(() => lawOfficeTransfer(state, players[0]!.id, 1)).toThrow(EngineError)
    own(state, 2, players[0]!.id)
    expect(() => lawOfficeTransfer(state, players[0]!.id, 2)).toThrow(EngineError)
  })

  it('rejects a transfer the actor cannot afford', () => {
    const { state, players } = makeGame(2, { cash: 100 })
    state.currentPlayerIndex = 0
    state.turn.pendingLawOffice = true
    own(state, 1, players[1]!.id)
    expect(() => lawOfficeTransfer(state, players[0]!.id, 1)).toThrow(EngineError)
  })

  it('jails a rival and charges the bribe to the bank', () => {
    const { state, players } = atLawOffice()
    const [a, b] = players
    const aCash = a!.cash
    const bankBefore = state.bank
    lawOfficeJail(state, a!.id, b!.id)
    expect(b!.inJail).toBe(true)
    expect(a!.cash).toBe(aCash - LAW_OFFICE_JAIL_FEE)
    expect(state.bank).toBe(bankBefore + LAW_OFFICE_JAIL_FEE)
    expect(state.turn.pendingLawOffice).toBe(false)
  })

  it('rejects jailing yourself', () => {
    const { state, players } = atLawOffice()
    expect(() => lawOfficeJail(state, players[0]!.id, players[0]!.id)).toThrow(EngineError)
  })

  it('buys a free-pass card into inventory', () => {
    const { state, players } = atLawOffice()
    const a = players[0]!
    const cash = a.cash
    lawOfficeFreepass(state, a.id, 'tax_free')
    expect(a.ownedCards).toHaveLength(1)
    expect(a.ownedCards[0]!.type).toBe('tax_free')
    expect(a.cash).toBe(cash - LAW_OFFICE_FREEPASS_PRICE)
    expect(state.turn.pendingLawOffice).toBe(false)
  })

  it('skips and clears the pending state', () => {
    const { state, players } = atLawOffice()
    lawOfficeSkip(state, players[0]!.id)
    expect(state.turn.pendingLawOffice).toBe(false)
  })

  it('rejects actions when the player is not at the Kantor Hukum', () => {
    const { state, players } = makeGame(2, { cash: 1_000_000_000 })
    state.currentPlayerIndex = 0
    expect(() => lawOfficeSkip(state, players[0]!.id)).toThrow(EngineError)
    expect(() => lawOfficeBuy(state, players[0]!.id, 1)).toThrow(EngineError)
  })
})
