import type { GameState } from '@tuan-tanah/shared'
import { castVote, performMetaAction } from '../engine/actions.js'
import {
  buildLahan,
  buyProperty,
  downgradeProperty,
  endTurn,
  lawOfficeBuy,
  lawOfficeFreepass,
  lawOfficeJail,
  lawOfficeSkip,
  lawOfficeTransfer,
  payJail,
  proposeDeal,
  repayPinjol,
  resolveDebt,
  respondToDeal,
  rollDice,
  sellProperty,
  takeLoan,
  upgradeProperty,
  useAbility,
} from '../engine/index.js'
import { mutateRoom } from '../rooms.js'
import type { GameStore } from '../store.js'
import { broadcastState, guard, requireSession, type TTServer, type TTSocket } from './common.js'
import { concludeIfWon } from './gameOver.js'

/**
 * Run an engine mutation and report which players it newly eliminated, so the
 * handler can emit `player_eliminated`. Diffing `isEliminated` here avoids
 * threading eliminated ids through every engine function.
 */
function runWithEliminations<T>(state: GameState, fn: () => T): { value: T; eliminated: string[] } {
  const before = state.players.filter((p) => p.isEliminated).map((p) => p.id)
  const value = fn()
  const eliminated = state.players
    .filter((p) => p.isEliminated && !before.includes(p.id))
    .map((p) => p.id)
  return { value, eliminated }
}

function emitEliminated(io: TTServer, roomId: string, ids: string[]): void {
  for (const id of ids) io.to(roomId).emit('player_eliminated', { playerId: id })
}

export function registerGameHandlers(io: TTServer, socket: TTSocket, store: GameStore): void {
  socket.on('roll_dice', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const { value: result, eliminated } = await mutateRoom(store, roomId, (state) =>
        runWithEliminations(state, () => rollDice(state, playerId)),
      )
      await broadcastState(io, store, roomId)
      emitEliminated(io, roomId, eliminated)
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
      await mutateRoom(store, roomId, (state) => buyProperty(state, playerId, payload.tileId))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('build_lahan', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) =>
        buildLahan(state, playerId, payload.tileId, payload.business),
      )
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('law_office_buy', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => lawOfficeBuy(state, playerId, payload.tileId))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('law_office_transfer', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      // A force-transfer shifts wealth between players, so a wealth win can trigger.
      await mutateRoom(store, roomId, (state) => lawOfficeTransfer(state, playerId, payload.tileId))
      await broadcastState(io, store, roomId)
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('law_office_jail', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) =>
        lawOfficeJail(state, playerId, payload.targetPlayerId),
      )
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('law_office_freepass', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => lawOfficeFreepass(state, playerId, payload.pass))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('law_office_skip', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => lawOfficeSkip(state, playerId))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('pay_jail', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => payJail(state, playerId))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('end_turn', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const { eliminated } = await mutateRoom(store, roomId, (state) =>
        runWithEliminations(state, () => endTurn(state, playerId)),
      )
      await broadcastState(io, store, roomId)
      emitEliminated(io, roomId, eliminated)
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('meta_action', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const { value: result, eliminated } = await mutateRoom(store, roomId, (state) =>
        runWithEliminations(state, () =>
          performMetaAction(state, {
            action: payload.action,
            playerId,
            targetId: payload.targetId,
            tileId: payload.tileId,
            depositAmount: payload.depositAmount,
          }),
        ),
      )
      await broadcastState(io, store, roomId)
      emitEliminated(io, roomId, eliminated)
      if (result.card) {
        io.to(roomId).emit('card_drawn', { type: 'hustle', card: result.card.cardId, playerId })
      }
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('cast_vote', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => castVote(state, playerId, payload.targetId))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('use_ability', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => useAbility(state, playerId, payload.ability))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('take_pinjol', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const { eliminated } = await mutateRoom(store, roomId, (state) =>
        runWithEliminations(state, () =>
          takeLoan(state, playerId, payload.amount, payload.lenderId),
        ),
      )
      await broadcastState(io, store, roomId)
      emitEliminated(io, roomId, eliminated)
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('sell_property', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const { eliminated } = await mutateRoom(store, roomId, (state) =>
        runWithEliminations(state, () => sellProperty(state, playerId, payload.tileId)),
      )
      await broadcastState(io, store, roomId)
      emitEliminated(io, roomId, eliminated)
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('resolve_debt', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const { eliminated } = await mutateRoom(store, roomId, (state) =>
        runWithEliminations(state, () => resolveDebt(state, playerId, payload.giveUp)),
      )
      await broadcastState(io, store, roomId)
      emitEliminated(io, roomId, eliminated)
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('propose_deal', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const deal = await mutateRoom(store, roomId, (state) =>
        proposeDeal(state, playerId, payload.deal),
      )
      await broadcastState(io, store, roomId)
      io.to(roomId).emit('deal_proposed', { deal })
    }),
  )

  socket.on('respond_deal', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) =>
        respondToDeal(state, playerId, payload.dealId, payload.accept),
      )
      await broadcastState(io, store, roomId)
      await concludeIfWon(io, store, roomId)
    }),
  )

  socket.on('upgrade_property', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) =>
        upgradeProperty(state, playerId, payload.tileId, payload.track),
      )
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('downgrade_property', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => downgradeProperty(state, playerId, payload.tileId))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('repay_pinjol', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => repayPinjol(state, playerId, payload.loanId))
      await broadcastState(io, store, roomId)
    }),
  )
}
