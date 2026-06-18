// Shared fixtures for the engine unit tests. Each test builds a real lobby state
// via the engine constructors, then mutates only the fields it cares about — this
// keeps the tests resilient to GameState shape changes.
import type {
  ActiveEffect,
  GameState,
  LandBusiness,
  PendingDebt,
  Player,
  PropertyTrack,
  Role,
  RoomSettings,
  TileId,
} from '@tuan-tanah/shared'
import { addPlayer, createGameState } from '../src/engine/index.js'
import type { Rng } from '../src/engine/util.js'

interface MakeGameOpts {
  /** Role per player (by join order); omitted entries stay null. */
  roles?: (Role | null)[]
  /** Cash dealt to every player (default: a comfortable Rp 1 miliar). */
  cash?: number
  /** Partial settings merged over the defaults. */
  settings?: Partial<RoomSettings>
  /** Leave the game in 'lobby' instead of flipping to 'playing'. */
  lobby?: boolean
}

/** Build a playing-phase game with `count` players seeded with cash. */
export function makeGame(
  count: number,
  opts: MakeGameOpts = {},
): { state: GameState; players: Player[] } {
  const state = createGameState('test-room', 0)
  const players: Player[] = []
  for (let i = 0; i < count; i++) players.push(addPlayer(state, `P${i + 1}`))

  opts.roles?.forEach((role, i) => {
    if (players[i]) players[i]!.role = role
  })
  const cash = opts.cash ?? 1_000_000_000
  for (const p of players) p.cash = cash
  // Most engine tests build on a single tile and aren't about the region rule;
  // default it off so they stay focused. Tests for the rule opt in via settings.
  state.settings.requireFullRegionToBuild = false
  if (opts.settings) Object.assign(state.settings, opts.settings)

  if (!opts.lobby) {
    state.phase = 'playing'
    state.round = 1
    state.startedAt = 0
  }
  return { state, players }
}

interface OwnOpts {
  track?: PropertyTrack
  tier?: number
  builderId?: string | null
  /** For buildable_land tiles: the business built on it. */
  landBuild?: LandBusiness | null
}

/** Assign ownership (and optional development) to a tile. */
export function own(state: GameState, tileId: TileId, ownerId: string, opts: OwnOpts = {}): void {
  const tile = state.tiles[tileId]!
  tile.ownerId = ownerId
  tile.track = opts.track ?? null
  tile.tier = opts.tier ?? 0
  tile.builderId = opts.builderId ?? null
  tile.landBuild = opts.landBuild ?? null
}

let effectSeq = 0
/** Push an active effect with sensible defaults; returns it. */
export function addEffect(state: GameState, effect: Partial<ActiveEffect>): ActiveEffect {
  const full: ActiveEffect = {
    id: `effect-${effectSeq++}`,
    type: 'rent_multiplier',
    roundsRemaining: 1,
    sourceCard: 'test',
    ...effect,
  }
  state.activeEffects.push(full)
  return full
}

let debtSeq = 0
/** Push a pending debt with sensible defaults; returns it. */
export function addDebt(
  state: GameState,
  debt: Partial<PendingDebt> & { debtorId: string },
): PendingDebt {
  const full: PendingDebt = {
    id: `debt-${debtSeq++}`,
    creditorId: null,
    amount: 0,
    type: 'tax',
    reason: 'test debt',
    ...debt,
  }
  state.pendingDebts.push(full)
  return full
}

/** A deterministic RNG that yields the given values, cycling when exhausted. */
export function seqRng(values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]!
}
