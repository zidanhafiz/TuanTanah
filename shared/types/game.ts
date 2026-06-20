// Core game state types — mirrors the tech requirements doc (§6), with a few
// additions needed to drive the UI (turn substate, event log, player colors).
import type { MetaActionType } from './events.js'

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
  | 'buildable_land' // Lahan Kosong — buy bare land, then build a business on it
  | 'law_office' // Kantor Hukum — choose a legal power action on landing
  | 'vacation' // Gunung Rinjani — gathers all players and charges a flat fee

// What a Lahan Kosong (buildable_land) tile has been developed into. Mutually
// exclusive per tile: Dapur MBG earns flat passive income, Warkop-Cafe charges
// landing rent. Null/undefined = bare land (bought but not yet built).
export type LandBusiness = 'dapur_mbg' | 'warkop_cafe'

export type EffectType =
  | 'rent_multiplier'
  | 'passive_multiplier'
  | 'tier_drop'
  | 'transport_multiplier'
  | 'passive_halved'
  | 'lobby_block'
  | 'turn_skip'
  | 'rent_immunity' // a deal: targetPlayerId pays no rent on any tile owned by ownerId (lap-based)
  | 'revenue_share' // a deal: targetPlayerId shares `multiplier` of passive income with beneficiaryPlayerId (lap-based)

export interface PinjolLoan {
  id: string
  amount: RupiahAmount // 2jt / 5jt / 10jt
  interestPerLap: RupiahAmount // charged each time the borrower passes GO (a lap)
  lenderId: string | null // null = bank, playerId = Rentenir or a negotiated peer lender
  roundBorrowed: number
  interestPaid: RupiahAmount // running total of interest paid so far (history)
  // Per-lap rate; undefined = the pinjol default (PINJOL_INTEREST_RATE). A negotiated
  // player loan (player_loan deal) carries the proposer-set rate here.
  interestRate?: number
}

// A free-pass card held in a player's inventory. Auto-consumed when it matches an
// incoming charge: rent_free waives one rent, tax_free one tax, jail_free one
// jailing. Persists until used; only Reshuffle Kabinet wipes the inventory.
export type PassType = 'rent_free' | 'tax_free' | 'jail_free'
export interface OwnedCard {
  id: string
  type: PassType
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
  // Free-pass cards (tax/rent/jail-free) held for later auto-consumption.
  ownedCards: OwnedCard[]
  isEliminated: boolean
  isRoomMaster: boolean
  isConnected: boolean
  usedAbility: boolean // for once-per-game role abilities
  // Distinct meta actions used in the current lap (since last passing GO). Capped
  // at META_ACTIONS_PER_LAP, no repeats; reset when the player passes GO.
  // Pinjol/Negosiasi are unlimited and not tracked here.
  metaActionsUsed: MetaActionType[]
  // Set when the player passes GO; pinjol interest is then charged once at the
  // start of their next turn (keeps interest off the movement/debt path).
  owesLapInterest: boolean
  // Consecutive AFK turns (turns auto-skipped for inactivity). Incremented each
  // auto-skip, reset to 0 when the player acts (see rollDice). Drives the
  // escalating AFK fine and the eventual kick.
  afkStrikes: number
}

export interface TileState {
  id: TileId
  ownerId: string | null
  track: PropertyTrack | null // locked once first bought
  tier: number // 0 = unbuilt, 1–4 house, 1–5 property
  // Kontraktor who developed this tile (built on someone else's land); earns a
  // cut of all rent paid on it. At most one per game (roles are unique).
  builderId: string | null
  // For buildable_land (Lahan Kosong) tiles only: which business has been built,
  // or null/undefined for bare owned land. Other tile types leave this unset.
  landBuild?: LandBusiness | null
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
  tileId?: TileId // rent debts: the tile rented, so a builder cut applies on settlement
}

export interface ActiveEffect {
  id: string
  type: EffectType
  targetTileIds?: TileId[]
  targetPlayerId?: string
  beneficiaryPlayerId?: string // revenue_share recipient
  // rent_immunity deal: the immune player (targetPlayerId) pays no rent on any tile
  // owned by this player.
  ownerId?: string
  multiplier?: number
  // Round-based decay (cards/abilities). Lap-based effects set this to 0 and use
  // lapsRemaining instead; tickEffects skips any effect that has lapsRemaining set.
  roundsRemaining: number
  // Lap-based decay (rent_immunity, revenue_share deals): decremented when the
  // anchor player passes GO. Undefined for round-based effects.
  lapsRemaining?: number
  lapAnchorPlayerId?: string // whose passing-GO decrements lapsRemaining
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
  // When true, a player must own every tile in a region before building there.
  requireFullRegionToBuild: boolean
}

// Per-turn substate, reset at the start of each player's turn.
export interface TurnState {
  hasRolled: boolean
  lastDice: [number, number] | null
  rolledDoubles: boolean
  // An unowned property the current player just landed on and may buy.
  pendingBuyTileId: TileId | null
  // True while the current player is on a Kantor Hukum tile and must pick one of
  // its legal actions (buy remotely / force-transfer / force-jail / buy a pass)
  // or skip. Set on landing, cleared when an action resolves or they skip.
  pendingLawOffice: boolean
  // Epoch ms when the current player's turn auto-skips for inactivity, or null
  // when no AFK timer is armed (lobby/ended, or the game is paused on a debt or
  // vote). Set by the server's AFK timer layer, not the engine; the client
  // renders the countdown from it.
  deadline: number | null
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
  // Secret per-player reconnect tokens (playerId → token). Server-only: stripped
  // by broadcastState so it never reaches clients. Persisted with the room so
  // reconnect survives a server restart.
  reconnectTokens?: Record<string, string>
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
  | 'player_loan' // pinjam uang: a peer loan; lender fronts cash, repaid via the pinjol flow
  | 'cash_gift' // kasih / minta uang: a one-off free cash transfer

export interface NegotiationDeal {
  id: string
  type: NegotiationDealType
  fromPlayerId: string
  toPlayerId: string
  // Generic fields; meaning depends on `type`.
  offerTileId?: TileId
  requestTileId?: TileId
  cashAmount?: RupiahAmount
  // Who pays `cashAmount`: the property_swap top-up payer / rent_immunity fee payer
  // / cash_gift giver / player_loan lender (who fronts the principal).
  cashFrom?: 'proposer' | 'target'
  // rent_immunity: who becomes immune; the other party is the owner whose tiles are covered.
  immuneFor?: 'proposer' | 'target'
  // rent_immunity + revenue_share: duration counted in laps (anchor player passing GO).
  laps?: number
  // player_loan: per-lap interest rate the proposer sets (e.g. 0.1 = 10%).
  interestRate?: number
  rounds?: number
  sharePercent?: number
  // revenue_share only: whose passive income is shared with the other party.
  shareFrom?: 'proposer' | 'target'
  status: 'pending' | 'accepted' | 'rejected'
}
