// Game engine entry point — pure logic, no I/O (RNG is injectable).
// Invalid actions throw EngineError; handlers translate that to a socket `error`.
import {
  ALL_ROLES,
  BANK_STARTING,
  BOARD_SIZE,
  GO_TILE_ID,
  HOUSE_TIERS,
  HUSTLE_CARDS,
  JAIL_DURATION_TURNS,
  JAIL_EXIT_COST,
  JAIL_TILE_ID,
  KEJADIAN_CARDS,
  LAHAN_LAND_PRICE,
  LAND_MAX_TIER,
  landTier,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  PROPERTY_TIERS,
  REGIONS,
  REGION_SET_RENT_MULTIPLIER,
  RINJANI_FEE,
  RINJANI_TILE_ID,
  rpP,
  SELL_REFUND_RATE,
  STARTING_CASH_DEFAULT,
  STARTING_CASH_MAX,
  STARTING_CASH_MIN,
  TARGET_WEALTH_MAX,
  TARGET_WEALTH_MIN,
  tierP,
  tileP,
  TIME_LIMIT_OPTIONS,
  TRANSPORT_BUY_PRICE,
  TRANSPORT_RENT,
  landTierP,
} from '@tuan-tanah/shared'
import type {
  GameState,
  LandBusiness,
  Player,
  PropertyTrack,
  Role,
  RoomSettings,
  RupiahAmount,
  TileId,
} from '@tuan-tanah/shared'
import { getTileDef, ownsFullRegion, transportOwnedCount } from './board.js'
import { drawHustle, drawKejadian } from './cards.js'
import { charge, playerWealth, settleIfAble, tileValue } from './elimination.js'
import {
  applyRentEffects,
  consumeOwnedCard,
  effectiveTier,
  hasRentImmunity,
  tickLapEffects,
} from './effects.js'
import { buildCostMultiplier, buyPriceMultiplier, salaryFor, taxMultiplier } from './roles.js'
import { advanceTurn, collectPassiveIncome, startTurn } from './turn.js'
import { renderErrorEn } from './messages.js'
import { defaultRng, logKey, pushLog, shuffle, uid, type Rng } from './util.js'
import type { LogParams } from '@tuan-tanah/shared'

/**
 * Thrown on invalid actions; handlers turn it into a socket `error` event. The
 * `.message` is the English fallback. Prefer passing a localizable `code` (+
 * `params`) so the client can show the error in the viewer's language; a plain
 * string still works and renders verbatim (unknown code → itself).
 */
export class EngineError extends Error {
  readonly code: string
  readonly params?: LogParams
  constructor(code: string, params?: LogParams) {
    super(renderErrorEn(code, params))
    this.code = code
    this.params = params
  }
}

export const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

// ---- Lobby lifecycle ----

