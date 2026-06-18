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
  LAHAN_BUILD_COST,
  LAHAN_LAND_PRICE,
  LAW_OFFICE_FREEPASS_PRICE,
  LAW_OFFICE_JAIL_FEE,
  LAW_OFFICE_TRANSFER_RATE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  PROPERTY_TIERS,
  REGIONS,
  REGION_SET_RENT_MULTIPLIER,
  RINJANI_FEE,
  RINJANI_TILE_ID,
  SELL_REFUND_RATE,
  STARTING_CASH_DEFAULT,
  STARTING_CASH_MAX,
  STARTING_CASH_MIN,
  TARGET_WEALTH_MAX,
  TARGET_WEALTH_MIN,
  TIME_LIMIT_OPTIONS,
  TRANSPORT_BUY_PRICE,
  TRANSPORT_RENT,
  WARKOP_RENT,
} from '@tuan-tanah/shared'
import type {
  GameState,
  LandBusiness,
  PassType,
  Player,
  PropertyTrack,
  Role,
  RoomSettings,
  RupiahAmount,
  TileId,
} from '@tuan-tanah/shared'
import { getTileDef, ownsFullRegion, transportOwnedCount } from './board.js'
import { drawHustle, drawKejadian } from './cards.js'
import { charge, settleIfAble, tileValue } from './elimination.js'
import { applyRentEffects, consumeOwnedCard, effectiveTier, hasRentImmunity } from './effects.js'
import { buyPriceMultiplier, isTaxImmune, salaryFor } from './roles.js'
import { advanceTurn, collectPassiveIncome, startTurn } from './turn.js'
import { defaultRng, pushLog, shuffle, uid, type Rng } from './util.js'

export class EngineError extends Error {}

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
    })),
    turn: {
      hasRolled: false,
      lastDice: null,
      rolledDoubles: false,
      pendingBuyTileId: null,
      upgradesUsed: 0,
      pendingLawOffice: false,
    },
    activeEffects: [],
    kejadianDeck: [],
    hustleDeck: [],
    pendingKejadianBlock: false,
    pendingDebts: [],
    pendingDeals: [],
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
  if (state.phase !== 'lobby') throw new EngineError('Game already started')
  if (state.players.length >= MAX_PLAYERS) throw new EngineError('Room is full')
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
    metaActionsUsed: [],
    owesLapInterest: false,
  }
  state.players.push(player)
  pushLog(state, `${player.name} joined the room`, player.id)
  return player
}

export function getPlayer(state: GameState, playerId: string): Player {
  const p = state.players.find((x) => x.id === playerId)
  if (!p) throw new EngineError('Player not in room')
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
  if (removed) pushLog(state, `${removed.name} left the room`)
  // Reassign room master if needed.
  if (removed?.isRoomMaster && state.players[0]) state.players[0].isRoomMaster = true
}

export function pickRole(state: GameState, playerId: string, role: Role | null): void {
  if (state.phase !== 'lobby') throw new EngineError('Cannot change role after start')
  const player = getPlayer(state, playerId)
  if (role !== null) {
    if (!state.settings.enabledRoles.includes(role)) throw new EngineError('Role is disabled')
    const taken = state.players.some((p) => p.id !== playerId && p.role === role)
    if (taken) throw new EngineError('Role already taken')
  }
  player.role = role
}

