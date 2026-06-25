import { LAW_OFFICE_TRANSFER_RATE } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import {
  EngineError,
  concedeAuction,
  placeAuctionBid,
  resolveAuctionTimeout,
  startLawOfficeAuction,
} from '../src/engine/index.js'
import { tileValue } from '../src/engine/elimination.js'
import { makeGame, own } from './helpers.js'

/**
 * A 2-player game with the current player (the attacker) parked on the Kantor
 * Hukum, and player B owning tile 1 (a tier-1 property) as the auction target.
 */
function auctionSetup(opts?: { ownerCash?: number; attackerCash?: number }) {
  const g = makeGame(2, { cash: 1_000_000_000 })
  g.state.currentPlayerIndex = 0
  g.state.turn.pendingLawOffice = true
  const [a, b] = g.players
  own(g.state, 1, b!.id, { track: 'property', tier: 1 })
  if (opts?.attackerCash != null) a!.cash = opts.attackerCash
  if (opts?.ownerCash != null) b!.cash = opts.ownerCash
  const opening = Math.round(tileValue(g.state, g.state.tiles[1]!) * LAW_OFFICE_TRANSFER_RATE)
  return { state: g.state, a: a!, b: b!, opening }
}

describe('Kantor Hukum force-buy auction', () => {
  it('opens an auction at 70% of invested value without transferring anything', () => {
    const { state, a, b, opening } = auctionSetup()
    const aCash = a.cash
    const bCash = b.cash
    startLawOfficeAuction(state, a.id, 1)

    expect(state.pendingAuction).toMatchObject({
      tileId: 1,
      attackerId: a.id,
      ownerId: b.id,
      currentBid: opening,
      highBidderId: a.id,
    })
    expect(state.turn.pendingLawOffice).toBe(false)
    // Nothing has moved yet.
    expect(state.tiles[1]!.ownerId).toBe(b.id)
    expect(a.cash).toBe(aCash)
    expect(b.cash).toBe(bCash)
  })

  it('alternates the high bidder as each side raises', () => {
    const { state, a, b, opening } = auctionSetup()
    startLawOfficeAuction(state, a.id, 1)

    placeAuctionBid(state, b.id, opening + 1_000_000) // owner defends
    expect(state.pendingAuction!.highBidderId).toBe(b.id)
    expect(state.pendingAuction!.currentBid).toBe(opening + 1_000_000)

    placeAuctionBid(state, a.id, opening + 2_000_000) // attacker re-raises
    expect(state.pendingAuction!.highBidderId).toBe(a.id)
    expect(state.pendingAuction!.currentBid).toBe(opening + 2_000_000)
    expect(state.pendingAuction!.history).toHaveLength(3)
  })

  it('rejects a bid that does not exceed the current bid', () => {
    const { state, a, b, opening } = auctionSetup()
    startLawOfficeAuction(state, a.id, 1)
    expect(() => placeAuctionBid(state, b.id, opening)).toThrow(EngineError)
    expect(() => placeAuctionBid(state, b.id, opening - 1)).toThrow(EngineError)
  })

  it('rejects a bid from the current high bidder or a non-participant', () => {
    const g = makeGame(3, { cash: 1_000_000_000 })
    g.state.currentPlayerIndex = 0
    g.state.turn.pendingLawOffice = true
    const [a, b, c] = g.players
    own(g.state, 1, b!.id, { track: 'property', tier: 1 })
    startLawOfficeAuction(g.state, a!.id, 1)
    const opening = g.state.pendingAuction!.currentBid

    // The attacker already leads — they can't bid against themselves.
    expect(() => placeAuctionBid(g.state, a!.id, opening + 1_000_000)).toThrow(EngineError)
    // An uninvolved player can't join the auction.
    expect(() => placeAuctionBid(g.state, c!.id, opening + 1_000_000)).toThrow(EngineError)
  })

  it('rejects a bid the bidder cannot afford', () => {
    // Owner can cover the (unused) opening but not a meaningful raise.
    const base = auctionSetup()
    const { state, a, b, opening } = base
    b.cash = opening + 500_000
    startLawOfficeAuction(state, a.id, 1)
    expect(() => placeAuctionBid(state, b.id, opening + 1_000_000)).toThrow(EngineError)
  })

  it('owner concedes with no defense → attacker wins at 70%, owner is paid', () => {
    const { state, a, b, opening } = auctionSetup()
    const aCash = a.cash
    const bCash = b.cash
    startLawOfficeAuction(state, a.id, 1)
    concedeAuction(state, b.id)

    expect(state.pendingAuction).toBeNull()
    expect(state.tiles[1]!.ownerId).toBe(a.id)
    expect(a.cash).toBe(aCash - opening)
    expect(b.cash).toBe(bCash + opening)
  })

  it('attacker concedes after owner defends → owner keeps the tile and pays the bank', () => {
    const { state, a, b, opening } = auctionSetup()
    const aCash = a.cash
    const bCash = b.cash
    const bank0 = state.bank
    startLawOfficeAuction(state, a.id, 1)

    const defense = opening + 3_000_000
    placeAuctionBid(state, b.id, defense) // owner out-bids
    concedeAuction(state, a.id) // attacker gives up

    expect(state.pendingAuction).toBeNull()
    expect(state.tiles[1]!.ownerId).toBe(b.id) // owner keeps it
    expect(a.cash).toBe(aCash) // attacker pays nothing
    expect(b.cash).toBe(bCash - defense) // owner pays the bank
    expect(state.bank).toBe(bank0 + defense)
  })

  it('only the to-act participant may concede', () => {
    const { state, a, b } = auctionSetup()
    startLawOfficeAuction(state, a.id, 1)
    // The attacker leads, so they cannot concede — only the owner (to act) can.
    expect(() => concedeAuction(state, a.id)).toThrow(EngineError)
    expect(() => concedeAuction(state, b.id)).not.toThrow()
  })

  it('a timeout resolves in favour of the current high bidder', () => {
    const { state, a, b, opening } = auctionSetup()
    const bCash = b.cash
    startLawOfficeAuction(state, a.id, 1)
    placeAuctionBid(state, b.id, opening + 1_000_000) // owner now leads
    resolveAuctionTimeout(state) // attacker stalls out

    expect(state.pendingAuction).toBeNull()
    expect(state.tiles[1]!.ownerId).toBe(b.id)
    expect(b.cash).toBe(bCash - (opening + 1_000_000))
  })
})
