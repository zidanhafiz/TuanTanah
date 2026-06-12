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
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  PROPERTY_TIERS,
  REGIONS,
  REGION_SET_RENT_MULTIPLIER,
  STARTING_CASH_DEFAULT,
  STARTING_CASH_MAX,
  STARTING_CASH_MIN,
  TRANSPORT_BUY_PRICE,
  TRANSPORT_RENT,
} from '@tuan-tanah/shared'
import type {
  GameState,
  Player,
  Role,
  RoomSettings,
  RupiahAmount,
  TileId,
} from '@tuan-tanah/shared'
import { getTileDef, ownsFullRegion, transportOwnedCount } from './board.js'
import { drawHustle, drawKejadian } from './cards.js'
import { applyRentEffects } from './effects.js'
import { buyPriceMultiplier, salaryFor } from './roles.js'
import { advanceTurn, startTurn } from './turn.js'
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
    })),
    turn: {
      hasRolled: false,
      lastDice: null,
      rolledDoubles: false,
      pendingBuyTileId: null,
      usedMetaAction: false,
    },
    activeEffects: [],
    kejadianDeck: [],
    hustleDeck: [],
    bank: BANK_STARTING,
    settings: {
      winCondition: 'both',
      timeLimitMinutes: 60,
      targetWealth: 100_000_000,
      startingCash: STARTING_CASH_DEFAULT,
      enabledRoles: [...ALL_ROLES],
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
    isEliminated: false,
    isRoomMaster: state.players.length === 0,
    isConnected: true,
    usedAbility: false,
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
  if (partial.enabledRoles) {
    // Unpick any roles that became disabled.
    for (const p of state.players) {
      if (p.role && !partial.enabledRoles.includes(p.role)) p.role = null
    }
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
  for (const p of state.players) {
    p.cash = state.settings.startingCash
    p.position = GO_TILE_ID
    p.inJail = false
    p.jailTurnsLeft = 0
    p.loans = []
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
  return current
}

export interface RollResult {
  dice: [number, number]
  card?: { type: 'kejadian' | 'hustle'; card: string }
}

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

  return { dice: [d1, d2], ...movePlayer(state, player, d1 + d2) }
}

function movePlayer(
  state: GameState,
  player: Player,
  steps: number,
): { card?: { type: 'kejadian' | 'hustle'; card: string } } {
  const oldPos = player.position
  const passedGo = oldPos + steps >= BOARD_SIZE
  player.position = (oldPos + steps) % BOARD_SIZE
  if (passedGo) {
    const salary = salaryFor(player)
    player.cash += salary
    state.bank -= salary
    pushLog(state, `${player.name} passed GO (+${rupiah(salary)} salary)`, player.id)
  }
  return resolveTile(state, player)
}

function resolveTile(
  state: GameState,
  player: Player,
): { card?: { type: 'kejadian' | 'hustle'; card: string } } {
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
        payRent(state, player, tile.ownerId, rent)
      } else {
        pushLog(state, `${player.name} landed on their own ${def.name}`, player.id)
      }
      return {}
    }
    case 'tax': {
      const amount = def.taxAmount ?? 0
      player.cash -= amount
      state.bank += amount
      pushLog(state, `${player.name} paid ${def.name} (${rupiah(amount)})`, player.id)
      return {}
    }
    case 'hustle': {
      const drawn = drawHustle(state, player)
      return drawn ? { card: { type: 'hustle', card: drawn.cardId } } : {}
    }
    case 'event': {
      const drawn = drawKejadian(state, player)
      return drawn ? { card: { type: 'kejadian', card: drawn.cardId } } : {}
    }
    case 'jail_go': {
      sendToJail(state, player)
      return {}
    }
    case 'go':
      pushLog(state, `${player.name} landed on GO`, player.id)
      return {}
    case 'jail_visit':
    case 'parking':
    default:
      pushLog(state, `${player.name} landed on ${def.name}`, player.id)
      return {}
  }
}

export function sendToJail(state: GameState, player: Player): void {
  player.position = JAIL_TILE_ID
  player.inJail = true
  player.jailTurnsLeft = JAIL_DURATION_TURNS
  pushLog(state, `${player.name} was sent to jail`, player.id)
}

function payRent(state: GameState, payer: Player, ownerId: string, amount: RupiahAmount): void {
  const owner = state.players.find((p) => p.id === ownerId)
  if (!owner) return
  payer.cash -= amount
  owner.cash += amount
  pushLog(state, `${payer.name} paid ${rupiah(amount)} rent to ${owner.name}`, payer.id)
  // TODO: investor 5% rent cut, immunity deals, can't-pay → elimination flow.
}

/** Rent owed when an opponent lands on a tile. */
export function computeRent(state: GameState, tileId: TileId): RupiahAmount {
  const def = getTileDef(tileId)
  const tile = state.tiles[tileId]!
  if (!tile.ownerId) return 0

  if (def.type === 'transport') {
    const count = transportOwnedCount(state, tile.ownerId)
    return TRANSPORT_RENT[count] ?? 0
  }

  // Property tile.
  const region = def.region
  if (!region) return 0
  const base = REGIONS[region].rentBase
  let mult = 1
  if (tile.tier >= 1) {
    if (tile.track === 'house') mult = HOUSE_TIERS[tile.tier - 1]?.rentMult ?? 1
    else if (tile.track === 'property') mult = PROPERTY_TIERS[tile.tier - 1]?.rentMult ?? 1
  }
  let rent = base * mult
  if (ownsFullRegion(state, tile.ownerId, region)) rent *= REGION_SET_RENT_MULTIPLIER
  rent = applyRentEffects(rent, tileId, state)
  return Math.round(rent)
}

/** Purchase a buyable (property/transport) tile for a player. No turn/landing constraint. */
export function buyTile(state: GameState, player: Player, tileId: TileId): void {
  const def = getTileDef(tileId)
  if (def.type !== 'property' && def.type !== 'transport') {
    throw new EngineError('That tile cannot be bought')
  }
  const tile = state.tiles[tileId]
  if (!tile) throw new EngineError('Invalid tile')
  if (tile.ownerId !== null) throw new EngineError('Tile already owned')

  const basePrice = def.type === 'transport' ? TRANSPORT_BUY_PRICE : REGIONS[def.region!].buyPrice
  const price = Math.round(basePrice * buyPriceMultiplier(player))
  if (player.cash < price) throw new EngineError('Not enough cash')

  player.cash -= price
  state.bank += price
  tile.ownerId = player.id
  tile.track = null
  tile.tier = 0
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