export function updateSettings(
  state: GameState,
  playerId: string,
  partial: Partial<RoomSettings>,
): void {
  if (state.phase !== 'lobby') throw new EngineError('Cannot change settings after start')
  const player = getPlayer(state, playerId)
  if (!player.isRoomMaster) throw new EngineError('Only the room master can change settings')
  const next = { ...state.settings, ...partial }
  if (partial.startingCash !== undefined) {
    next.startingCash = Math.min(
      STARTING_CASH_MAX,
      Math.max(STARTING_CASH_MIN, partial.startingCash),
    )
  }
  if (partial.winCondition !== undefined) {
    if (!['time', 'wealth', 'both'].includes(partial.winCondition)) {
      throw new EngineError('Invalid win condition')
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
      throw new EngineError('Invalid time limit')
    }
  }
  if (partial.enabledRoles) {
    if (!Array.isArray(partial.enabledRoles)) throw new EngineError('Invalid roles')
    // Reject unknown role ids and de-dupe, so a crafted client can't inject
    // arbitrary strings into shared state.
    const valid = [...new Set(partial.enabledRoles)].filter((r) => ALL_ROLES.includes(r))
    if (valid.length === 0) throw new EngineError('At least one role must be enabled')
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
  if (state.phase !== 'lobby') throw new EngineError('Game already started')
  const player = getPlayer(state, playerId)
  if (!player.isRoomMaster) throw new EngineError('Only the room master can start')
  const active = state.players.filter((p) => p.isConnected)
  if (active.length < MIN_PLAYERS) throw new EngineError('Need at least 2 players')
  if (active.some((p) => p.role === null)) throw new EngineError('All players must pick a role')

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
  pushLog(state, 'Game started!')
  startTurn(state)
}

// ---- In-game actions ----

export function requireTurn(state: GameState, playerId: string): Player {
  if (state.phase !== 'playing') throw new EngineError('Game is not in progress')
  const current = state.players[state.currentPlayerIndex]
  if (!current || current.id !== playerId) throw new EngineError('Not your turn')
  if (current.isEliminated) throw new EngineError('You have been eliminated')
  if (state.pendingDebts.length > 0) {
    throw new EngineError('Resolve outstanding debts before continuing')
  }
  return current
}

/**
 * Like `requireTurn`, but also allows a player who has a pending debt to act
 * out of turn — so an indebted player can sell property or take a pinjol to
 * raise the cash even when it isn't their turn.
 */
export function requireDebtorOrTurn(state: GameState, playerId: string): Player {
  if (state.phase !== 'playing') throw new EngineError('Game is not in progress')
  const player = state.players.find((p) => p.id === playerId)
  if (!player) throw new EngineError('Player not found')
  if (player.isEliminated) throw new EngineError('You have been eliminated')
  const isTurn = state.players[state.currentPlayerIndex]?.id === playerId
  const hasDebt = state.pendingDebts.some((d) => d.debtorId === playerId)
  if (!isTurn && !hasDebt) throw new EngineError('Not your turn')
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
  if (state.turn.hasRolled) throw new EngineError('Already rolled this turn')

  const d1 = Math.floor(rng() * 6) + 1
  const d2 = Math.floor(rng() * 6) + 1
  const doubles = d1 === d2
  state.turn.hasRolled = true
  state.turn.lastDice = [d1, d2]
  state.turn.rolledDoubles = doubles
  pushLog(
    state,
    `${player.name} rolled ${d1} + ${d2} = ${d1 + d2}${doubles ? ' (doubles!)' : ''}`,
    player.id,
  )

  if (player.inJail) {
    if (doubles) {
      player.inJail = false
      player.jailTurnsLeft = 0
      pushLog(state, `${player.name} rolled doubles and escaped jail`, player.id)
    } else {
      player.jailTurnsLeft -= 1
      if (player.jailTurnsLeft <= 0) {
        player.inJail = false
        pushLog(state, `${player.name} served their time and is released`, player.id)
      } else {
        pushLog(
          state,
          `${player.name} stays in jail (${player.jailTurnsLeft} turn(s) left)`,
          player.id,
        )
      }
      return { dice: [d1, d2] }
    }
  }

  return { dice: [d1, d2], ...movePlayer(state, player, d1 + d2, rng) }
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
    pushLog(state, `${player.name} passed GO (+${rupiah(salary)} salary)`, player.id)
    // A new lap: refresh the meta-action allowance, and mark loan interest due
    // (charged at the start of their next turn, off the movement/debt path).
    player.metaActionsUsed = []
    if (player.loans.length > 0) player.owesLapInterest = true
    // Passive income pays once per lap, before resolving the tile they land on
    // so the cash is on hand if they owe rent there.
    collectPassiveIncome(state, player)
  }
  return resolveTile(state, player, rng)
}

