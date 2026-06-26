// Kantor Hukum (law office) subsystem — the landing-tile actions a player may take
// when they stop on Kantor Hukum, plus the force-buy auction those actions can open.
// Extracted from index.ts; re-exported there so the import surface is unchanged.
//
// Runtime helpers (EngineError, requireTurn, buyTile, sendToJail) are imported from
// ./index.js. index.ts re-exports this module, forming a cycle — safe because every
// such binding is used inside a function body (call time), never at module init.
import {
  LAW_OFFICE_FREEPASS_PRICE,
  LAW_OFFICE_JAIL_FEE,
  LAW_OFFICE_PRICE_MULT_MAX,
  LAW_OFFICE_PRICE_MULT_MIN,
  LAW_OFFICE_TRANSFER_RATE,
  REGIONS,
  rpP,
  tileP,
} from '@tuan-tanah/shared'
import type {
  GameState,
  PassType,
  PendingAuction,
  Player,
  RupiahAmount,
  TileId,
} from '@tuan-tanah/shared'
import { getTileDef } from './board.js'
import { tileValue } from './elimination.js'
import { buyTile, EngineError, requireTurn, sendToJail } from './index.js'
import { logKey, uid } from './util.js'

/** Guard a Kantor Hukum action: must be the current player, standing on the tile. */
function requireLawOffice(state: GameState, playerId: string): Player {
  const player = requireTurn(state, playerId)
  if (!state.turn.pendingLawOffice) throw new EngineError('core.notAtLawOffice')
  return player
}

/** Kantor Hukum: buy any unowned buyable tile remotely (normal price). */
export function lawOfficeBuy(state: GameState, playerId: string, tileId: TileId): void {
  const player = requireLawOffice(state, playerId)
  buyTile(state, player, tileId)
  state.turn.pendingLawOffice = false
}

/**
 * Kantor Hukum: open a force-buy auction for another player's property. The
 * opening bid is LAW_OFFICE_TRANSFER_RATE (70%) of the tile's invested value.
 * Nothing changes hands yet — the owner may defend by out-bidding (see
 * `placeAuctionBid`), and the auction resolves via `concedeAuction`. The table is
 * paused while `state.pendingAuction` is set.
 */
export function startLawOfficeAuction(state: GameState, playerId: string, tileId: TileId): void {
  const player = requireLawOffice(state, playerId)
  const def = getTileDef(tileId)
  if (def.type !== 'property' && def.type !== 'transport') {
    throw new EngineError('core.onlyPropertyTransfer')
  }
  const tile = state.tiles[tileId]
  if (!tile || tile.ownerId === null) throw new EngineError('core.tileUnowned')
  if (tile.ownerId === player.id) throw new EngineError('core.alreadyOwnTile')
  const owner = state.players.find((p) => p.id === tile.ownerId)
  if (!owner || owner.isEliminated) throw new EngineError('core.noActiveOwner')

  const openingBid = Math.round(tileValue(state, tile) * LAW_OFFICE_TRANSFER_RATE)
  if (player.cash < openingBid) throw new EngineError('core.notEnoughCashOpeningBid')

  state.pendingAuction = {
    tileId,
    attackerId: player.id,
    ownerId: owner.id,
    currentBid: openingBid,
    highBidderId: player.id,
    history: [{ playerId: player.id, amount: openingBid }],
    deadline: null,
  }
  state.turn.pendingLawOffice = false
  logKey(
    state,
    'core.auctionOpened',
    { name: player.name, tile: tileP(tileId), amount: rpP(openingBid), owner: owner.name },
    player.id,
  )
}

/** The auction participant whose turn it is to raise or concede (never the high bidder). */
function auctionToActId(auction: PendingAuction): string {
  return auction.highBidderId === auction.attackerId ? auction.ownerId : auction.attackerId
}

/**
 * Raise the standing bid in a live force-buy auction. Must be the to-act
 * participant (the one who isn't currently winning), the amount must strictly
 * exceed the current bid, and the bidder must hold enough cash to back it (cash is
 * only moved when the auction resolves). The bidder becomes the new high bidder.
 */
