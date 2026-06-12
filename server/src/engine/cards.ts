// Kejadian + Hustle card handling.
// Slice scope: draw a card (deck recycles), apply Hustle earnings and the
// simplest Kejadian effects. Complex / timed effects are logged but deferred to
// the effects-scheduler milestone.
import { HUSTLE_CARDS, KEJADIAN_CARDS } from '@tuan-tanah/shared'
import type { GameState, Player } from '@tuan-tanah/shared'
import { pushLog } from './util.js'

const HUSTLE_BY_ID = new Map(HUSTLE_CARDS.map((c) => [c.id, c]))
const KEJADIAN_BY_ID = new Map(KEJADIAN_CARDS.map((c) => [c.id, c]))

/** Draw the top card id from a deck, recycling it to the bottom. */
function drawFrom(deck: string[]): string | null {
  const id = deck.shift()
  if (id == null) return null
  deck.push(id)
  return id
}

export function drawHustle(state: GameState, player: Player): { cardId: string; name: string } | null {
  const id = drawFrom(state.hustleDeck)
  if (!id) return null
  const card = HUSTLE_BY_ID.get(id)!
  player.cash += card.earn
  state.bank -= card.earn
  pushLog(state, `${player.name} hustled "${card.name}" (+Rp ${card.earn.toLocaleString('id-ID')})`, player.id)
  return { cardId: id, name: card.name }
}

export function drawKejadian(
  state: GameState,
  player: Player,
): { cardId: string; name: string } | null {
  const id = drawFrom(state.kejadianDeck)
  if (!id) return null
  const card = KEJADIAN_BY_ID.get(id)!
  pushLog(state, `Kejadian Nasional: ${card.name} — ${card.effect}`, player.id)

  // Apply only the simplest immediate effects for the slice.
  switch (id) {
    case 'lebaran': {
      const thr = 2_000_000
      for (const p of state.players) {
        if (p.isEliminated) continue
        p.cash += thr
        state.bank -= thr
      }
      break
    }
    case 'kenaikan_bbm': {
      const tax = 500_000
      for (const p of state.players) {
        if (p.isEliminated) continue
        if (p.role === 'ojol_driver') continue // never pays travel tax
        p.cash -= tax
        state.bank += tax
      }
      break
    }
    case 'investasi_asing': {
      const bonus = 1_000_000
      for (const p of state.players) {
        if (p.isEliminated) continue
        const ownsProperty = state.tiles.some((t) => t.ownerId === p.id && t.track === 'property')
        if (ownsProperty) {
          p.cash += bonus
          state.bank -= bonus
        }
      }
      break
    }
    // TODO: timed multipliers, tier drops, voting, fines, lobby reset, etc.
    default:
      break
  }
  return { cardId: id, name: card.name }
}