function resolveTile(state: GameState, player: Player, rng: Rng = defaultRng): TileOutcome {
  const def = getTileDef(player.position)
  switch (def.type) {
    case 'property':
    case 'transport': {
      const tile = state.tiles[player.position]!
      if (tile.ownerId === null) {
        state.turn.pendingBuyTileId = player.position
        pushLog(state, `${player.name} landed on ${def.name} (unowned)`, player.id)
      } else if (tile.ownerId !== player.id) {
        const rent = computeRent(state, player.position)
        const paid = payRent(state, player, tile.ownerId, rent, player.position)
        return paid ? { rent: paid } : {}
      } else {
        pushLog(state, `${player.name} landed on their own ${def.name}`, player.id)
      }
      return {}
    }
    case 'tax': {
      if (isTaxImmune(player)) {
        pushLog(state, `${player.name} skipped ${def.name} (tax-immune)`, player.id)
        return {}
      }
      if (consumeOwnedCard(player, 'tax_free')) {
        pushLog(state, `${player.name} used a tax-free pass on ${def.name}`, player.id)
        return {}
      }
      const amount = def.taxAmount ?? 0
      charge(state, player, amount, null, 'tax', def.name)
      return {}
    }
    case 'hustle': {
      const drawn = drawHustle(state, player)
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
        pushLog(state, `${player.name} landed on ${def.name} (unowned)`, player.id)
      } else if (tile.ownerId !== player.id && tile.landBuild === 'warkop_cafe') {
        const paid = payRent(state, player, tile.ownerId, WARKOP_RENT, player.position)
        return paid ? { rent: paid } : {}
      } else {
        pushLog(state, `${player.name} landed on ${def.name}`, player.id)
      }
      return {}
    }
    case 'law_office': {
      // Defer to the player's choice: they pick one legal action (or skip) via a
      // dedicated event while `pendingLawOffice` is set.
      state.turn.pendingLawOffice = true
      pushLog(state, `${player.name} arrived at ${def.name}`, player.id)
      return {}
    }
    case 'vacation': {
      resolveRinjani(state, player)
      return {}
    }
    case 'go':
      pushLog(state, `${player.name} landed on GO`, player.id)
      return {}
    case 'jail_visit':
    default:
      pushLog(state, `${player.name} landed on ${def.name}`, player.id)
      return {}
  }
}

/**
 * Gunung Rinjani (vacation tile): every active, non-jailed player is summoned to
 * the mountain and pays a flat fee to the bank. Teleporting here grants no GO
 * salary. A player who can't pay raises a pending debt via `charge`.
 */
function resolveRinjani(state: GameState, lander: Player): void {
  pushLog(
    state,
    `${lander.name} reached Gunung Rinjani — everyone is summoned to the mountain!`,
    lander.id,
  )
  for (const p of state.players) {
    if (p.isEliminated || p.inJail) continue
    p.position = RINJANI_TILE_ID
    charge(state, p, RINJANI_FEE, null, 'fine', 'Gunung Rinjani vacation fee')
  }
}

