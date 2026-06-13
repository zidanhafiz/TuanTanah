import { randomUUID } from 'node:crypto'
import {
  addPlayer,
  forfeit,
  pickRole,
  removePlayer,
  setConnected,
  startGame,
  updateSettings,
} from '../engine/index.js'
import { createRoom, mutateRoom } from '../rooms.js'
import { clearSession, setSession } from '../sessions.js'
import type { GameStore } from '../store.js'
import { broadcastState, guard, requireSession, type TTServer, type TTSocket } from './common.js'
import { concludeIfWon, scheduleTimeLimit } from './gameOver.js'

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

      const { player, token } = await mutateRoom(store, roomId, (state) => {
        const player = addPlayer(state, payload.playerName)
        const token = randomUUID()
        state.reconnectTokens ??= {}
        state.reconnectTokens[player.id] = token
        return { player, token }
      })

      setSession(socket.id, { roomId, playerId: player.id })
      await socket.join(roomId)
      ack?.({ ok: true, data: { roomId, playerId: player.id, token } })
      socket.emit('room_joined', { roomId, playerId: player.id })
      await broadcastState(io, store, roomId)
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message ?? 'Could not join room' })
    }
  })

  socket.on('rejoin', async (payload, ack) => {
    try {
      const roomId = payload.roomId?.trim().toUpperCase()
      if (!roomId || !(await store.has(roomId))) {
        ack?.({ ok: false, error: 'Room not found' })
        return
      }

      const found = await mutateRoom(store, roomId, (state) => {
        if (!state.players.some((p) => p.id === payload.playerId)) return false
        // Require the secret token — a known playerId alone (it's broadcast to
        // every client) must not be enough to reclaim a seat.
        if (state.reconnectTokens?.[payload.playerId] !== payload.token) return false
        setConnected(state, payload.playerId, true)
        return true
      })
      if (!found) {
        ack?.({ ok: false, error: 'Could not restore session' })
        return
      }

      setSession(socket.id, { roomId, playerId: payload.playerId })
      await socket.join(roomId)
      ack?.({ ok: true, data: { roomId, playerId: payload.playerId, token: payload.token } })
      socket.emit('room_joined', { roomId, playerId: payload.playerId })
      await broadcastState(io, store, roomId)
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message ?? 'Could not rejoin' })
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
      await scheduleTimeLimit(io, store, roomId)
    }),
  )

  socket.on('leave_room', () =>
    guard(socket, async () => {
      const { roomId, playerId } = requireSession(socket)
      // Lobby leave removes the seat; leaving a live game forfeits (eliminates)
      // so the rest can keep playing. Once the game has ended there's nothing to
      // forfeit — just release the seat's token.
      const wasPlaying = await mutateRoom(store, roomId, (state) => {
        const playing = state.phase === 'playing'
        if (state.phase === 'lobby') removePlayer(state, playerId)
        else if (playing) forfeit(state, playerId)
        if (state.reconnectTokens) delete state.reconnectTokens[playerId]
        return playing
      })
      clearSession(socket.id)
      await socket.leave(roomId)
      await broadcastState(io, store, roomId)
      if (wasPlaying) {
        io.to(roomId).emit('player_eliminated', { playerId })
        await concludeIfWon(io, store, roomId)
      }
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