export function placeAuctionBid(state: GameState, playerId: string, amount: RupiahAmount): void {
  const auction = state.pendingAuction
  if (!auction) throw new EngineError('core.noActiveAuction')
  if (playerId !== auctionToActId(auction)) throw new EngineError('core.notYourBid')
  const player = state.players.find((p) => p.id === playerId)
  if (!player || player.isEliminated) throw new EngineError('core.cannotBid')
  if (!Number.isFinite(amount) || amount <= auction.currentBid) {
    throw new EngineError('core.bidTooLow', { amount: rpP(auction.currentBid) })
  }
  if (player.cash < amount) throw new EngineError('core.notEnoughCashBid')

  auction.currentBid = Math.round(amount)
  auction.highBidderId = playerId
  auction.history.push({ playerId, amount: auction.currentBid })
  logKey(
    state,
    'core.auctionBid',
    { name: player.name, amount: rpP(auction.currentBid), tile: tileP(auction.tileId) },
    playerId,
  )
}

/**
 * Stop bidding in a live force-buy auction. Only the to-act participant can
 * concede; the current high bidder wins. If the attacker wins they pay the owner
 * and take the tile (tier/track/multiplier carry over); if the owner wins they
 * keep the tile and pay their bid to the bank.
 */
export function concedeAuction(state: GameState, playerId: string): void {
  const auction = state.pendingAuction
  if (!auction) throw new EngineError('core.noActiveAuction')
  if (playerId !== auctionToActId(auction)) throw new EngineError('core.notBidding')
  resolveAuction(state)
}

/**
 * Timer-driven resolution: the to-act participant ran out of time, which counts as
 * a concede, so the current high bidder wins. No-op when no auction is live.
 */
export function resolveAuctionTimeout(state: GameState): void {
  resolveAuction(state)
}

/** Settle a force-buy auction in favour of the current high bidder, then clear it. */
function resolveAuction(state: GameState): void {
  const auction = state.pendingAuction
  if (!auction) return
  const tile = state.tiles[auction.tileId]
  const attacker = state.players.find((p) => p.id === auction.attackerId)
  const owner = state.players.find((p) => p.id === auction.ownerId)
  const bid = auction.currentBid
  state.pendingAuction = null

  // The tile may have changed hands or the owner left mid-pause in edge cases; in
  // that case there's nothing to transfer, so just drop the auction.
  if (!tile || !attacker || !owner) return

  if (auction.highBidderId === attacker.id) {
    attacker.cash -= bid
    owner.cash += bid
    tile.ownerId = attacker.id
    logKey(
      state,
      'core.auctionWon',
      { name: attacker.name, tile: tileP(auction.tileId), owner: owner.name, amount: rpP(bid) },
      attacker.id,
    )
  } else {
    owner.cash -= bid
    state.bank += bid
    logKey(
      state,
      'core.auctionDefended',
      { name: owner.name, tile: tileP(auction.tileId), amount: rpP(bid) },
      owner.id,
    )
  }
}

/** Kantor Hukum: pay a bribe to the bank to send another player to jail. */
export function lawOfficeJail(state: GameState, playerId: string, targetPlayerId: string): void {
  const player = requireLawOffice(state, playerId)
  if (targetPlayerId === playerId) throw new EngineError('core.cannotJailSelf')
  const target = state.players.find((p) => p.id === targetPlayerId)
  if (!target || target.isEliminated) throw new EngineError('core.invalidTarget')
  if (target.inJail) throw new EngineError('core.alreadyInJail')
  if (player.cash < LAW_OFFICE_JAIL_FEE) throw new EngineError('core.notEnoughCashBribe')

  player.cash -= LAW_OFFICE_JAIL_FEE
  state.bank += LAW_OFFICE_JAIL_FEE
  logKey(
    state,
    'core.jailBribe',
    { name: player.name, amount: rpP(LAW_OFFICE_JAIL_FEE), target: target.name },
    player.id,
  )
  sendToJail(state, target)
  state.turn.pendingLawOffice = false
}

