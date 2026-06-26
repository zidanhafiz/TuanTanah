import {
  buildLahan,
  buyProperty,
  concedeAuction,
  devTeleport,
  downgradeProperty,
  endTurn,
  forceLoan,
  lawOfficeBuy,
  lawOfficeFreepass,
  lawOfficeJail,
  lawOfficePriceUpgrade,
  lawOfficeSkip,
  payJail,
  placeAuctionBid,
  proposeDeal,
  repayPinjol,
  resolveDebt,
  respondToDeal,
  rollDice,
  sellProperty,
  startLawOfficeAuction,
  takeLoan,
  upgradeProperty,
  useAbility,
} from '../engine/index.js'
import { castVote, performMetaAction } from '../engine/actions.js'
import { isDev } from '../bootstrap/env.js'
import { mutateRoom } from '../rooms/rooms.js'
import type { GameStore } from '../rooms/store.js'
import { broadcastAndArm, clearAuctionTimer } from './afk.js'
import { guard, requireSession, type TTServer, type TTSocket } from './common.js'
import { concludeIfWon } from './gameOver.js'
import { mutateAndArmAuction, mutateAndBroadcast, mutateWithEliminations } from './mutations.js'

export function registerGameHandlers(io: TTServer, socket: TTSocket, store: GameStore): void {
  socket.on('roll_dice', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const result = await mutateWithEliminations(io, store, roomId, (state) =>
        rollDice(state, playerId),
      )
      if (result.card) {
        io.to(roomId).emit('card_drawn', {
          type: result.card.type,
          card: result.card.card,
          playerId,
        })
      }
      if (result.rent) io.to(roomId).emit('rent_paid', result.rent)
      await concludeIfWon(io, store, roomId)
    }),
  )

  // DEV-only: jump the current player to a tile and resolve it (no dice). Mirrors
  // the roll_dice side-effects (card/rent/elimination); ignored in production.
  socket.on('dev_teleport', (payload) =>
    guard(socket, async () => {
      if (!isDev) return
      const { roomId, playerId } = requireSession(socket)
      const result = await mutateWithEliminations(io, store, roomId, (state) =>
        devTeleport(state, playerId, payload.tileId),
      )
      if (result.card) {
        io.to(roomId).emit('card_drawn', {
          type: result.card.type,
          card: result.card.card,
          playerId,
        })
      }
      if (result.rent) io.to(roomId).emit('rent_paid', result.rent)
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('buy_property', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        buyProperty(state, playerId, payload.tileId),
      )
    }),
  )

  socket.on('build_lahan', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        buildLahan(state, playerId, payload.tileId, payload.business),
      )
    }),
  )

  socket.on('law_office_buy', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        lawOfficeBuy(state, playerId, payload.tileId),
      )
    }),
  )

  socket.on('law_office_transfer', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      // Opens a force-buy auction; nothing changes hands until it resolves. Arm the
      // auction clock first so the broadcast carries its deadline, then broadcast
      // (which disarms the normal turn clock while the table is paused).
      await mutateAndArmAuction(io, store, roomId, (state) =>
        startLawOfficeAuction(state, playerId, payload.tileId),
      )
    }),
  )

  socket.on('auction_bid', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      // Re-arm the clock for the new responder, then broadcast the fresh deadline.
      await mutateAndArmAuction(io, store, roomId, (state) =>
        placeAuctionBid(state, playerId, payload.amount),
      )
    }),
  )

  socket.on('auction_concede', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      // Resolving the auction shifts wealth, so a wealth win can trigger. Clear the
      // auction timer before broadcasting (the table un-pauses), then re-check the win.
      await mutateRoom(store, roomId, (state) => concedeAuction(state, playerId))
      clearAuctionTimer(roomId)
      await broadcastAndArm(io, store, roomId)
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('law_office_jail', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        lawOfficeJail(state, playerId, payload.targetPlayerId),
      )
    }),
  )

  socket.on('law_office_freepass', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        lawOfficeFreepass(state, playerId, payload.pass),
      )
    }),
  )

  socket.on('law_office_upgrade_price', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        lawOfficePriceUpgrade(state, playerId, payload.tileId, payload.multiplier),
      )
    }),
  )

  socket.on('law_office_skip', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) => lawOfficeSkip(state, playerId))
    }),
  )

  socket.on('pay_jail', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) => payJail(state, playerId))
    }),
  )

  socket.on('end_turn', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateWithEliminations(io, store, roomId, (state) => endTurn(state, playerId))
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('meta_action', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const result = await mutateWithEliminations(io, store, roomId, (state) =>
        performMetaAction(state, {
          action: payload.action,
          playerId,
          targetId: payload.targetId,
          tileId: payload.tileId,
          depositAmount: payload.depositAmount,
        }),
      )
      if (result.card) {
        io.to(roomId).emit('card_drawn', { type: 'hustle', card: result.card.cardId, playerId })
      }
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('cast_vote', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        castVote(state, playerId, payload.targetId),
      )
    }),
  )

  socket.on('use_ability', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        useAbility(state, playerId, payload.ability),
      )
    }),
  )

  socket.on('take_pinjol', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateWithEliminations(io, store, roomId, (state) =>
        takeLoan(state, playerId, payload.amount, payload.lenderId),
      )
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('force_pinjol', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        forceLoan(state, playerId, payload.targetId, payload.amount),
      )
      // Funding the loan moves cash from the Rentenir to the target and can lift the
      // target's wealth across the target threshold; re-check the win condition.
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('sell_property', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateWithEliminations(io, store, roomId, (state) =>
        sellProperty(state, playerId, payload.tileId),
      )
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('resolve_debt', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateWithEliminations(io, store, roomId, (state) =>
        resolveDebt(state, playerId, payload.giveUp),
      )
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('propose_deal', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const deal = await mutateAndBroadcast(io, store, roomId, (state) =>
        proposeDeal(state, playerId, payload.deal),
      )
      io.to(roomId).emit('deal_proposed', { deal })
    }),
  )

  socket.on('respond_deal', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      // Accepting a deal can settle a debtor's debt and even eliminate a player
      // (e.g. a seller who is still short after the sale), so run with eliminations.
      await mutateWithEliminations(io, store, roomId, (state) =>
        respondToDeal(state, playerId, payload.dealId, payload.accept),
      )
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('upgrade_property', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        upgradeProperty(state, playerId, payload.tileId, payload.track),
      )
    }),
  )

  socket.on('downgrade_property', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateWithEliminations(io, store, roomId, (state) =>
        downgradeProperty(state, playerId, payload.tileId),
      )
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('repay_pinjol', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateAndBroadcast(io, store, roomId, (state) =>
        repayPinjol(state, playerId, payload.loanId),
      )
      // Repaying credits the loan amount to the lender's cash, which can tip the
      // lender across the wealth target (the win check evaluates the richest
      // active player, not just the actor). No elimination machinery is needed:
      // repayPinjol requires the payer to fully afford the repayment, so it can
      // never create a debt/charge that bankrupts anyone.
      await concludeIfWon(io, store, roomId)
    }),
  )
}