export function sendToJail(state: GameState, player: Player): void {
  if (consumeOwnedCard(player, 'jail_free')) {
    pushLog(state, `${player.name} used a jail-free pass and avoided jail`, player.id)
    return
  }
  player.position = JAIL_TILE_ID
  player.inJail = true
  player.jailTurnsLeft = JAIL_DURATION_TURNS
  pushLog(state, `${player.name} was sent to jail`, player.id)
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
  // An accepted rent-immunity deal waives this rent entirely (no charge, no Investor cut).
  if (hasRentImmunity(state, payer.id, tileId)) {
    pushLog(state, `${payer.name} is immune from rent on ${getTileDef(tileId).name}`, payer.id)
    return null
  }
  if (amount <= 0) return null
  // A held rent-free pass waives this rent entirely, same as immunity.
  if (consumeOwnedCard(payer, 'rent_free')) {
    pushLog(state, `${payer.name} used a rent-free pass on ${getTileDef(tileId).name}`, payer.id)
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
    const base = TRANSPORT_RENT[count] ?? 0
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
    else if (tile.track === 'property') mult = PROPERTY_TIERS[tier - 1]?.rentMult ?? 1
  }
  let rent = base * mult
  if (ownsFullRegion(state, tile.ownerId, region)) rent *= REGION_SET_RENT_MULTIPLIER
  rent = applyRentEffects(rent, tileId, state)
  return Math.round(rent)
}

/** Purchase a buyable (property/transport/land) tile for a player. No turn/landing constraint. */
export function buyTile(state: GameState, player: Player, tileId: TileId): void {
  const def = getTileDef(tileId)
  if (def.type !== 'property' && def.type !== 'transport' && def.type !== 'buildable_land') {
    throw new EngineError('That tile cannot be bought')
  }
  const tile = state.tiles[tileId]
  if (!tile) throw new EngineError('Invalid tile')
  if (tile.ownerId !== null) throw new EngineError('Tile already owned')

  // Lahan Kosong is a flat-priced bare plot (no region, no Sales discount); other
  // buyable tiles use their region/transport price with role discounts applied.
  let price: RupiahAmount
  if (def.type === 'buildable_land') {
    price = LAHAN_LAND_PRICE
  } else {
    const basePrice = def.type === 'transport' ? TRANSPORT_BUY_PRICE : REGIONS[def.region!].buyPrice
    price = Math.round(basePrice * buyPriceMultiplier(player))
  }
  if (player.cash < price) throw new EngineError('Not enough cash')

  player.cash -= price
  state.bank += price
  tile.ownerId = player.id
  tile.track = null
  tile.tier = 0
  tile.builderId = null
  tile.landBuild = null
  pushLog(state, `${player.name} bought ${def.name} for ${rupiah(price)}`, player.id)
}

export function buyProperty(state: GameState, playerId: string, tileId: TileId): void {
  const player = requireTurn(state, playerId)
  if (state.turn.pendingBuyTileId !== tileId) {
    throw new EngineError('You can only buy the tile you just landed on')
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
    throw new EngineError('Only property tiles can be developed')
  }
  const tile = state.tiles[tileId]
  if (!tile || tile.ownerId === null) throw new EngineError('That tile is not owned')

  const isOwn = tile.ownerId === player.id
  const isKontraktorBuild = !isOwn && player.role === 'kontraktor'
  if (!isOwn && !isKontraktorBuild) throw new EngineError("You don't own that tile")

  // Optional room rule: the tile owner must own the whole region before building.
  if (state.settings.requireFullRegionToBuild && !ownsFullRegion(state, tile.ownerId, def.region)) {
    throw new EngineError('You must own the whole region before building here')
  }

  // Per-turn upgrade cap; Pengusaha may build twice.
  const limit = player.role === 'pengusaha' ? 2 : 1
  if (state.turn.upgradesUsed >= limit) {
    throw new EngineError('No upgrades left this turn')
  }

  // First build picks + locks the track; later builds must stay on it.
  let activeTrack = tile.track
  if (tile.tier === 0) {
    if (!track) throw new EngineError('Choose a track (house or property) for the first build')
    activeTrack = track
  } else if (track && track !== tile.track) {
    throw new EngineError('This tile is already locked to the other track')
  }
  if (!activeTrack) throw new EngineError('Choose a track for the first build')

  const tiers = activeTrack === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  if (tile.tier >= tiers.length) throw new EngineError('This tile is already at its top tier')

  const nextTier = tile.tier + 1
  const tierDef = tiers[nextTier - 1]!
  const cost = Math.round(REGIONS[def.region].buyPrice * tierDef.buildCostMult)
  if (player.cash < cost) throw new EngineError('Not enough cash to build')

  player.cash -= cost
  state.bank += cost
  tile.track = activeTrack
  tile.tier = nextTier
  if (isKontraktorBuild) tile.builderId = player.id
  state.turn.upgradesUsed += 1

  if (isKontraktorBuild) {
    const owner = state.players.find((p) => p.id === tile.ownerId)
    pushLog(
      state,
      `${player.name} built ${tierDef.name} on ${owner?.name ?? 'a'}'s ${def.name} for ${rupiah(cost)} (earns a rent cut)`,
      player.id,
    )
  } else {
    pushLog(
      state,
      `${player.name} upgraded ${def.name} to ${tierDef.name} for ${rupiah(cost)}`,
      player.id,
    )
  }
}

