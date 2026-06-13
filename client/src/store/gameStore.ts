import {
  HUSTLE_CARDS,
  KEJADIAN_CARDS,
  type AbilityType,
  type FinalStanding,
  type GameState,
  type MetaActionType,
  type NegotiationDeal,
  type PropertyTrack,
  type Role,
  type RoomSettings,
  type RupiahAmount,
  type TileId,
} from '@tuan-tanah/shared'
import { create } from 'zustand'
import { socket } from '../socket.js'

const HUSTLE_NAME = new Map(HUSTLE_CARDS.map((c) => [c.id, c.name]))
const KEJADIAN_NAME = new Map(KEJADIAN_CARDS.map((c) => [c.id, c.name]))

// Persist the player's seat so a refresh / brief disconnect can rejoin it.
const SESSION_KEY = 'tuan-tanah:session'

interface StoredSession {
  roomId: string
  playerId: string
}

function saveSession(roomId: string, playerId: string): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, playerId }))
  } catch {
    // storage unavailable (private mode / SSR) — degrade silently
  }
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (typeof parsed.roomId === 'string' && typeof parsed.playerId === 'string') {
      return { roomId: parsed.roomId, playerId: parsed.playerId }
    }
    return null
  } catch {
    return null
  }
}

function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

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
  finalStandings: FinalStanding[] | null
  incomingDeal: NegotiationDeal | null

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
  upgrade: (tileId: TileId, track?: PropertyTrack) => void
  sell: (tileId: TileId) => void
  metaAction: (action: MetaActionType, targetId?: string, tileId?: TileId) => void
  useAbility: (ability: AbilityType) => void
  takePinjol: (amount: RupiahAmount, lenderId?: string) => void
  resolveDebt: (giveUp: boolean) => void
  payJail: () => void
  castVote: (targetId: string) => void
  endTurn: () => void
  proposeDeal: (deal: NegotiationDeal) => void
  respondDeal: (dealId: string, accept: boolean) => void
  dismissIncomingDeal: () => void
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
  finalStandings: null,
  incomingDeal: null,

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
    // Reclaim a persisted seat after a refresh or reconnect. Fires on the initial
    // connect and on every socket.io auto-reconnect; rejoin is idempotent server-side.
    const attemptRejoin = () => {
      const saved = loadSession()
      if (!saved) return
      socket.emit('rejoin', saved, (res) => {
        if (res.ok) set({ roomId: res.data.roomId, playerId: res.data.playerId })
        else {
          clearStoredSession()
          set({ roomId: null, playerId: null, state: null })
        }
      })
    }

    socket.on('connect', () => {
      set({ connected: true })
      attemptRejoin()
    })
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
    socket.on('game_over', ({ finalStandings }) => set({ finalStandings }))
    socket.on('deal_proposed', ({ deal }) => {
      // Only the target needs to respond; ignore offers addressed to others.
      if (deal.toPlayerId === get().playerId) set({ incomingDeal: deal })
    })

    // autoConnect may have already fired 'connect' before this listener was registered.
    if (socket.connected) attemptRejoin()
  },

  join: (playerName, roomId) => {
    set({ joining: true, error: null, finalStandings: null })
    socket.emit('join_room', { roomId: roomId ?? '', playerName }, (res) => {
      set({ joining: false })
      if (res.ok) {
        set({ roomId: res.data.roomId, playerId: res.data.playerId })
        saveSession(res.data.roomId, res.data.playerId)
      } else set({ error: res.error })
    })
  },

  pickRole: (role) => socket.emit('pick_role', { role }),
  updateSettings: (settings) => socket.emit('update_settings', { settings }),
  startGame: () => socket.emit('start_game'),
  roll: () => socket.emit('roll_dice'),
  buy: (tileId) => socket.emit('buy_property', { tileId }),
  upgrade: (tileId, track) => socket.emit('upgrade_property', { tileId, track }),
  sell: (tileId) => socket.emit('sell_property', { tileId }),
  metaAction: (action, targetId, tileId) =>
    socket.emit('meta_action', { action, targetId, tileId }),
  useAbility: (ability) => socket.emit('use_ability', { ability }),
  takePinjol: (amount, lenderId) => socket.emit('take_pinjol', { amount, lenderId }),
  resolveDebt: (giveUp) => socket.emit('resolve_debt', { giveUp }),
  payJail: () => socket.emit('pay_jail'),
  castVote: (targetId) => socket.emit('cast_vote', { targetId }),
  endTurn: () => socket.emit('end_turn'),
  proposeDeal: (deal) => socket.emit('propose_deal', { deal }),
  respondDeal: (dealId, accept) => socket.emit('respond_deal', { dealId, accept }),
  dismissIncomingDeal: () => set({ incomingDeal: null }),
  clearError: () => set({ error: null }),
  dismissCard: () => set({ lastCard: null }),
}))

export const formatRupiah = (n: RupiahAmount): string =>
  `Rp ${Math.round(n).toLocaleString('id-ID')}`
