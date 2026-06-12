import {
  HUSTLE_CARDS,
  KEJADIAN_CARDS,
  type GameState,
  type Role,
  type RoomSettings,
  type RupiahAmount,
  type TileId,
} from '@tuan-tanah/shared'
import { create } from 'zustand'
import { socket } from '../socket.js'

const HUSTLE_NAME = new Map(HUSTLE_CARDS.map((c) => [c.id, c.name]))
const KEJADIAN_NAME = new Map(KEJADIAN_CARDS.map((c) => [c.id, c.name]))

export interface DrawnCard {
  type: 'kejadian' | 'hustle'
  cardId: string
  name: string
  playerId: string
  at: number
}

interface GameStore {
  connected: boolean
  roomId: string | null
  playerId: string | null
  state: GameState | null
  error: string | null
  joining: boolean
  lastCard: DrawnCard | null

  // derived
  me: () => GameState['players'][number] | null
  isMyTurn: () => boolean

  // actions
  init: () => void
  join: (playerName: string, roomId?: string) => void
  pickRole: (role: Role | null) => void
  updateSettings: (settings: Partial<RoomSettings>) => void
  startGame: () => void
  roll: () => void
  buy: (tileId: TileId) => void
  payJail: () => void
  endTurn: () => void
  clearError: () => void
  dismissCard: () => void
}

export const useGame = create<GameStore>((set, get) => ({
  connected: socket.connected,
  roomId: null,
  playerId: null,
  state: null,
  error: null,
  joining: false,
  lastCard: null,

  me: () => {
    const { state, playerId } = get()
    return state?.players.find((p) => p.id === playerId) ?? null
  },
  isMyTurn: () => {
    const { state, playerId } = get()
    if (!state || state.phase !== 'playing') return false
    return state.players[state.currentPlayerIndex]?.id === playerId
  },

  init: () => {
    socket.on('connect', () => set({ connected: true }))
    socket.on('disconnect', () => set({ connected: false }))
    socket.on('game_state', (state) => set({ state }))
    socket.on('room_joined', ({ roomId, playerId }) => set({ roomId, playerId }))
    socket.on('error', ({ message }) => set({ error: message }))
    socket.on('card_drawn', ({ type, card, playerId }) => {
      const name = type === 'hustle' ? HUSTLE_NAME.get(card) : KEJADIAN_NAME.get(card)
      set({
        lastCard: { type, cardId: card, name: name ?? card, playerId, at: Date.now() },
      })
    })
  },

  join: (playerName, roomId) => {
    set({ joining: true, error: null })
    socket.emit('join_room', { roomId: roomId ?? '', playerName }, (res) => {
      set({ joining: false })
      if (res.ok) set({ roomId: res.data.roomId, playerId: res.data.playerId })
      else set({ error: res.error })
    })
  },

  pickRole: (role) => socket.emit('pick_role', { role }),
  updateSettings: (settings) => socket.emit('update_settings', { settings }),
  startGame: () => socket.emit('start_game'),
  roll: () => socket.emit('roll_dice'),
  buy: (tileId) => socket.emit('buy_property', { tileId }),
  payJail: () => socket.emit('pay_jail'),
  endTurn: () => socket.emit('end_turn'),
  clearError: () => set({ error: null }),
  dismissCard: () => set({ lastCard: null }),
}))

export const formatRupiah = (n: RupiahAmount): string => `Rp ${Math.round(n).toLocaleString('id-ID')}`
