import { performMetaAction } from '../engine/actions.js'
import { buyProperty, endTurn, payJail, rollDice, useAbility } from '../engine/index.js'
import { mutateRoom } from '../rooms.js'
import type { GameStore } from '../store.js'
import { broadcastState, guard, requireSession, type TTServer, type TTSocket } from './common.js'

const NOT_IMPLEMENTED = 'This action is not implemented yet'

export function registerGameHandlers(io: TTServer, socket: TTSocket, store: GameStore): void {
  socket.on('roll_dice', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const result = await mutateRoom(store, roomId, (state) => rollDice(state, playerId))
      await broadcastState(io, store, roomId)
      if (result.card) {
        io.to(roomId).emit('card_drawn', {
          type: result.card.type,
          card: result.card.card,
          playerId,
        })
      }
    }),
  )

  socket.on('buy_property', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => buyProperty(state, playerId, payload.tileId))
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
      await mutateRoom(store, roomId, (state) => endTurn(state, playerId))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('meta_action', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      const result = await mutateRoom(store, roomId, (state) =>
        performMetaAction(state, {
          action: payload.action,
          playerId,
          targetId: payload.targetId,
          tileId: payload.tileId,
        }),
      )
      await broadcastState(io, store, roomId)
      if (result.card) {
        io.to(roomId).emit('card_drawn', { type: 'hustle', card: result.card.cardId, playerId })
      }
    }),
  )

  socket.on('use_ability', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => useAbility(state, playerId, payload.ability))
      await broadcastState(io, store, roomId)
    }),
  )

  // ---- Not yet implemented (later milestones) ----
  const notImplemented = () => socket.emit('error', { message: NOT_IMPLEMENTED })
  socket.on('upgrade_property', notImplemented)
  socket.on('take_pinjol', notImplemented)
  socket.on('propose_deal', notImplemented)
  socket.on('respond_deal', notImplemented)
  socket.on('sell_property', notImplemented)
}