/** Sell an owned tile back to the bank for a partial refund (SELL_REFUND_RATE of invested value). */
export function sellProperty(state: GameState, playerId: string, tileId: TileId): void {
  // Allowed on your turn, or out of turn while you owe a debt (to raise cash).
  const player = requireDebtorOrTurn(state, playerId)
  const tile = state.tiles[tileId]
  if (!tile) throw new EngineError('Invalid tile')
  if (tile.ownerId !== player.id) throw new EngineError("You don't own that tile")

  const refund = Math.round(tileValue(tile) * SELL_REFUND_RATE)
  player.cash += refund
  state.bank -= refund
  tile.ownerId = null
  tile.track = null
  tile.tier = 0
  tile.builderId = null
  tile.landBuild = null
  pushLog(
    state,
    `${player.name} sold ${getTileDef(tileId).name} back to the bank for ${rupiah(refund)}`,
    player.id,
  )
  // If this covered a pending debt, settle it (and advance off an eliminated turn).
  settleIfAble(state, playerId)
}

/**
 * Downgrade an owned tile one tier, refunding SELL_REFUND_RATE of the current
 * tier's build cost. Turn-only. Dropping to tier 0 unlocks the track (ownership
 * of the bare land is kept). Mutates state; throws EngineError on invalid input.
 */
export function downgradeProperty(state: GameState, playerId: string, tileId: TileId): void {
  const player = requireTurn(state, playerId)
  const def = getTileDef(tileId)
  if (def.type !== 'property' || !def.region) {
    throw new EngineError('Only property tiles can be downgraded')
  }
  const tile = state.tiles[tileId]
  if (!tile) throw new EngineError('Invalid tile')
  if (tile.ownerId !== player.id) throw new EngineError("You don't own that tile")
  if (tile.tier < 1) throw new EngineError('Nothing to downgrade')

  const tiers = tile.track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  const tierDef = tiers[tile.tier - 1]!
  const refund = Math.round(REGIONS[def.region].buyPrice * tierDef.buildCostMult * SELL_REFUND_RATE)
  player.cash += refund
  state.bank -= refund
  tile.tier -= 1
  if (tile.tier === 0) {
    tile.track = null
    tile.builderId = null
  }
  pushLog(
    state,
    `${player.name} downgraded ${def.name} from ${tierDef.name} for ${rupiah(refund)}`,
    player.id,
  )
}

// ---- Special tile actions (board re-layout, TTG-29) ----

/**
 * Build one business on an owned Lahan Kosong (buildable_land) tile. Turn-only,
 * one build per tile (Dapur MBG or Warkop-Cafe, mutually exclusive). Costs a flat
 * fee to the bank. Does not count against the per-turn property upgrade cap.
 */
