// Socket.io event payloads (tech doc §7). These are used to type the Socket.io
// server and client for end-to-end safety.

import type {
  AbilityType,
  GameState,
  NegotiationDeal,
  Role,
  RoomSettings,
  RupiahAmount,
  TileId,
} from './game.js'

export type MetaActionType =
  | 'invest'
  | 'work'
  | 'hustle'
  | 'lobby'
  | 'sabotage'
  | 'korupsi'
  | 'negotiate'

export interface FinalStanding {
  playerId: string
  name: string
  role: Role | null
  wealth: RupiahAmount
  eliminated: boolean
}

// ---- Client → Server ----
export interface ClientToServerEvents {
  join_room: (
    payload: { roomId: string; playerName: string },
    ack: (res: AckResult<{ roomId: string; playerId: string; token: string }>) => void,
  ) => void
  // `token` is the secret reconnect credential issued at join; it authenticates a
  // rejoin so a known playerId alone can't be used to hijack someone's seat.
  rejoin: (
    payload: { roomId: string; playerId: string; token: string },
    ack: (res: AckResult<{ roomId: string; playerId: string; token: string }>) => void,
  ) => void
  // Deliberate exit: leave the lobby (removed) or forfeit an in-progress game
  // (eliminated). Distinct from a socket disconnect, which keeps the seat.
  leave_room: () => void
  // Read-only resync: re-send the caller the canonical state. Used when a tab
  // returns from the background (where rAF/timers froze and the UI may have
  // drifted) without a socket disconnect to trigger an auto-rejoin.
  request_state: () => void
  pick_role: (payload: { role: Role | null }) => void
  update_settings: (payload: { settings: Partial<RoomSettings> }) => void
  start_game: () => void

  roll_dice: () => void
  buy_property: (payload: { tileId: TileId }) => void
  upgrade_property: (payload: { tileId: TileId; track?: 'house' | 'property' }) => void
  meta_action: (payload: { action: MetaActionType; targetId?: string; tileId?: TileId }) => void
  use_ability: (payload: { ability: AbilityType }) => void
  pay_jail: () => void
  take_pinjol: (payload: { amount: RupiahAmount; lenderId?: string }) => void
  // Voluntarily repay a pinjol loan's principal. Omit `loanId` to repay all loans.
  repay_pinjol: (payload: { loanId?: string }) => void
  propose_deal: (payload: { deal: NegotiationDeal }) => void
  respond_deal: (payload: { dealId: string; accept: boolean }) => void
  sell_property: (payload: { tileId: TileId }) => void
  downgrade_property: (payload: { tileId: TileId }) => void
  resolve_debt: (payload: { giveUp: boolean }) => void
  cast_vote: (payload: { targetId: string }) => void
  end_turn: () => void
}

// ---- Server → Client ----
export interface ServerToClientEvents {
  game_state: (state: GameState) => void
  room_joined: (payload: { roomId: string; playerId: string }) => void
  card_drawn: (payload: { type: 'kejadian' | 'hustle'; card: string; playerId: string }) => void
  // Rent was charged because a player landed on an owned tile. Emitted alongside
  // the roll's state broadcast; the client plays the cue synced to the token's
  // arrival. Fires whether the rent was paid immediately or became a debt.
  rent_paid: (payload: {
    payerId: string
    ownerId: string
    tileId: TileId
    amount: RupiahAmount
  }) => void
  deal_proposed: (payload: { deal: NegotiationDeal }) => void
  player_eliminated: (payload: { playerId: string }) => void
  game_over: (payload: { winner: string; finalStandings: FinalStanding[] }) => void
  error: (payload: { message: string }) => void
}

// Generic ack envelope for request/response style events.
export type AckResult<T> = { ok: true; data: T } | { ok: false; error: string }
