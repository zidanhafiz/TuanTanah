// Kejadian + Hustle card handling.
// Draw a card (deck recycles), apply Hustle earnings and all Kejadian Nasional
// effects: immediate cash effects, timed effects pushed onto state.activeEffects
// (decayed each round by tickEffects), and the Pemilu vote.
import {
  BANJIR_DURATION_ROUNDS,
  BANJIR_TIER_DROP,
  BOARD,
  DEMO_BURUH_DURATION_ROUNDS,
  DEMO_BURUH_PASSIVE_MULTIPLIER,
  GEMPA_DURATION_ROUNDS,
  GEMPA_RENT_MULTIPLIER,
  HUSTLE_CARDS,
  INSPEKSI_PAJAK_RATE,
  KEJADIAN_CARDS,
  KORUPSI_FINE,
  MUDIK_DURATION_ROUNDS,
  MUDIK_TRANSPORT_MULTIPLIER,
  REGIONS,
  REGION_BONUS_DURATION_ROUNDS,
  REGION_BONUS_MULTIPLIER,
  TRANSPORT_TILE_IDS,
  VIRAL_MEDSOS_DURATION_ROUNDS,
  VIRAL_MEDSOS_MULTIPLIER,
} from '@tuan-tanah/shared'
import type { ActiveEffect, GameState, Player, RegionId } from '@tuan-tanah/shared'
import { getTileDef } from './board.js'
import { charge } from './elimination.js'
import { isTaxImmune } from './roles.js'
import { defaultRng, pushLog, uid, type Rng } from './util.js'

const HUSTLE_BY_ID = new Map(HUSTLE_CARDS.map((c) => [c.id, c]))
const KEJADIAN_BY_ID = new Map(KEJADIAN_CARDS.map((c) => [c.id, c]))

/** Draw the top card id from a deck, recycling it to the bottom. */
function drawFrom(deck: string[]): string | null {
  const id = deck.shift()
  if (id == null) return null
  deck.push(id)
  return id
}

/** Non-eliminated players (the population most Kejadian effects act on). */
function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.isEliminated)
}

/** A timed rent_multiplier effect covering every tile in the given regions. */
function regionBonusEffect(cardId: string, regions: RegionId[], multiplier: number): ActiveEffect {
  return {
    id: uid(),
    type: 'rent_multiplier',
    targetTileIds: regions.flatMap((r) => REGIONS[r].tileIds),
    multiplier,
    roundsRemaining: REGION_BONUS_DURATION_ROUNDS,
    sourceCard: cardId,
  }
}

export function drawHustle(
  state: GameState,
  player: Player,
): { cardId: string; name: string } | null {
  const id = drawFrom(state.hustleDeck)
  if (!id) return null
  const card = HUSTLE_BY_ID.get(id)!
  player.cash += card.earn
  state.bank -= card.earn
  pushLog(
    state,
    `${player.name} hustled "${card.name}" (+Rp ${card.earn.toLocaleString('id-ID')})`,
    player.id,
  )
  return { cardId: id, name: card.name }
}

