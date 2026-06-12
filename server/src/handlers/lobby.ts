import { addPlayer, pickRole, startGame, updateSettings } from '../engine/index.js'
import { createRoom, mutateRoom } from '../rooms.js'
import { clearSession, setSession } from '../sessions.js'
import type { GameStore } from '../store.js'
import { broadcastState, guard, requireSession, type TTServer, type TTSocket } from './common.js'

export function registerLobbyHandlers(io: TTServer, socket: TTSocket, store: GameStore): void {
  socket.on('join_room', async (payload, ack) => {
    try {
      const requested = payload.roomId?.trim().toUpperCase()
      let roomId = requested
      if (!roomId) {
        const room = await createRoom(store)
        roomId = room.roomId
      } else if (!(await store.has(roomId))) {
        ack?.({ ok: false, error: 'Room not found' })
        return
      }

      const player = await mutateRoom(store, roomId, (state) =>
        addPlayer(state, payload.playerName),
      )

      setSession(socket.id, { roomId, playerId: player.id })
      await socket.join(roomId)
      ack?.({ ok: true, data: { roomId, playerId: player.id } })
      socket.emit('room_joined', { roomId, playerId: player.id })
      await broadcastState(io, store, roomId)
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message ?? 'Could not join room' })
    }
  })

  socket.on('pick_role', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => pickRole(state, playerId, payload.role))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('update_settings', (payload) =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => updateSettings(state, playerId, payload.settings))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('start_game', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      await mutateRoom(store, roomId, (state) => startGame(state, playerId))
      await broadcastState(io, store, roomId)
    }),
  )

  socket.on('disconnect', () => {
    void guard(socket, async () => {
      const session = getSessionSafe(socket)
      if (!session) return
      const { roomId, playerId } = session
      await mutateRoom(store, roomId, (state) => {
        const p = state.players.find((x) => x.id === playerId)
        if (p) p.isConnected = false
      }).catch(() => undefined)
      clearSession(socket.id)
      await broadcastState(io, store, roomId)
    })
  })
}

function getSessionSafe(socket: TTSocket) {
  try {
    return requireSession(socket)
  } catch {
    return undefined
  }
}