export function buildLahan(
  state: GameState,
  playerId: string,
  tileId: TileId,
  business: LandBusiness,
): void {
  const player = requireTurn(state, playerId)
  const def = getTileDef(tileId)
  if (def.type !== 'buildable_land') throw new EngineError('That tile is not buildable land')
  if (business !== 'dapur_mbg' && business !== 'warkop_cafe') {
    throw new EngineError('Invalid business')
  }
  const tile = state.tiles[tileId]
  if (!tile) throw new EngineError('Invalid tile')
  if (tile.ownerId !== player.id) throw new EngineError("You don't own that land")
  if (tile.landBuild) throw new EngineError('This land is already developed')
  if (player.cash < LAHAN_BUILD_COST) throw new EngineError('Not enough cash to build')

  player.cash -= LAHAN_BUILD_COST
  state.bank += LAHAN_BUILD_COST
  tile.landBuild = business
  const label = business === 'dapur_mbg' ? 'Dapur MBG' : 'Warkop-Cafe'
  pushLog(
    state,
    `${player.name} built ${label} on ${def.name} for ${rupiah(LAHAN_BUILD_COST)}`,
    player.id,
  )
}

/** Guard a Kantor Hukum action: must be the current player, standing on the tile. */
function requireLawOffice(state: GameState, playerId: string): Player {
  const player = requireTurn(state, playerId)
  if (!state.turn.pendingLawOffice) throw new EngineError('You are not at the Kantor Hukum')
  return player
}

/** Kantor Hukum: buy any unowned buyable tile remotely (normal price). */
export function lawOfficeBuy(state: GameState, playerId: string, tileId: TileId): void {
  const player = requireLawOffice(state, playerId)
  buyTile(state, player, tileId)
  state.turn.pendingLawOffice = false
}

/**
 * Kantor Hukum: force-buy another player's property at a 30% discount (pay
 * LAW_OFFICE_TRANSFER_RATE of its invested value to the owner). Tier, track and
 * builder carry over with the tile.
 */
export function lawOfficeTransfer(state: GameState, playerId: string, tileId: TileId): void {
  const player = requireLawOffice(state, playerId)
  const def = getTileDef(tileId)
  if (def.type !== 'property' && def.type !== 'transport') {
    throw new EngineError('Only properties can be force-transferred')
  }
  const tile = state.tiles[tileId]
  if (!tile || tile.ownerId === null) throw new EngineError('That tile is unowned — buy it instead')
  if (tile.ownerId === player.id) throw new EngineError('You already own that tile')
  const owner = state.players.find((p) => p.id === tile.ownerId)
  if (!owner || owner.isEliminated) throw new EngineError('That tile has no active owner')

  const price = Math.round(tileValue(tile) * LAW_OFFICE_TRANSFER_RATE)
  if (player.cash < price) throw new EngineError('Not enough cash for the transfer')
  player.cash -= price
  owner.cash += price
  tile.ownerId = player.id
  state.turn.pendingLawOffice = false
  pushLog(
    state,
    `${player.name} force-bought ${def.name} from ${owner.name} for ${rupiah(price)} (30% off)`,
    player.id,
  )
}

/** Kantor Hukum: pay a bribe to the bank to send another player to jail. */
export function lawOfficeJail(state: GameState, playerId: string, targetPlayerId: string): void {
  const player = requireLawOffice(state, playerId)
  if (targetPlayerId === playerId) throw new EngineError('You cannot jail yourself')
  const target = state.players.find((p) => p.id === targetPlayerId)
  if (!target || target.isEliminated) throw new EngineError('Invalid target')
  if (target.inJail) throw new EngineError('That player is already in jail')
  if (player.cash < LAW_OFFICE_JAIL_FEE) throw new EngineError('Not enough cash for the bribe')

  player.cash -= LAW_OFFICE_JAIL_FEE
  state.bank += LAW_OFFICE_JAIL_FEE
  pushLog(
    state,
    `${player.name} paid ${rupiah(LAW_OFFICE_JAIL_FEE)} to send ${target.name} to jail`,
    player.id,
  )
  sendToJail(state, target)
  state.turn.pendingLawOffice = false
}

