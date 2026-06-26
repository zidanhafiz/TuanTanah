// Economic & action tuning — the non-content numbers that govern the game loop:
// player/cash limits, win conditions, AFK, pinjol, jail, meta-actions, and the
// Kantor Hukum / Rinjani fees.
import type { RupiahAmount, TileId, WinCondition } from '../types/game.js'
import { jt } from './units.js'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8

// Room master sets starting cash in this range.
export const STARTING_CASH_MIN = jt(5)
export const STARTING_CASH_MAX = jt(50)
export const STARTING_CASH_DEFAULT = jt(15)

// Bank starts effectively unlimited; tracked for accounting.
export const BANK_STARTING = jt(1_000_000)

// ---- Win conditions (room master sets in lobby) ----
export const WIN_CONDITIONS: WinCondition[] = ['time', 'wealth', 'both']
export const TIME_LIMIT_OPTIONS = [30, 60, 90, 120] as const
export const TARGET_WEALTH_MIN = jt(50) // Rp 50 juta
export const TARGET_WEALTH_MAX = jt(500) // Rp 500 juta
export const TARGET_WEALTH_DEFAULT = jt(100) // matches createGameState default
export const TARGET_WEALTH_STEP = jt(10)

// ---- AFK auto-skip ----
// Inactivity allowed per turn before the active player is auto-skipped. The
// countdown resets whenever the active player acts (the broadcast re-arms it).
export const AFK_TIMEOUT_MS = 30_000
// Time the to-act bidder has to raise or concede in a Kantor Hukum force-buy
// auction before they auto-concede. Shorter than the turn clock to keep the
// fast-paced bidding war moving; re-armed after every bid.
export const AUCTION_TIMEOUT_MS = 15_000
// Per consecutive AFK turn the player is fined this × their strike count
// (1st AFK → Rp 1jt, 2nd → Rp 2jt, 3rd → Rp 3jt). Capped at their cash on hand,
// never opening a debt.
export const AFK_FINE_STEP: RupiahAmount = jt(1)
// Strikes 1..AFK_MAX_STRIKES are fined; the next AFK turn kicks the player.
export const AFK_MAX_STRIKES = 3

// ---- Pinjol ----
export const PINJOL_AMOUNTS: RupiahAmount[] = [jt(2), jt(5), jt(10)]
export const PINJOL_INTEREST_RATE = 0.1 // 10% per lap (charged when the borrower passes GO)
export const PINJOL_MAX_LOANS = 3
export const PINJOL_BORROW_LIMIT_MULTIPLE = 3 // ≤ 3× total property value
// Ceiling on the per-lap rate a player can set on a negotiated peer loan (player_loan deal).
export const PLAYER_LOAN_MAX_RATE = 0.5 // 50% per lap

// ---- Selling ----
/** Fraction of a tile's invested value (buy price + build costs) refunded when sold back to the bank. */
export const SELL_REFUND_RATE = 0.5

// ---- Jail ----
export const JAIL_DURATION_TURNS = 2
export const JAIL_EXIT_COST = jt(1)

// ---- Kantor Hukum (law_office) landing actions ----
export const LAW_OFFICE_TRANSFER_RATE = 0.7 // force-buy a rival's property at 70% of invested value
export const LAW_OFFICE_JAIL_FEE: RupiahAmount = jt(2) // bribe (to bank) to force-jail a rival
export const LAW_OFFICE_FREEPASS_PRICE: RupiahAmount = jt(3) // buy one free-pass card
// Upgrade an owned tile's price by a ×2–×5 multiplier (cost = tileValue × multiplier).
export const LAW_OFFICE_PRICE_MULT_MIN = 2
export const LAW_OFFICE_PRICE_MULT_MAX = 5

// ---- Gunung Rinjani (vacation) ----
// Gathers all active players to the tile; each pays this fee.
export const RINJANI_FEE: RupiahAmount = jt(1)
export const RINJANI_TILE_ID: TileId = 24

// ---- Meta action costs ----
export const META_ACTION_COSTS = {
  lobby: jt(2),
  sabotage: jt(3),
} as const

// Max distinct meta actions a player may use per lap around the board — i.e.
// between passing GO and passing it again (no repeats). Resets on passing GO.
// Pinjol and Negosiasi are unlimited and not counted against this.
export const META_ACTIONS_PER_LAP = 3

export const KORUPSI_SUCCESS_RATE = 0.3 // 30% success, 70% caught
export const KORUPSI_STEAL_AMOUNT: RupiahAmount = jt(7) // taken from bank on success
export const KORUPSI_FINE: RupiahAmount = jt(2) // paid to bank when caught (matches Korupsi Terungkap card)

// Judol (online gambling): deposit cash for a long-shot payout, else lose it.
export const JUDOL_WIN_RATE = 0.1 // 10% chance to win
export const JUDOL_JACKPOT_RATE = 0.01 // 1% sub-roll within a win → jackpot
export const JUDOL_WIN_MULT_MIN = 3 // inclusive integer payout multiplier on a win
export const JUDOL_WIN_MULT_MAX = 5
export const JUDOL_JACKPOT_MULTIPLIER = 10 // payout multiplier on a jackpot
export const JUDOL_PRESET_DEPOSITS: RupiahAmount[] = [jt(1), jt(3), jt(5)] // quick-pick chips

// Sabotage applies a temporary rent_multiplier effect to one tile.
export const SABOTAGE_RENT_MULTIPLIER = 0.5 // halves the target tile's rent
export const SABOTAGE_DURATION_ROUNDS = 2