/** Kantor Hukum: buy a single free-pass card (rent/tax/jail-free) into inventory. */
export function lawOfficeFreepass(state: GameState, playerId: string, pass: PassType): void {
  const player = requireLawOffice(state, playerId)
  if (pass !== 'rent_free' && pass !== 'tax_free' && pass !== 'jail_free') {
    throw new EngineError('core.invalidPassType')
  }
  if (player.cash < LAW_OFFICE_FREEPASS_PRICE) {
    throw new EngineError('core.notEnoughCashFreepass')
  }
  player.cash -= LAW_OFFICE_FREEPASS_PRICE
  state.bank += LAW_OFFICE_FREEPASS_PRICE
  player.ownedCards.push({ id: uid(), type: pass })
  state.turn.pendingLawOffice = false
  const label = pass.replace('_', '-')
  logKey(
    state,
    'core.boughtFreepass',
    { name: player.name, pass: label, amount: rpP(LAW_OFFICE_FREEPASS_PRICE) },
    player.id,
  )
}

/**
 * Kantor Hukum: permanently boost an owned tile's price by a ×2–×5 multiplier.
 * Cost = selected tile's current tileValue × multiplier (paid to the bank). For a
 * property tile the boost applies to every tile the player owns in that region; for
 * transport and Lahan Kosong (no region) it applies only to the selected tile. The
 * boost stacks multiplicatively and scales rent, passive income, and market value
 * (sell refund / force-transfer price) — a comeback lever for cheap-region owners.
 */
export function lawOfficePriceUpgrade(
  state: GameState,
  playerId: string,
  tileId: TileId,
  multiplier: number,
): void {
  const player = requireLawOffice(state, playerId)
  if (
    !Number.isInteger(multiplier) ||
    multiplier < LAW_OFFICE_PRICE_MULT_MIN ||
    multiplier > LAW_OFFICE_PRICE_MULT_MAX
  ) {
    throw new EngineError('core.invalidMultiplier', {
      min: LAW_OFFICE_PRICE_MULT_MIN,
      max: LAW_OFFICE_PRICE_MULT_MAX,
    })
  }
  const tile = state.tiles[tileId]
  if (!tile || tile.ownerId !== player.id) throw new EngineError('core.doNotOwnTile')
  const def = getTileDef(tileId)
  if (def.type !== 'property' && def.type !== 'transport' && def.type !== 'buildable_land') {
    throw new EngineError('core.tileNotUpgradable')
  }
  const cost = Math.round(tileValue(state, tile) * multiplier)
  if (player.cash < cost) throw new EngineError('core.notEnoughCashPriceUpgrade')
  player.cash -= cost
  state.bank += cost
  // A property upgrade boosts every tile the player owns in that region; transport and
  // Lahan Kosong (which have no region) only boost the single selected tile.
  if (def.type === 'property' && def.region) {
    for (const tid of REGIONS[def.region].tileIds) {
      const rt = state.tiles[tid]
      if (rt && rt.ownerId === player.id) rt.priceMultiplier *= multiplier
    }
  } else {
    tile.priceMultiplier *= multiplier
  }
  state.turn.pendingLawOffice = false
  if (def.type === 'property' && def.region) {
    logKey(
      state,
      'core.priceBoostRegion',
      {
        name: player.name,
        tile: tileP(tileId),
        mult: multiplier,
        total: tile.priceMultiplier,
        amount: rpP(cost),
      },
      player.id,
    )
  } else {
    logKey(
      state,
      'core.priceBoost',
      {
        name: player.name,
        tile: tileP(tileId),
        mult: multiplier,
        total: tile.priceMultiplier,
        amount: rpP(cost),
      },
      player.id,
    )
  }
}

/** Kantor Hukum: decline to act and leave the tile. */
export function lawOfficeSkip(state: GameState, playerId: string): void {
  const player = requireLawOffice(state, playerId)
  state.turn.pendingLawOffice = false
  logKey(state, 'core.lawOfficeSkip', { name: player.name }, player.id)
}
