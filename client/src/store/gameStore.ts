import {
  HUSTLE_CARDS,
  KEJADIAN_CARDS,
  type AbilityType,
  type FinalStanding,
  type GameState,
  type LandBusiness,
  type MetaActionType,
  type NegotiationDeal,
  type PassType,
  type PropertyTrack,
  type Role,
  type RoomSettings,
  type RupiahAmount,
  type TileId,
} from '@tuan-tanah/shared'
import { create } from 'zustand'
import { onResync } from '../lib/resync.js'
import {
  type ClientSocket,
  createSocket,
  getActiveSocket,
  setActiveSocket,
  socket,
} from '../socket.js'
import { audio, playSound, playStateSounds } from '../sound/index.js'
import {
  isRollAnimStuck,
  noteIncomingState,
  playOnMoveSettled,
  reconcileRollAnim,
  resetRollAnim,
} from './rollAnimation.js'

const HUSTLE_NAME = new Map(HUSTLE_CARDS.map((c) => [c.id, c.name]))
const KEJADIAN_NAME = new Map(KEJADIAN_CARDS.map((c) => [c.id, c.name]))

// Hotseat only: the current player at the last broadcast, so we hand control to
// the next player exactly once per turn change (not on every broadcast).
let lastCurrentPlayerId: string | null = null

// Persist the player's seat so a refresh / brief disconnect can rejoin it.
const SESSION_KEY = 'tuan-tanah:session'

interface StoredSession {
  roomId: string
  playerId: string
  // Secret reconnect credential issued by the server at join. Without it the
  // server rejects a rejoin, so a known playerId can't be used to steal a seat.
  token: string
}

