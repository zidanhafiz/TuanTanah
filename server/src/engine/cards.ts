// Kejadian + Hustle card handling.
// Draw a card (deck recycles), apply Hustle earnings and all Kejadian Nasional
// effects: immediate cash effects, timed effects pushed onto state.activeEffects
// (decayed each round by tickEffects), and the Pemilu vote.
import {
  BANJIR_DURATION_ROUNDS,
  BANJIR_TIER_DROP,
  DEMO_BURUH_DURATION_ROUNDS,
  DEMO_BURUH_PASSIVE_MULTIPLIER,
  DOLLAR_NAIK_CASH_RATE,
  GEMPA_DURATION_ROUNDS,
  GEMPA_RENT_MULTIPLIER,
  hustleP,
  HUSTLE_CARDS,
  INSPEKSI_PAJAK_RATE,
  INVESTASI_ASING_BONUS,
  kejadianEffectP,
  kejadianP,
  KEJADIAN_CARDS,
  KORUPSI_FINE,
  MUDIK_DURATION_ROUNDS,
  MUDIK_TRANSPORT_MULTIPLIER,
  passP,
  REGIONS,
  REGION_BONUS_DURATION_ROUNDS,
  REGION_BONUS_MULTIPLIER,
  rpP,
  tileP,
  TRANSPORT_TILE_IDS,
} from '@tuan-tanah/shared'
import type { ActiveEffect, GameState, Player, RegionId } from '@tuan-tanah/shared'
import { charge } from './elimination.js'
// Runtime-only import (called from drawHustle, never at module-eval time), so the
// index.ts ↔ cards.ts cycle is safe.
import { advanceToTile } from './index.js'
import { taxMultiplier } from './roles.js'
import { defaultRng, logKey, uid, type Rng } from './util.js'

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
  rng: Rng = defaultRng,
): { cardId: string; name: string } | null {
  const id = drawFrom(state.hustleDeck)
  if (!id) return null
  const card = HUSTLE_BY_ID.get(id)!
  switch (card.kind) {
    case 'earn': {
      player.cash += card.amount
      state.bank -= card.amount
      logKey(
        state,
        'cards.hustleEarn',
        { name: player.name, card: hustleP(id), amount: rpP(card.amount) },
        player.id,
      )
      break
    }
    case 'cost': {
      // A losing hustle — routed through charge so it can open a debt if unaffordable.
      charge(state, player, card.amount, null, 'fine', card.name)
      break
    }
    case 'pass': {
      player.ownedCards.push({ id: uid(), type: card.pass })
      logKey(
        state,
        'cards.hustlePass',
        { name: player.name, card: hustleP(id), pass: passP(card.pass) },
        player.id,
      )
      break
    }
    case 'move': {
      logKey(
        state,
        'cards.hustleMove',
        { name: player.name, card: hustleP(id), tile: tileP(card.target) },
        player.id,
      )
      // Moves the player (no dice) to the target tile, collecting pass-GO salary +
      // passive income if the trip wraps and resolving the destination (e.g. GO,
      // or Kantor Hukum which opens the law-office menu).
      advanceToTile(state, player, card.target, rng)
      break
    }
  }
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
  logKey(
    state,
    'cards.kejadianDraw',
    { card: kejadianP(id), effect: kejadianEffectP(id) },
    player.id,
  )

  // Pejabat may have armed a block; the card is drawn but its effects are nullified.
  if (state.pendingKejadianBlock) {
    state.pendingKejadianBlock = false
    logKey(state, 'cards.kejadianBlocked', { card: kejadianP(id) }, player.id)
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
        // Ojol Driver pays a reduced travel tax (taxMultiplier); others pay full.
        const amount = Math.round(tax * taxMultiplier(p))
        if (amount > 0) charge(state, p, amount, null, 'fine', 'kenaikan BBM')
      }
      break
    }
    case 'investasi_asing': {
      const bonus = INVESTASI_ASING_BONUS
      for (const p of activePlayers(state)) {
        const ownsProperty = state.tiles.some((t) => t.ownerId === p.id && t.track === 'property')
        if (ownsProperty) {
          p.cash += bonus
          state.bank -= bonus
        }
      }
      break
    }
    case 'dollar_naik': {
      for (const p of activePlayers(state)) {
        const loss = Math.round(p.cash * DOLLAR_NAIK_CASH_RATE)
        if (loss > 0) charge(state, p, loss, null, 'fine', 'dollar naik')
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
        logKey(state, 'cards.korupsiNoEffect')
      }
      break
    }
    case 'reshuffle_kabinet': {
      // Wipe every card-driven effect (kejadian, hustle, meta-lobby) and all
      // free-pass inventories. Player-agreed negotiation deals (deal_*) survive.
      const before = state.activeEffects.length
      state.activeEffects = state.activeEffects.filter((e) => e.sourceCard.startsWith('deal_'))
      const cleared = before - state.activeEffects.length
      let passesWiped = 0
      for (const p of state.players) {
        passesWiped += p.ownedCards.length
        p.ownedCards = []
      }
      logKey(state, 'cards.reshuffleKabinet', { cleared, passes: passesWiped })
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
        logKey(state, 'cards.gempaBumi', {
          region: REGIONS[region].name,
          rounds: GEMPA_DURATION_ROUNDS,
        })
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
        logKey(state, 'cards.pemiluNoEffect')
        break
      }
      state.pendingVote = { card: 'pemilu', votes: {} }
      logKey(state, 'cards.pemiluStart')
      break
    }

    default:
      break
  }
  return { cardId: id, name: card.name }
}