export function drawKejadian(
  state: GameState,
  player: Player,
  rng: Rng = defaultRng,
): { cardId: string; name: string } | null {
  const id = drawFrom(state.kejadianDeck)
  if (!id) return null
  const card = KEJADIAN_BY_ID.get(id)!
  pushLog(state, `Kejadian Nasional: ${card.name} — ${card.effect}`, player.id)

  // Pejabat may have armed a block; the card is drawn but its effects are nullified.
  if (state.pendingKejadianBlock) {
    state.pendingKejadianBlock = false
    pushLog(state, `${card.name} was blocked by Pejabat — no effect`, player.id)
    return { cardId: id, name: card.name }
  }

  switch (id) {
    // ---- Immediate cash effects ----
    case 'lebaran': {
      const thr = 2_000_000
      for (const p of activePlayers(state)) {
        p.cash += thr
        state.bank -= thr
      }
      break
    }
    case 'kenaikan_bbm': {
      const tax = 500_000
      for (const p of activePlayers(state)) {
        if (isTaxImmune(p)) continue // Ojol Driver never pays travel tax
        charge(state, p, tax, null, 'fine', 'kenaikan BBM')
      }
      break
    }
    case 'investasi_asing': {
      const bonus = 1_000_000
      for (const p of activePlayers(state)) {
        const ownsProperty = state.tiles.some((t) => t.ownerId === p.id && t.track === 'property')
        if (ownsProperty) {
          p.cash += bonus
          state.bank -= bonus
        }
      }
      break
    }
    case 'inspeksi_pajak': {
      const richest = activePlayers(state).reduce<Player | null>(
        (best, p) => (best === null || p.cash > best.cash ? p : best),
        null,
      )
      if (richest && richest.cash > 0) {
        const fine = Math.round(richest.cash * INSPEKSI_PAJAK_RATE)
        charge(state, richest, fine, null, 'fine', 'tax inspection fine')
      }
      break
    }
    case 'korupsi_terungkap': {
      const target = activePlayers(state).reduce<Player | null>(
        (best, p) => (best === null || p.loans.length > best.loans.length ? p : best),
        null,
      )
      if (target && target.loans.length > 0) {
        charge(state, target, KORUPSI_FINE, null, 'fine', 'korupsi terungkap')
      } else {
        pushLog(state, `Korupsi Terungkap — nobody has outstanding pinjol; no effect`)
      }
      break
    }
    case 'reshuffle_kabinet': {
      const before = state.activeEffects.length
      state.activeEffects = state.activeEffects.filter((e) => e.sourceCard !== 'meta_lobby')
      const cleared = before - state.activeEffects.length
      pushLog(state, `Reshuffle Kabinet — ${cleared} lobby effect(s) reset`)
      break
    }

    // ---- Timed effects (decay via tickEffects) ----
    case 'banjir_jakarta': {
      state.activeEffects.push({
        id: uid(),
        type: 'tier_drop',
        targetTileIds: [...REGIONS.jakarta.tileIds],
        multiplier: BANJIR_TIER_DROP,
        roundsRemaining: BANJIR_DURATION_ROUNDS,
        sourceCard: id,
      })
      break
    }
    case 'mudik_season': {
      state.activeEffects.push({
        id: uid(),
        type: 'transport_multiplier',
        targetTileIds: [...TRANSPORT_TILE_IDS],
        multiplier: MUDIK_TRANSPORT_MULTIPLIER,
        roundsRemaining: MUDIK_DURATION_ROUNDS,
        sourceCard: id,
      })
      break
    }
    case 'viral_medsos': {
      const propTiles = BOARD.filter((t) => t.type === 'property').map((t) => t.id)
      const target = propTiles[Math.floor(rng() * propTiles.length)]
      if (target != null) {
        state.activeEffects.push({
          id: uid(),
          type: 'rent_multiplier',
          targetTileIds: [target],
          multiplier: VIRAL_MEDSOS_MULTIPLIER,
          roundsRemaining: VIRAL_MEDSOS_DURATION_ROUNDS,
          sourceCard: id,
        })
        pushLog(
          state,
          `${getTileDef(target).name} went viral — ${VIRAL_MEDSOS_MULTIPLIER}× rent for ${VIRAL_MEDSOS_DURATION_ROUNDS} rounds`,
        )
      }
      break
    }
    case 'gempa_bumi': {
      const regionIds = Object.keys(REGIONS) as RegionId[]
      const region = regionIds[Math.floor(rng() * regionIds.length)]
      if (region != null) {
        state.activeEffects.push({
          id: uid(),
          type: 'rent_multiplier',
          targetTileIds: [...REGIONS[region].tileIds],
          multiplier: GEMPA_RENT_MULTIPLIER,
          roundsRemaining: GEMPA_DURATION_ROUNDS,
          sourceCard: id,
        })
        pushLog(
          state,
          `Gempa Bumi struck ${REGIONS[region].name} — rent halved for ${GEMPA_DURATION_ROUNDS} rounds`,
        )
      }
      break
    }
    case 'demo_buruh': {
      state.activeEffects.push({
        id: uid(),
        type: 'passive_halved',
        multiplier: DEMO_BURUH_PASSIVE_MULTIPLIER,
        roundsRemaining: DEMO_BURUH_DURATION_ROUNDS,
        sourceCard: id,
      })
      break
    }
    case 'festival_budaya': {
      state.activeEffects.push(regionBonusEffect(id, ['yogyakarta'], REGION_BONUS_MULTIPLIER))
      break
    }
    case 'boom_tambang': {
      state.activeEffects.push(
        regionBonusEffect(id, ['kalimantan', 'papua'], REGION_BONUS_MULTIPLIER),
      )
      break
    }
    case 'musim_liburan': {
      state.activeEffects.push(regionBonusEffect(id, ['bali', 'lombok'], REGION_BONUS_MULTIPLIER))
      break
    }

    // ---- Vote ----
    case 'pemilu': {
      const eligible = activePlayers(state).filter((p) => p.isConnected)
      if (eligible.length < 2) {
        pushLog(state, `Pemilu — not enough players to hold a vote; no effect`)
        break
      }
      state.pendingVote = { card: 'pemilu', votes: {} }
      pushLog(state, `Pemilu! Everyone votes for who skips their next turn`)
      break
    }

    default:
      break
  }
  return { cardId: id, name: card.name }
}