export function createGameState(roomId: string, now: number): GameState {
  return {
    roomId,
    phase: 'lobby',
    round: 0,
    currentPlayerIndex: 0,
    players: [],
    tiles: Array.from({ length: BOARD_SIZE }, (_, id) => ({
      id,
      ownerId: null,
      track: null,
      tier: 0,
      builderId: null,
      landBuild: null,
      priceMultiplier: 1,
    })),
    turn: {
      hasRolled: false,
      lastDice: null,
      rolledDoubles: false,
      doublesCount: 0,
      pendingBuyTileId: null,
      pendingLawOffice: false,
      deadline: null,
    },
    activeEffects: [],
    kejadianDeck: [],
    hustleDeck: [],
    pendingKejadianBlock: false,
    pendingDebts: [],
    pendingDeals: [],
    pendingAuction: null,
    bank: BANK_STARTING,
    settings: {
      winCondition: 'both',
      timeLimitMinutes: 60,
      targetWealth: 100_000_000,
      startingCash: STARTING_CASH_DEFAULT,
      enabledRoles: [...ALL_ROLES],
      requireFullRegionToBuild: true,
    },
    log: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function addPlayer(state: GameState, name: string): Player {
  if (state.phase !== 'lobby') throw new EngineError('core.gameAlreadyStarted')
  if (state.players.length >= MAX_PLAYERS) throw new EngineError('core.roomFull')
  const trimmed = name.trim().slice(0, 20) || `Player ${state.players.length + 1}`
  const player: Player = {
    id: uid(),
    name: trimmed,
    color: PLAYER_COLORS[state.players.length % PLAYER_COLORS.length]!,
    role: null,
    cash: 0,
    position: GO_TILE_ID,
    inJail: false,
    jailTurnsLeft: 0,
    loans: [],
    ownedCards: [],
    isEliminated: false,
    isRoomMaster: state.players.length === 0,
    isConnected: true,
    usedAbility: false,
    forcedLoanRound: 0,
    metaActionsUsed: [],
    owesLapInterest: false,
    afkStrikes: 0,
  }
  state.players.push(player)
  logKey(state, 'core.joinedRoom', { name: player.name }, player.id)
  return player
}

export function getPlayer(state: GameState, playerId: string): Player {
  const p = state.players.find((x) => x.id === playerId)
  if (!p) throw new EngineError('core.playerNotInRoom')
  return p
}

export function setConnected(state: GameState, playerId: string, connected: boolean): void {
  const p = state.players.find((x) => x.id === playerId)
  if (p) p.isConnected = connected
}

export function removePlayer(state: GameState, playerId: string): void {
  const idx = state.players.findIndex((x) => x.id === playerId)
  if (idx === -1) return
  const [removed] = state.players.splice(idx, 1)
  if (removed) logKey(state, 'core.leftRoom', { name: removed.name })
  // Reassign room master if needed.
  if (removed?.isRoomMaster && state.players[0]) state.players[0].isRoomMaster = true
}

export function pickRole(state: GameState, playerId: string, role: Role | null): void {
  if (state.phase !== 'lobby') throw new EngineError('core.cannotChangeRoleAfterStart')
  const player = getPlayer(state, playerId)
  if (role !== null) {
    if (!state.settings.enabledRoles.includes(role)) throw new EngineError('core.roleDisabled')
    const taken = state.players.some((p) => p.id !== playerId && p.role === role)
    if (taken) throw new EngineError('core.roleTaken')
  }
  player.role = role
}

export function updateSettings(
  state: GameState,
  playerId: string,
  partial: Partial<RoomSettings>,
): void {
  if (state.phase !== 'lobby') throw new EngineError('core.cannotChangeSettingsAfterStart')
  const player = getPlayer(state, playerId)
  if (!player.isRoomMaster) throw new EngineError('core.notRoomMaster')
  const next = { ...state.settings, ...partial }
  if (partial.startingCash !== undefined) {
    next.startingCash = Math.min(
      STARTING_CASH_MAX,
      Math.max(STARTING_CASH_MIN, partial.startingCash),
    )
  }
  if (partial.winCondition !== undefined) {
    if (!['time', 'wealth', 'both'].includes(partial.winCondition)) {
      throw new EngineError('core.invalidWinCondition')
    }
  }
  if (partial.targetWealth !== undefined) {
    next.targetWealth = Math.min(
      TARGET_WEALTH_MAX,
      Math.max(TARGET_WEALTH_MIN, partial.targetWealth),
    )
  }
  if (partial.timeLimitMinutes !== undefined) {
    if (!TIME_LIMIT_OPTIONS.includes(partial.timeLimitMinutes)) {
      throw new EngineError('core.invalidTimeLimit')
    }
  }
  if (partial.enabledRoles) {
    if (!Array.isArray(partial.enabledRoles)) throw new EngineError('core.invalidRoles')
    // Reject unknown role ids and de-dupe, so a crafted client can't inject
    // arbitrary strings into shared state.
    const valid = [...new Set(partial.enabledRoles)].filter((r) => ALL_ROLES.includes(r))
    if (valid.length === 0) throw new EngineError('core.atLeastOneRole')
    next.enabledRoles = valid
    // Unpick any roles that became disabled.
    for (const p of state.players) {
      if (p.role && !valid.includes(p.role)) p.role = null
    }
  }
  if (partial.requireFullRegionToBuild !== undefined) {
    next.requireFullRegionToBuild = Boolean(partial.requireFullRegionToBuild)
  }
  state.settings = next
}

export function startGame(state: GameState, playerId: string, rng: Rng = defaultRng): void {
  if (state.phase !== 'lobby') throw new EngineError('core.gameAlreadyStarted')
  const player = getPlayer(state, playerId)
  if (!player.isRoomMaster) throw new EngineError('core.notRoomMasterStart')
  const active = state.players.filter((p) => p.isConnected)
  if (active.length < MIN_PLAYERS) throw new EngineError('core.needMorePlayers')
  if (active.some((p) => p.role === null)) throw new EngineError('core.playersNeedRole')

  state.phase = 'playing'
  state.round = 1
  state.currentPlayerIndex = 0
  state.pendingKejadianBlock = false
  for (const p of state.players) {
    p.cash = state.settings.startingCash
    p.position = GO_TILE_ID
    p.inJail = false
    p.jailTurnsLeft = 0
    p.loans = []
    p.ownedCards = []
    p.isEliminated = false
    p.usedAbility = false
  }
  state.kejadianDeck = shuffle(
    KEJADIAN_CARDS.map((c) => c.id),
    rng,
  )
  state.hustleDeck = shuffle(
    HUSTLE_CARDS.map((c) => c.id),
    rng,
  )
  state.startedAt = state.updatedAt
  logKey(state, 'core.gameStarted')
  startTurn(state)
}

// ---- In-game actions ----

export function requireTurn(state: GameState, playerId: string): Player {
  if (state.phase !== 'playing') throw new EngineError('core.gameNotInProgress')
  const current = state.players[state.currentPlayerIndex]
  if (!current || current.id !== playerId) throw new EngineError('core.notYourTurn')
  if (current.isEliminated) throw new EngineError('core.eliminated')
  if (state.pendingDebts.length > 0) {
    throw new EngineError('core.hasPendingDebts')
  }
  return current
}

/**
 * Like `requireTurn`, but also allows a player who has a pending debt to act
 * out of turn — so an indebted player can sell property or take a pinjol to
 * raise the cash even when it isn't their turn.
 */
export function requireDebtorOrTurn(state: GameState, playerId: string): Player {
  if (state.phase !== 'playing') throw new EngineError('core.gameNotInProgress')
  const player = state.players.find((p) => p.id === playerId)
  if (!player) throw new EngineError('core.playerNotFound')
  if (player.isEliminated) throw new EngineError('core.eliminated')
  const isTurn = state.players[state.currentPlayerIndex]?.id === playerId
  const hasDebt = state.pendingDebts.some((d) => d.debtorId === playerId)
  if (!isTurn && !hasDebt) throw new EngineError('core.notYourTurn')
  return player
}

export interface RentPaid {
  payerId: string
  ownerId: string
  tileId: TileId
  amount: RupiahAmount
}

export interface RollResult {
  dice: [number, number]
  card?: { type: 'kejadian' | 'hustle'; card: string }
  rent?: RentPaid
}

/** What landing on a tile produced — surfaced so handlers can emit side events. */
type TileOutcome = { card?: { type: 'kejadian' | 'hustle'; card: string }; rent?: RentPaid }

export function rollDice(state: GameState, playerId: string, rng: Rng = defaultRng): RollResult {
  const player = requireTurn(state, playerId)
  // A second roll this turn is allowed only when the previous roll was a
  // move-granting double. Jail-escape and three-doubles both clear rolledDoubles,
  // so they fall through to this guard and reject a re-roll.
  if (state.turn.hasRolled && !state.turn.rolledDoubles) {
    throw new EngineError('core.alreadyRolled')
  }
  // Rolling proves the player is present: clear any consecutive AFK strikes.
  player.afkStrikes = 0

  const wasInJail = player.inJail
  const d1 = Math.floor(rng() * 6) + 1
  const d2 = Math.floor(rng() * 6) + 1
  const doubles = d1 === d2
  state.turn.hasRolled = true
  state.turn.lastDice = [d1, d2]
  state.turn.rolledDoubles = doubles
  if (doubles) {
    logKey(state, 'core.rolledDoubles', { name: player.name, d1, d2, total: d1 + d2 }, player.id)
  } else {
    logKey(state, 'core.rolled', { name: player.name, d1, d2, total: d1 + d2 }, player.id)
  }

  if (wasInJail) {
    if (doubles) {
      player.inJail = false
      player.jailTurnsLeft = 0
      // Escaping jail via doubles does NOT grant an extra roll, so clear the flag
      // and leave doublesCount untouched. They still move on the escaping roll.
      state.turn.rolledDoubles = false
      logKey(state, 'core.escapedJailDoubles', { name: player.name }, player.id)
    } else {
      player.jailTurnsLeft -= 1
      if (player.jailTurnsLeft <= 0) {
        player.inJail = false
        logKey(state, 'core.releasedFromJail', { name: player.name }, player.id)
      } else {
        logKey(
          state,
          'core.staysInJail',
          { name: player.name, count: player.jailTurnsLeft },
          player.id,
        )
      }
      return { dice: [d1, d2] }
    }
  } else if (doubles) {
    state.turn.doublesCount += 1
    if (state.turn.doublesCount >= 3) {
      // Three doubles in a row: straight to jail without moving, and no re-roll.
      state.turn.rolledDoubles = false
      logKey(state, 'core.threeDoubles', { name: player.name }, player.id)
      sendToJail(state, player)
      return { dice: [d1, d2] }
    }
  }

  return { dice: [d1, d2], ...movePlayer(state, player, d1 + d2, rng) }
}

/**
 * DEV-only: place the current player on `tileId` and resolve that tile exactly as
 * a normal landing would (rent, buy prompt, card draw, jail, tax, vacation, …),
 * but with no dice roll. The tile is resolved in isolation — no GO salary or
 * passive income — so a single tile's effect can be tested cleanly; roll normally
 * to exercise passing GO. Marks the turn as moved (`hasRolled`) so the only valid
 * follow-up is ending the turn. Exposed via the `dev_teleport` handler, which is
 * gated to dev builds.
 */
export function devTeleport(
  state: GameState,
  playerId: string,
  tileId: TileId,
  rng: Rng = defaultRng,
): RollResult {
  const player = requireTurn(state, playerId)
  if (!Number.isInteger(tileId) || tileId < 0 || tileId >= BOARD_SIZE) {
    throw new EngineError('core.invalidTile')
  }
  player.position = tileId
  state.turn.hasRolled = true
  state.turn.lastDice = null
  state.turn.rolledDoubles = false
  pushLog(state, `[DEV] ${player.name} teleported to ${getTileDef(tileId).name}`, player.id)
  return { dice: [0, 0], ...resolveTile(state, player, rng) }
}

function movePlayer(
  state: GameState,
  player: Player,
  steps: number,
  rng: Rng = defaultRng,
): TileOutcome {
  const oldPos = player.position
  const passedGo = oldPos + steps >= BOARD_SIZE
  player.position = (oldPos + steps) % BOARD_SIZE
  if (passedGo) {
    const salary = salaryFor(player)
    player.cash += salary
    state.bank -= salary
    logKey(state, 'core.passedGo', { name: player.name, amount: rpP(salary) }, player.id)
    // A new lap: refresh the meta-action allowance, and mark loan interest due
    // (charged at the start of their next turn, off the movement/debt path).
    player.metaActionsUsed = []
    if (player.loans.length > 0) player.owesLapInterest = true
    // Passive income pays once per lap, before resolving the tile they land on
    // so the cash is on hand if they owe rent there.
    collectPassiveIncome(state, player)
    // Decay lap-based deal effects anchored to this player. After passive income
    // so a revenue-share still pays out for this lap before it expires.
    tickLapEffects(state, player.id)
  }
  return resolveTile(state, player, rng)
}

/**
 * Move `player` FORWARD to `targetTileId` with no dice roll, resolving the
 * destination exactly as a landing would — including pass-GO salary + passive
 * income if the trip wraps the board. A target equal to the current position
 * travels a full lap (so "advance to GO while on GO" still pays salary). Used by
 * the `move`-kind hustle cards (advance to GO / Kantor Hukum).
 */
export function advanceToTile(
  state: GameState,
  player: Player,
  targetTileId: TileId,
  rng: Rng = defaultRng,
): TileOutcome {
  const steps = (targetTileId - player.position + BOARD_SIZE) % BOARD_SIZE || BOARD_SIZE
  return movePlayer(state, player, steps, rng)
}

function resolveTile(state: GameState, player: Player, rng: Rng = defaultRng): TileOutcome {
  const def = getTileDef(player.position)
  switch (def.type) {
    case 'property':
    case 'transport': {
      const tile = state.tiles[player.position]!
      if (tile.ownerId === null) {
        state.turn.pendingBuyTileId = player.position
        logKey(
          state,
          'core.landedUnowned',
          { name: player.name, tile: tileP(player.position) },
          player.id,
        )
      } else if (tile.ownerId !== player.id) {
        const rent = computeRent(state, player.position)
        const paid = payRent(state, player, tile.ownerId, rent, player.position)
        return paid ? { rent: paid } : {}
      } else {
        logKey(
          state,
          'core.landedOwn',
          { name: player.name, tile: tileP(player.position) },
          player.id,
        )
      }
      return {}
    }
    case 'tax': {
      if (consumeOwnedCard(player, 'tax_free')) {
        logKey(
          state,
          'core.taxFreePass',
          { name: player.name, tile: tileP(player.position) },
          player.id,
        )
        return {}
      }
      const percent = def.taxPercent ?? 0
      const base = def.taxBasis === 'cash' ? player.cash : playerWealth(state, player)
      // Ojol Driver pays a reduced rate (taxMultiplier); everyone else pays full.
      const amount = Math.round((base * percent * taxMultiplier(player)) / 100)
      charge(state, player, amount, null, 'tax', def.name)
      return {}
    }
    case 'hustle': {
      const drawn = drawHustle(state, player, rng)
      return drawn ? { card: { type: 'hustle', card: drawn.cardId } } : {}
    }
    case 'event': {
      const drawn = drawKejadian(state, player, rng)
      return drawn ? { card: { type: 'kejadian', card: drawn.cardId } } : {}
    }
    case 'jail_go': {
      sendToJail(state, player)
      return {}
    }
    case 'buildable_land': {
      const tile = state.tiles[player.position]!
      if (tile.ownerId === null) {
        state.turn.pendingBuyTileId = player.position
        logKey(
          state,
          'core.landedUnowned',
          { name: player.name, tile: tileP(player.position) },
          player.id,
        )
      } else if (tile.ownerId !== player.id && tile.landBuild && tile.tier >= 1) {
        const paid = payRent(
          state,
          player,
          tile.ownerId,
          computeRent(state, player.position),
          player.position,
        )
        return paid ? { rent: paid } : {}
      } else {
        logKey(
          state,
          'core.landedOn',
          { name: player.name, tile: tileP(player.position) },
          player.id,
        )
      }
      return {}
    }
    case 'law_office': {
      // Defer to the player's choice: they pick one legal action (or skip) via a
      // dedicated event while `pendingLawOffice` is set.
      state.turn.pendingLawOffice = true
      logKey(
        state,
        'core.arrivedAt',
        { name: player.name, tile: tileP(player.position) },
        player.id,
      )
      return {}
    }
    case 'vacation': {
      resolveRinjani(state, player)
      return {}
    }
    case 'go':
      logKey(state, 'core.landedGo', { name: player.name }, player.id)
      return {}
    case 'jail_visit':
    default:
      logKey(state, 'core.landedOn', { name: player.name, tile: tileP(player.position) }, player.id)
      return {}
  }
}

/**
 * Gunung Rinjani (vacation tile): every active, non-jailed player is summoned to
 * the mountain and pays a flat fee to the bank. Teleporting here grants no GO
 * salary. A player who can't pay raises a pending debt via `charge`.
 */
function resolveRinjani(state: GameState, lander: Player): void {
  logKey(state, 'core.rinjani', { name: lander.name }, lander.id)
  for (const p of state.players) {
    if (p.isEliminated || p.inJail) continue
    p.position = RINJANI_TILE_ID
    charge(state, p, RINJANI_FEE, null, 'fine', 'Gunung Rinjani vacation fee')
  }
}

export function sendToJail(state: GameState, player: Player): void {
  if (consumeOwnedCard(player, 'jail_free')) {
    logKey(state, 'core.jailFreePass', { name: player.name }, player.id)
    return
  }
  player.position = JAIL_TILE_ID
  player.inJail = true
  player.jailTurnsLeft = JAIL_DURATION_TURNS
  logKey(state, 'core.sentToJail', { name: player.name }, player.id)
}

function payRent(
  state: GameState,
  payer: Player,
  ownerId: string,
  amount: RupiahAmount,
  tileId: TileId,
): RentPaid | null {
  const owner = state.players.find((p) => p.id === ownerId)
  if (!owner) return null
  // A jailed owner collects no rent — the lander passes through free of charge.
  if (owner.inJail) {
    logKey(state, 'core.ownerInJail', { owner: owner.name, tile: tileP(tileId) }, payer.id)
    return null
  }
  // An accepted rent-immunity deal waives this rent entirely (no charge, no Investor cut).
  if (hasRentImmunity(state, payer.id, tileId)) {
    logKey(state, 'core.rentImmune', { name: payer.name, tile: tileP(tileId) }, payer.id)
    return null
  }
  if (amount <= 0) return null
  // A held rent-free pass waives this rent entirely, same as immunity.
  if (consumeOwnedCard(payer, 'rent_free')) {
    logKey(state, 'core.rentFreePass', { name: payer.name, tile: tileP(tileId) }, payer.id)
    return null
  }

  // `charge` pays immediately if affordable (and applies the Investor / builder
  // cut), or opens a pending debt the payer must settle before play continues.
  charge(state, payer, amount, ownerId, 'rent', `rent to ${owner.name}`, tileId)
  return { payerId: payer.id, ownerId, tileId, amount }
}

/** Rent owed when an opponent lands on a tile. */
export function computeRent(state: GameState, tileId: TileId): RupiahAmount {
  const def = getTileDef(tileId)
  const tile = state.tiles[tileId]!
  if (!tile.ownerId) return 0

  if (def.type === 'transport') {
    const count = transportOwnedCount(state, tile.ownerId)
    const base = (TRANSPORT_RENT[count] ?? 0) * tile.priceMultiplier
    return Math.round(applyRentEffects(base, tileId, state))
  }

  // Lahan Kosong: per-tier landing rent for the built business.
  if (def.type === 'buildable_land') {
    if (!tile.landBuild || tile.tier < 1) return 0
    const base = (landTier(tile.landBuild, tile.tier)?.rent ?? 0) * tile.priceMultiplier
    return Math.round(applyRentEffects(base, tileId, state))
  }

  // Property tile.
  const region = def.region
  if (!region) return 0
  const base = REGIONS[region].rentBase
  const tier = effectiveTier(state, tileId, tile.tier)
  let mult = 1
  if (tier >= 1) {
    if (tile.track === 'house') mult = HOUSE_TIERS[tier - 1]?.rentMult ?? 1
    else if (tile.track === 'property') {
      // Property rent is flat: tier-1 price for tiers 1–4, tier-2 price at max tier.
      // Property value comes from passive income (see collectPassiveIncome), not rent.
      const rentIdx = tier >= PROPERTY_TIERS.length ? 1 : 0
      mult = PROPERTY_TIERS[rentIdx]?.rentMult ?? 1
    }
  } else {
    // Bare, unbuilt owned land rents at the Tier-1 property rate (half rentBase),
    // uniform across regions — so undeveloped land isn't as costly as a built house.
    mult = PROPERTY_TIERS[0].rentMult
  }
  let rent = base * mult * tile.priceMultiplier
  if (ownsFullRegion(state, tile.ownerId, region)) rent *= REGION_SET_RENT_MULTIPLIER
  rent = applyRentEffects(rent, tileId, state)
  return Math.round(rent)
}

/** Purchase a buyable (property/transport/land) tile for a player. No turn/landing constraint. */
export function buyTile(state: GameState, player: Player, tileId: TileId): void {
  const def = getTileDef(tileId)
  if (def.type !== 'property' && def.type !== 'transport' && def.type !== 'buildable_land') {
    throw new EngineError('core.tileNotBuyable')
  }
  const tile = state.tiles[tileId]
  if (!tile) throw new EngineError('core.invalidTile')
  if (tile.ownerId !== null) throw new EngineError('core.tileAlreadyOwned')

  // Lahan Kosong is a flat-priced bare plot (no region, no Sales discount); other
  // buyable tiles use their region/transport price with role discounts applied.
  let price: RupiahAmount
  if (def.type === 'buildable_land') {
    price = LAHAN_LAND_PRICE
  } else {
    const basePrice = def.type === 'transport' ? TRANSPORT_BUY_PRICE : REGIONS[def.region!].buyPrice
    price = Math.round(basePrice * buyPriceMultiplier(player))
  }
  if (player.cash < price) throw new EngineError('core.notEnoughCash')

  player.cash -= price
  state.bank += price
  tile.ownerId = player.id
  tile.track = null
  tile.tier = 0
  tile.builderId = null
  tile.landBuild = null
  tile.priceMultiplier = 1
  logKey(
    state,
    'core.boughtTile',
    { name: player.name, tile: tileP(tileId), amount: rpP(price) },
    player.id,
  )
}

export function buyProperty(state: GameState, playerId: string, tileId: TileId): void {
  const player = requireTurn(state, playerId)
  if (state.turn.pendingBuyTileId !== tileId) {
    throw new EngineError('core.canOnlyBuyLandedTile')
  }
  buyTile(state, player, tileId)
  state.turn.pendingBuyTileId = null
}

/**
 * Develop a property tile one tier along its House or Property track. The owner
 * builds on their own tile; a Kontraktor may instead build on another player's
 * tile (recording `builderId` so they earn a rent cut). The first build on a
 * tile picks + locks its track. Costs region buyPrice × the tier's buildCostMult.
 */
export function upgradeProperty(
  state: GameState,
  playerId: string,
  tileId: TileId,
  track?: PropertyTrack,
): void {
  const player = requireTurn(state, playerId)
  const def = getTileDef(tileId)
  if (def.type !== 'property' || !def.region) {
    throw new EngineError('core.notPropertyTile')
  }
  const tile = state.tiles[tileId]
  if (!tile || tile.ownerId === null) throw new EngineError('core.tileNotOwned')

  const isOwn = tile.ownerId === player.id
  const isKontraktorBuild = !isOwn && player.role === 'kontraktor'
  if (!isOwn && !isKontraktorBuild) throw new EngineError('core.notYourTile')

  // Optional room rule: the tile owner must own the whole region before building.
  if (state.settings.requireFullRegionToBuild && !ownsFullRegion(state, tile.ownerId, def.region)) {
    throw new EngineError('core.needFullRegion')
  }

  // No per-turn upgrade cap: a player may develop as many tiers as cash allows.

  // First build picks + locks the track; later builds must stay on it.
  let activeTrack = tile.track
  if (tile.tier === 0) {
    if (!track) throw new EngineError('core.chooseTrack')
    activeTrack = track
  } else if (track && track !== tile.track) {
    throw new EngineError('core.trackLocked')
  }
  if (!activeTrack) throw new EngineError('core.chooseTrackFirst')

  const tiers = activeTrack === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  if (tile.tier >= tiers.length) throw new EngineError('core.topTier')

  const nextTier = tile.tier + 1
  const tierDef = tiers[nextTier - 1]!
  // Build cost scales with the tile's price multiplier — a boosted (more valuable)
  // tile costs proportionally more to develop further.
  const cost = Math.round(
    REGIONS[def.region].buyPrice *
      tierDef.buildCostMult *
      buildCostMultiplier(player) *
      tile.priceMultiplier,
  )
  if (player.cash < cost) throw new EngineError('core.notEnoughCashBuild')

  player.cash -= cost
  state.bank += cost
  tile.track = activeTrack
  tile.tier = nextTier
  if (isKontraktorBuild) tile.builderId = player.id

  if (isKontraktorBuild) {
    const owner = state.players.find((p) => p.id === tile.ownerId)
    logKey(
      state,
      'core.kontraktorBuilt',
      {
        name: player.name,
        tier: tierP(activeTrack!, nextTier),
        owner: owner?.name ?? 'a',
        tile: tileP(tileId),
        amount: rpP(cost),
      },
      player.id,
    )
  } else {
    logKey(
      state,
      'core.upgradedTile',
      {
        name: player.name,
        tile: tileP(tileId),
        tier: tierP(activeTrack!, nextTier),
        amount: rpP(cost),
      },
      player.id,
    )
  }
}

/** Sell an owned tile back to the bank for a partial refund (SELL_REFUND_RATE of invested value). */
export function sellProperty(state: GameState, playerId: string, tileId: TileId): void {
  // Allowed on your turn, or out of turn while you owe a debt (to raise cash).
  const player = requireDebtorOrTurn(state, playerId)
  const tile = state.tiles[tileId]
  if (!tile) throw new EngineError('core.invalidTile')
  if (tile.ownerId !== player.id) throw new EngineError('core.notYourTile')

  const refund = Math.round(tileValue(state, tile) * SELL_REFUND_RATE)
  player.cash += refund
  state.bank -= refund
  tile.ownerId = null
  tile.track = null
  tile.tier = 0
  tile.builderId = null
  tile.landBuild = null
  tile.priceMultiplier = 1
  logKey(
    state,
    'core.soldTile',
    { name: player.name, tile: tileP(tileId), amount: rpP(refund) },
    player.id,
  )
  // If this covered a pending debt, settle it (and advance off an eliminated turn).
  settleIfAble(state, playerId)
}

/**
 * Downgrade an owned tile one tier, refunding SELL_REFUND_RATE of the current
 * tier's build cost. Allowed on your turn, or out of turn while you owe a debt
 * (to raise cash). Dropping to tier 0 unlocks the track (ownership of the bare
 * land is kept). Mutates state; throws EngineError on invalid input.
 */
export function downgradeProperty(state: GameState, playerId: string, tileId: TileId): void {
  const player = requireDebtorOrTurn(state, playerId)
  const def = getTileDef(tileId)
  const tile = state.tiles[tileId]
  if (!tile) throw new EngineError('core.invalidTile')
  if (tile.ownerId !== player.id) throw new EngineError('core.notYourTile')
  if (tile.tier < 1) throw new EngineError('core.nothingToDowngrade')

  // Lahan Kosong: drop one business tier; refund SELL_REFUND_RATE of its build cost.
  if (def.type === 'buildable_land') {
    if (!tile.landBuild) throw new EngineError('core.nothingToDowngrade')
    const savedBusiness = tile.landBuild
    const savedLandTier = tile.tier
    const tierDef = landTier(savedBusiness, savedLandTier)
    if (!tierDef) throw new EngineError('core.nothingToDowngrade')
    const refund = Math.round(tierDef.buildCost * SELL_REFUND_RATE * tile.priceMultiplier)
    player.cash += refund
    state.bank -= refund
    tile.tier -= 1
    if (tile.tier === 0) tile.landBuild = null
    logKey(
      state,
      'core.downgradedLand',
      {
        name: player.name,
        tier: landTierP(savedBusiness, savedLandTier),
        tile: tileP(tileId),
        amount: rpP(refund),
      },
      player.id,
    )
    // If this covered a pending debt, settle it (and advance off an eliminated turn).
    settleIfAble(state, playerId)
    return
  }

  if (def.type !== 'property' || !def.region) {
    throw new EngineError('core.notPropertyTileDowngrade')
  }

  const savedTrack = tile.track!
  const savedTier = tile.tier
  const tiers = savedTrack === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  const tierDef = tiers[savedTier - 1]!
  const refund = Math.round(
    REGIONS[def.region].buyPrice * tierDef.buildCostMult * SELL_REFUND_RATE * tile.priceMultiplier,
  )
  player.cash += refund
  state.bank -= refund
  tile.tier -= 1
  if (tile.tier === 0) {
    tile.track = null
    tile.builderId = null
  }
  logKey(
    state,
    'core.downgradedProperty',
    {
      name: player.name,
      tile: tileP(tileId),
      tier: tierP(savedTrack, savedTier),
      amount: rpP(refund),
    },
    player.id,
  )
  // If this covered a pending debt, settle it (and advance off an eliminated turn).
  settleIfAble(state, playerId)
}

// ---- Special tile actions (board re-layout, TTG-29) ----

/**
 * Build or upgrade a business on an owned Lahan Kosong (buildable_land) tile.
 * Turn-only. The first build (tier 0 → 1) picks the business and locks it; later
 * calls upgrade one tier at a time up to LAND_MAX_TIER. Each tier costs a flat
 * fee to the bank. Upgrades are free of the per-turn property upgrade cap.
 */
export function buildLahan(
  state: GameState,
  playerId: string,
  tileId: TileId,
  business: LandBusiness,
): void {
  const player = requireTurn(state, playerId)
  const def = getTileDef(tileId)
  if (def.type !== 'buildable_land') throw new EngineError('core.notBuildableLand')
  if (business !== 'dapur_mbg' && business !== 'warkop_cafe') {
    throw new EngineError('core.invalidBusiness')
  }
  const tile = state.tiles[tileId]
  if (!tile) throw new EngineError('core.invalidTile')
  if (tile.ownerId !== player.id) throw new EngineError('core.notYourLand')

  // First build locks the business; later builds must stay on it.
  if (tile.landBuild && tile.landBuild !== business) {
    throw new EngineError('core.landBizLocked')
  }
  if (tile.tier >= LAND_MAX_TIER) throw new EngineError('core.alreadyTopTier')

  const nextTier = tile.tier + 1
  const tierDef = landTier(business, nextTier)
  if (!tierDef) throw new EngineError('core.invalidTier')
  const cost = Math.round(tierDef.buildCost * buildCostMultiplier(player) * tile.priceMultiplier)
  if (player.cash < cost) throw new EngineError('core.notEnoughCashBuild')

  player.cash -= cost
  state.bank += cost
  tile.landBuild = business
  tile.tier = nextTier
  if (nextTier === 1) {
    logKey(
      state,
      'core.lahanBuilt',
      {
        name: player.name,
        tier: landTierP(business, nextTier),
        tile: tileP(tileId),
        amount: rpP(cost),
      },
      player.id,
    )
  } else {
    logKey(
      state,
      'core.lahanUpgraded',
      {
        name: player.name,
        tier: landTierP(business, nextTier),
        tile: tileP(tileId),
        amount: rpP(cost),
      },
      player.id,
    )
  }
}

/**
 * Voluntarily repay pinjol principal on your turn — one loan by id, or every
 * loan when `loanId` is omitted. The principal returns to the lending Rentenir
 * (if still in the game) or the bank. Mutates state; throws if unaffordable.
 */
export function repayPinjol(state: GameState, playerId: string, loanId?: string): void {
  const player = requireTurn(state, playerId)
  if (player.loans.length === 0) throw new EngineError('core.noLoans')
  const loans = loanId ? player.loans.filter((l) => l.id === loanId) : [...player.loans]
  if (loans.length === 0) throw new EngineError('core.loanNotFound')
  const total = loans.reduce((sum, l) => sum + l.amount, 0)
  if (player.cash < total) throw new EngineError('core.notEnoughCashRepay')

  for (const loan of loans) {
    const lender = loan.lenderId
      ? state.players.find((p) => p.id === loan.lenderId && !p.isEliminated)
      : null
    if (lender) lender.cash += loan.amount
    else state.bank += loan.amount
    player.cash -= loan.amount
    player.loans = player.loans.filter((l) => l.id !== loan.id)
  }
  logKey(state, 'core.repaidPinjol', { name: player.name, amount: rpP(total) }, player.id)
}

export function payJail(state: GameState, playerId: string): void {
  const player = requireTurn(state, playerId)
  if (!player.inJail) throw new EngineError('core.notInJail')
  if (player.cash < JAIL_EXIT_COST) throw new EngineError('core.notEnoughCashBail')
  player.cash -= JAIL_EXIT_COST
  state.bank += JAIL_EXIT_COST
  player.inJail = false
  player.jailTurnsLeft = 0
  logKey(state, 'core.paidBail', { name: player.name, amount: rpP(JAIL_EXIT_COST) }, player.id)
}

export function endTurn(state: GameState, playerId: string): void {
  const player = requireTurn(state, playerId)
  if (!state.turn.hasRolled) throw new EngineError('core.notRolled')
  logKey(state, 'core.endedTurn', { name: player.name }, player.id)
  advanceTurn(state)
}

export * from './board.js'
export { collectPassiveIncome } from './turn.js'
export { useAbility } from './abilities.js'
// Kantor Hukum subsystem lives in lawoffice.ts; re-exported so the engine's import
// surface (realtime handlers + tests import these from index.js) is unchanged.
export {
  concedeAuction,
  lawOfficeBuy,
  lawOfficeFreepass,
  lawOfficeJail,
  lawOfficePriceUpgrade,
  lawOfficeSkip,
  placeAuctionBid,
  resolveAuctionTimeout,
  startLawOfficeAuction,
} from './lawoffice.js'
export { forceLoan, takeLoan } from './pinjol.js'
export { proposeDeal, respondToDeal } from './negotiation.js'
export {
  applyAfkTimeout,
  finalStandings,
  forfeit,
  playerWealth,
  resolveDebt,
  resolveGameOver,
} from './elimination.js'
