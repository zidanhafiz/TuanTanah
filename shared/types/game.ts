// Core game state types — mirrors the tech requirements doc (§6), with a few
// additions needed to drive the UI (turn substate, event log, player colors).

export type RupiahAmount = number // always in rupiah, e.g. 2_000_000 = Rp 2 juta
export type TileId = number // 0–39

export type GamePhase = 'lobby' | 'playing' | 'ended'

export type Role =
  | 'pengusaha'
  | 'politisi'
  | 'freelancer'
  | 'investor'
  | 'kontraktor'
  | 'ojol_driver'
  | 'influencer'
  | 'pejabat'
  | 'rentenir'
  | 'sales'

export type PropertyTrack = 'house' | 'property'

// Player-triggered, once-per-game role abilities.
export type AbilityType = 'viral_boost' | 'block_kejadian'

export type TileType =
  | 'go'
  | 'property'
  | 'transport'
  | 'tax'
  | 'event' // Kejadian Nasional
  | 'hustle'
  | 'jail_visit' // Visiting Penjara
  | 'jail_go' // Masuk Penjara
  | 'parking' // Parkir Bebas

export type EffectType =
  | 'rent_multiplier'
  | 'passive_multiplier'
  | 'tier_drop'
  | 'transport_multiplier'
  | 'passive_halved'
  | 'lobby_block'
  | 'turn_skip'
  | 'rent_immunity' // a deal: targetPlayerId pays no rent on targetTileIds
  | 'revenue_share' // a deal: targetPlayerId shares `multiplier` of passive income with beneficiaryPlayerId

export interface PinjolLoan {
  id: string
  amount: RupiahAmount // 2jt / 5jt / 10jt
  interestPerRound: RupiahAmount
  lenderId: string | null // null = bank, playerId = Rentenir
  roundBorrowed: number
}

export interface Player {
  id: string
  name: string
  color: string // token color, assigned on join
  role: Role | null // null until picked in lobby
  cash: RupiahAmount
  position: TileId
  inJail: boolean
  jailTurnsLeft: number
  loans: PinjolLoan[]
  isEliminated: boolean
  isRoomMaster: boolean
  isConnected: boolean
  usedAbility: boolean // for once-per-game role abilities
}

export interface TileState {
  id: TileId
  ownerId: string | null
  track: PropertyTrack | null // locked once first bought
  tier: number // 0 = unbuilt, 1–4 house, 1–5 property
}

// An unpayable charge that paused the game. The debtor must raise cash (sell a
// property or take a pinjol — which auto-settle the debt) or give up and be
// eliminated. At most one pending debt per player at a time.
export interface PendingDebt {
  id: string
  debtorId: string
  creditorId: string | null // null = bank
  amount: RupiahAmount
  type: 'rent' | 'tax' | 'fine' | 'interest'
  reason: string // human label, e.g. "rent to Budi"
}

export interface ActiveEffect {
  id: string
  type: EffectType
  targetTileIds?: TileId[]
  targetPlayerId?: string
  beneficiaryPlayerId?: string // revenue_share recipient
  multiplier?: number
  roundsRemaining: number
  sourceCard: string
}

// A pending election (Pemilu Kejadian card): every eligible player votes for
// who should skip their next turn. Resolved once all eligible players vote.
export interface PendingVote {
  card: string // 'pemilu'
  votes: Record<string, string> // voterId -> targetPlayerId
}

export type WinCondition = 'time' | 'wealth' | 'both'

// How a finished game was actually decided (settings.winCondition is the
// configured goal; this is the outcome that triggered the win).
export type WinReason = 'time' | 'wealth' | 'last_standing'

export interface RoomSettings {
  winCondition: WinCondition
  timeLimitMinutes?: 30 | 60 | 90 | 120
  targetWealth?: RupiahAmount
  startingCash: RupiahAmount // Rp 5jt – Rp 50jt
  enabledRoles: Role[]
}

// Per-turn substate, reset at the start of each player's turn.
export interface TurnState {
  hasRolled: boolean
  lastDice: [number, number] | null
  rolledDoubles: boolean
  // An unowned property the current player just landed on and may buy.
  pendingBuyTileId: TileId | null
  // One optional meta action per turn (turn structure step 5).
  usedMetaAction: boolean
}

export interface LogEntry {
  id: string
  round: number
  message: string
  playerId?: string
}

export interface GameState {
  roomId: string
  phase: GamePhase
  round: number
  currentPlayerIndex: number
  players: Player[]
  tiles: TileState[]
  turn: TurnState
  activeEffects: ActiveEffect[]
  kejadianDeck: string[]
  hustleDeck: string[]
  // Pejabat armed their once/game Kejadian block; the next drawn card is nullified.
  pendingKejadianBlock?: boolean
  // An in-progress Pemilu election; cleared once the vote resolves.
  pendingVote?: PendingVote | null
  // Unpayable charges awaiting resolution; while non-empty the game is paused.
  pendingDebts: PendingDebt[]
  // Outstanding negotiation offers awaiting the target's accept/reject.
  pendingDeals: NegotiationDeal[]
  bank: RupiahAmount
  settings: RoomSettings
  log: LogEntry[]
  winner?: string
  winReason?: WinReason
  startedAt?: number
  createdAt: number
  updatedAt: number
}

// ---- Negotiation (structured deals) ----

export type NegotiationDealType =
  | 'property_swap'
  | 'cash_for_property'
  | 'rent_immunity'
  | 'revenue_share'

export interface NegotiationDeal {
  id: string
  type: NegotiationDealType
  fromPlayerId: string
  toPlayerId: string
  // Generic fields; meaning depends on `type`.
  offerTileId?: TileId
  requestTileId?: TileId
  cashAmount?: RupiahAmount
  rounds?: number
  sharePercent?: number
  // revenue_share only: whose passive income is shared with the other party.
  shareFrom?: 'proposer' | 'target'
  status: 'pending' | 'accepted' | 'rejected'
}