function saveSession(roomId: string, playerId: string, token: string): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, playerId, token }))
  } catch {
    // storage unavailable (private mode / SSR) — degrade silently
  }
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (
      typeof parsed.roomId === 'string' &&
      typeof parsed.playerId === 'string' &&
      typeof parsed.token === 'string'
    ) {
      return { roomId: parsed.roomId, playerId: parsed.playerId, token: parsed.token }
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

/**
 * One controlled player in dev hotseat mode. Each seat holds its own live
 * connection (its own server session); `selectSeat` repoints the active socket
 * to whichever seat we're acting as. See `pages/DevMultiplayer.tsx`.
 */
export interface HotseatSeat {
  playerId: string
  name: string
  socket: ClientSocket
}

interface GameStore {
  connected: boolean
  roomId: string | null
  playerId: string | null
  state: GameState | null
  error: string | null
  joining: boolean
  // True while an automatic rejoin (reconnect) is in flight, so the UI can show
  // "Reconnecting…" instead of a join form for a seat we're reclaiming.
  rejoining: boolean
  lastCard: DrawnCard | null
  finalStandings: FinalStanding[] | null
  incomingDeal: NegotiationDeal | null

  // dev hotseat (pass-and-play) — inert unless `hotseat` is enabled
  hotseat: boolean
  seats: HotseatSeat[]
  activeSeatId: string | null
  autoFollowTurn: boolean

  // derived
  me: () => GameState['players'][number] | null
  isMyTurn: () => boolean

  // actions
  init: () => void
  join: (playerName: string, roomId?: string, onJoined?: (roomId: string) => void) => void
  leave: () => void
  surrender: () => void
  pickRole: (role: Role | null) => void
  updateSettings: (settings: Partial<RoomSettings>) => void
  startGame: () => void
  roll: () => void
  buy: (tileId: TileId) => void
  upgrade: (tileId: TileId, track?: PropertyTrack) => void
  downgrade: (tileId: TileId) => void
  sell: (tileId: TileId) => void
  buildLahan: (tileId: TileId, business: LandBusiness) => void
  lawOfficeBuy: (tileId: TileId) => void
  lawOfficeTransfer: (tileId: TileId) => void
  lawOfficeJail: (targetPlayerId: string) => void
  lawOfficeFreepass: (pass: PassType) => void
  lawOfficePriceUpgrade: (tileId: TileId, multiplier: number) => void
  lawOfficeSkip: () => void
  metaAction: (
    action: MetaActionType,
    targetId?: string,
    tileId?: TileId,
    depositAmount?: RupiahAmount,
  ) => void
  useAbility: (ability: AbilityType) => void
  takePinjol: (amount: RupiahAmount, lenderId?: string) => void
  repayPinjol: (loanId?: string) => void
  resolveDebt: (giveUp: boolean) => void
  payJail: () => void
  castVote: (targetId: string) => void
  endTurn: () => void
  proposeDeal: (deal: NegotiationDeal) => void
  respondDeal: (dealId: string, accept: boolean) => void
  dismissIncomingDeal: () => void
  clearError: () => void
  dismissCard: () => void

  // dev hotseat actions
  devTeleport: (tileId: TileId) => void
  enableHotseat: () => void
  hotseatAddPlayer: (name: string) => void
  selectSeat: (playerId: string) => void
  hotseatReset: () => void
}

export const useGame = create<GameStore>((set, get) => ({
  connected: socket.connected,
  roomId: null,
  playerId: null,
  state: null,
  error: null,
  joining: false,
  // Start in "reconnecting" if a saved seat exists — init() will attempt a rejoin
  // on connect, and we want the first paint to reflect that rather than flashing
  // a join form.
  rejoining: loadSession() !== null,
  lastCard: null,
  finalStandings: null,
  incomingDeal: null,

  hotseat: false,
  seats: [],
  activeSeatId: null,
  autoFollowTurn: true,

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
    // Build + preload the sound effects and arm the autoplay-unlock listeners.
    audio.preload()

    // Reclaim a persisted seat after a refresh or reconnect. Fires on the initial
    // connect and on every socket.io auto-reconnect; rejoin is idempotent server-side.
    const attemptRejoin = () => {
      const saved = loadSession()
      if (!saved) {
        set({ rejoining: false })
        return
      }
      set({ rejoining: true })
      // Always on the primary socket — it owns the persisted (seat-1) session.
      socket.emit('rejoin', saved, (res) => {
        if (res.ok) {
          saveSession(res.data.roomId, res.data.playerId, res.data.token)
          set({ roomId: res.data.roomId, playerId: res.data.playerId, rejoining: false })
        } else {
          clearStoredSession()
          set({ roomId: null, playerId: null, state: null, rejoining: false })
        }
      })
    }

    socket.on('connect', () => {
      set({ connected: true })
      attemptRejoin()
    })
    socket.on('disconnect', () => set({ connected: false }))
    socket.on('game_state', (state) => {
      // Drive the dice→move→reveal cinematic from the moment state lands, before
      // React re-renders, so token effects never read a stale animation phase.
      noteIncomingState(state)
      // React to what changed (buy/sell/your-turn) by diffing against the prior
      // authoritative state. Dice/land sounds come from the roll cinematic.
      playStateSounds(get().state, state, get().playerId)
      set({ state })
      // Hotseat: when the turn passes to a new player, hand control to that
      // player's seat (unless the tester pinned a seat by turning auto-follow off).
      const s = get()
      if (s.hotseat) {
        const current = state.players[state.currentPlayerIndex]
        if (current && current.id !== lastCurrentPlayerId) {
          lastCurrentPlayerId = current.id
          if (s.autoFollowTurn && s.seats.some((seat) => seat.playerId === current.id)) {
            s.selectSeat(current.id)
          }
        }
      }
    })
    socket.on('room_joined', ({ roomId, playerId }) => set({ roomId, playerId }))
    socket.on('error', ({ message }) => {
      playSound('error')
      set({ error: message })
    })
    socket.on('card_drawn', ({ type, card, playerId }) => {
      // Heard as the card flips open (on token arrival), not mid-walk.
      playOnMoveSettled('card')
      const name = type === 'hustle' ? HUSTLE_NAME.get(card) : KEJADIAN_NAME.get(card)
      set({
        lastCard: { type, cardId: card, name: name ?? card, playerId, at: Date.now() },
      })
    })
    socket.on('player_eliminated', () => playSound('eliminated'))
    socket.on('game_over', ({ finalStandings }) => {
      playSound('gameOver')
      set({ finalStandings })
    })
    socket.on('deal_proposed', ({ deal }) => {
      const s = get()
      // Hotseat: we control every seat, so focus the responder and pop their modal.
      if (s.hotseat) {
        if (s.seats.some((seat) => seat.playerId === deal.toPlayerId)) {
          s.selectSeat(deal.toPlayerId)
          set({ incomingDeal: deal })
        }
        return
      }
      // Only the target needs to respond; ignore offers addressed to others.
      if (deal.toPlayerId === s.playerId) set({ incomingDeal: deal })
    })

    // Resync the UI with the server when the page returns to the foreground, and
    // also on user interaction as a fallback (some setups don't fire focus/
    // visibility reliably). A backgrounded tab freezes requestAnimationFrame and
    // throttles timers, so in-flight animations stall and broadcasts can be missed
    // without ever disconnecting (so no auto-rejoin fires). Always re-request
    // authoritative state — that's cheap and read-only. Only force-reset the roll
    // cinematic on a true reactivation, or on a click when it actually looks stuck,
    // so clicking during a healthy animation doesn't cut it short.
    onResync((viaInteraction) => {
      if (!socket.connected || !get().roomId) return
      if (!viaInteraction || isRollAnimStuck()) reconcileRollAnim()
      socket.emit('request_state')
    })

    // autoConnect may have already fired 'connect' before this listener was registered.
    if (socket.connected) attemptRejoin()
  },

  join: (playerName, roomId, onJoined) => {
    set({ joining: true, error: null, finalStandings: null })
    getActiveSocket().emit('join_room', { roomId: roomId ?? '', playerName }, (res) => {
      set({ joining: false })
      if (res.ok) {
        set({ roomId: res.data.roomId, playerId: res.data.playerId })
        saveSession(res.data.roomId, res.data.playerId, res.data.token)
        onJoined?.(res.data.roomId)
      } else set({ error: res.error })
    })
  },

  leave: () => {
    // Deliberate exit — tell the server (removes our seat in lobby, forfeits
    // in-game), then drop the local session so we don't auto-rejoin.
    getActiveSocket().emit('leave_room')
    clearStoredSession()
    resetRollAnim()
    set({ roomId: null, playerId: null, state: null, finalStandings: null, rejoining: false })
  },

  surrender: () => {
    // Give up but stay in the room — the server eliminates us while keeping our
    // session, so we keep receiving state and watch the rest of the game.
    getActiveSocket().emit('surrender')
  },

  // `click` gives instant local feedback on button-driven actions; the louder,
  // everyone-hears effects (dice, buy/sell, card) come from the broadcast path.
  pickRole: (role) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('pick_role', { role })
  },
  updateSettings: (settings) => getActiveSocket().emit('update_settings', { settings }),
  startGame: () => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('start_game')
  },
  roll: () => getActiveSocket().emit('roll_dice'),
  buy: (tileId) => getActiveSocket().emit('buy_property', { tileId }),
  upgrade: (tileId, track) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('upgrade_property', { tileId, track })
  },
  downgrade: (tileId) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('downgrade_property', { tileId })
  },
  sell: (tileId) => getActiveSocket().emit('sell_property', { tileId }),
  buildLahan: (tileId, business) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('build_lahan', { tileId, business })
  },
  lawOfficeBuy: (tileId) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('law_office_buy', { tileId })
  },
  lawOfficeTransfer: (tileId) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('law_office_transfer', { tileId })
  },
  lawOfficeJail: (targetPlayerId) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('law_office_jail', { targetPlayerId })
  },
  lawOfficeFreepass: (pass) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('law_office_freepass', { pass })
  },
  lawOfficePriceUpgrade: (tileId, multiplier) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('law_office_upgrade_price', { tileId, multiplier })
  },
  lawOfficeSkip: () => getActiveSocket().emit('law_office_skip'),
  metaAction: (action, targetId, tileId, depositAmount) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('meta_action', { action, targetId, tileId, depositAmount })
  },
  useAbility: (ability) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('use_ability', { ability })
  },
  takePinjol: (amount, lenderId) => getActiveSocket().emit('take_pinjol', { amount, lenderId }),
  repayPinjol: (loanId) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('repay_pinjol', { loanId })
  },
  resolveDebt: (giveUp) => getActiveSocket().emit('resolve_debt', { giveUp }),
  payJail: () => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('pay_jail')
  },
  castVote: (targetId) => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('cast_vote', { targetId })
  },
  endTurn: () => {
    playSound('click', { volume: 0.5 })
    getActiveSocket().emit('end_turn')
  },
  proposeDeal: (deal) => getActiveSocket().emit('propose_deal', { deal }),
  respondDeal: (dealId, accept) => getActiveSocket().emit('respond_deal', { dealId, accept }),
  dismissIncomingDeal: () => set({ incomingDeal: null }),
  clearError: () => set({ error: null }),
  dismissCard: () => set({ lastCard: null }),

  // ----- dev hotseat (pass-and-play) -----
  devTeleport: (tileId) => getActiveSocket().emit('dev_teleport', { tileId }),
  enableHotseat: () => {
    lastCurrentPlayerId = null
    set({ hotseat: true })
  },

  hotseatAddPlayer: (name) => {
    const { seats, roomId, join } = get()
    if (seats.length === 0) {
      // Seat 1 rides the primary socket via the normal join (creates the room).
      join(name, undefined, () => {
        const playerId = get().playerId
        if (!playerId) return
        setActiveSocket(socket)
        set({ seats: [{ playerId, name, socket }], activeSeatId: playerId })
      })
      return
    }
    // Additional seats each get their own independent connection → own session.
    const conn = createSocket()
    const joinRoom = () => {
      conn.emit('join_room', { roomId: roomId ?? '', playerName: name }, (res) => {
        if (!res.ok) {
          set({ error: res.error })
          conn.disconnect()
          return
        }
        // Server sends `error` only to the offending socket, so each seat must
        // listen on its own connection to surface its action errors.
        conn.on('error', ({ message }) => set({ error: message }))
        set({ seats: [...get().seats, { playerId: res.data.playerId, name, socket: conn }] })
      })
    }
    if (conn.connected) joinRoom()
    else conn.once('connect', joinRoom)
  },

  selectSeat: (playerId) => {
    const seat = get().seats.find((s) => s.playerId === playerId)
    if (!seat) return
    setActiveSocket(seat.socket)
    set({ activeSeatId: playerId, playerId })
  },

  hotseatReset: () => {
    // Tear down the extra connections; keep the primary (it's the app's socket).
    for (const seat of get().seats) if (seat.socket !== socket) seat.socket.disconnect()
    setActiveSocket(socket)
    clearStoredSession()
    lastCurrentPlayerId = null
    set({
      hotseat: false,
      seats: [],
      activeSeatId: null,
      autoFollowTurn: true,
      roomId: null,
      playerId: null,
      state: null,
      finalStandings: null,
      incomingDeal: null,
    })
  },
}))

export const formatRupiah = (n: RupiahAmount): string =>
  `Rp ${Math.round(n).toLocaleString('id-ID')}`