/** Kantor Hukum: buy a single free-pass card (rent/tax/jail-free) into inventory. */
export function lawOfficeFreepass(state: GameState, playerId: string, pass: PassType): void {
  const player = requireLawOffice(state, playerId)
  if (pass !== 'rent_free' && pass !== 'tax_free' && pass !== 'jail_free') {
    throw new EngineError('Invalid pass type')
  }
  if (player.cash < LAW_OFFICE_FREEPASS_PRICE) {
    throw new EngineError('Not enough cash for a free-pass card')
  }
  player.cash -= LAW_OFFICE_FREEPASS_PRICE
  state.bank += LAW_OFFICE_FREEPASS_PRICE
  player.ownedCards.push({ id: uid(), type: pass })
  state.turn.pendingLawOffice = false
  const label = pass.replace('_', '-')
  pushLog(
    state,
    `${player.name} bought a ${label} pass for ${rupiah(LAW_OFFICE_FREEPASS_PRICE)}`,
    player.id,
  )
}

/** Kantor Hukum: decline to act and leave the tile. */
export function lawOfficeSkip(state: GameState, playerId: string): void {
  const player = requireLawOffice(state, playerId)
  state.turn.pendingLawOffice = false
  pushLog(state, `${player.name} left the Kantor Hukum without acting`, player.id)
}

/**
 * Voluntarily repay pinjol principal on your turn — one loan by id, or every
 * loan when `loanId` is omitted. The principal returns to the lending Rentenir
 * (if still in the game) or the bank. Mutates state; throws if unaffordable.
 */
export function repayPinjol(state: GameState, playerId: string, loanId?: string): void {
  const player = requireTurn(state, playerId)
  if (player.loans.length === 0) throw new EngineError('You have no loans to repay')
  const loans = loanId ? player.loans.filter((l) => l.id === loanId) : [...player.loans]
  if (loans.length === 0) throw new EngineError('Loan not found')
  const total = loans.reduce((sum, l) => sum + l.amount, 0)
  if (player.cash < total) throw new EngineError('Not enough cash to repay')

  for (const loan of loans) {
    const lender = loan.lenderId
      ? state.players.find((p) => p.id === loan.lenderId && !p.isEliminated)
      : null
    if (lender) lender.cash += loan.amount
    else state.bank += loan.amount
    player.cash -= loan.amount
    player.loans = player.loans.filter((l) => l.id !== loan.id)
  }
  pushLog(state, `${player.name} repaid ${rupiah(total)} in pinjol`, player.id)
}

export function payJail(state: GameState, playerId: string): void {
  const player = requireTurn(state, playerId)
  if (!player.inJail) throw new EngineError('You are not in jail')
  if (player.cash < JAIL_EXIT_COST) throw new EngineError('Not enough cash to pay bail')
  player.cash -= JAIL_EXIT_COST
  state.bank += JAIL_EXIT_COST
  player.inJail = false
  player.jailTurnsLeft = 0
  pushLog(state, `${player.name} paid ${rupiah(JAIL_EXIT_COST)} bail`, player.id)
}

export function endTurn(state: GameState, playerId: string): void {
  const player = requireTurn(state, playerId)
  if (!state.turn.hasRolled) throw new EngineError('Roll the dice before ending your turn')
  pushLog(state, `${player.name} ended their turn`, player.id)
  advanceTurn(state)
}

export * from './board.js'
export { collectPassiveIncome } from './turn.js'
export { useAbility } from './abilities.js'
export { takeLoan } from './pinjol.js'
export { proposeDeal, respondToDeal } from './negotiation.js'
export {
  finalStandings,
  forfeit,
  playerWealth,
  resolveDebt,
  resolveGameOver,
} from './elimination.js'
