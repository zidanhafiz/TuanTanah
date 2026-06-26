// Kejadian Nasional ("national event") deck + the tuning for each effect it fires.
import type { RupiahAmount } from '../../types/game.js'
import { jt } from '../units.js'

export interface KejadianCard {
  id: string
  name: string
  effect: string
}
export const KEJADIAN_CARDS: KejadianCard[] = [
  { id: 'lebaran', name: 'Lebaran', effect: 'Everyone receives THR bonus (Rp 2 juta)' },
  { id: 'kenaikan_bbm', name: 'Kenaikan BBM', effect: 'Everyone pays Rp 500rb travel tax' },
  {
    id: 'banjir_jakarta',
    name: 'Banjir Jakarta',
    effect: 'All Jakarta tiles drop 1 tier for 3 rounds',
  },
  { id: 'mudik_season', name: 'Mudik Season', effect: 'All transport tiles earn 2× for 3 rounds' },
  {
    id: 'dollar_naik',
    name: 'Dollar Naik',
    effect: 'Every player loses 10% of their cash',
  },
  {
    id: 'reshuffle_kabinet',
    name: 'Reshuffle Kabinet',
    effect: 'All card effects and free-pass cards are wiped',
  },
  {
    id: 'inspeksi_pajak',
    name: 'Inspeksi Pajak',
    effect: 'Richest player pays 10% of their cash as fine',
  },
  {
    id: 'gempa_bumi',
    name: 'Gempa Bumi',
    effect: "One random region's tiles lose rent bonus for 2 rounds",
  },
  {
    id: 'demo_buruh',
    name: 'Demo Buruh',
    effect: 'Property track passive income halved for 2 rounds',
  },
  {
    id: 'festival_budaya',
    name: 'Festival Budaya',
    effect: 'Yogyakarta tiles earn 2× for 3 rounds',
  },
  {
    id: 'boom_tambang',
    name: 'Boom Tambang',
    effect: 'Kalimantan + Papua tiles earn 2× for 3 rounds',
  },
  {
    id: 'musim_liburan',
    name: 'Musim Liburan',
    effect: 'Bali + Lombok tiles earn 2× for 3 rounds',
  },
  {
    id: 'korupsi_terungkap',
    name: 'Korupsi Terungkap',
    effect: 'Player with most pinjol loans pays Rp 3 juta fine',
  },
  {
    id: 'investasi_asing',
    name: 'Investasi Asing',
    effect: 'All property track owners earn Rp 2 juta bonus',
  },
  { id: 'pemilu', name: 'Pemilu', effect: 'All players vote — most voted player skips next turn' },
]

// ---- Kejadian Nasional effects ----
// Banjir Jakarta: Jakarta tiles drop a tier for a few rounds.
export const BANJIR_TIER_DROP = 1
export const BANJIR_DURATION_ROUNDS = 3
// Mudik Season: transport tiles earn MUDIK_TRANSPORT_MULTIPLIER× (defined with the board).
export const MUDIK_DURATION_ROUNDS = 3
// Dollar Naik: every player immediately loses this fraction of their cash.
export const DOLLAR_NAIK_CASH_RATE = 0.1
// Investasi Asing: each property-track owner receives this bonus.
export const INVESTASI_ASING_BONUS: RupiahAmount = jt(2)
// Gempa Bumi: one random region's tiles lose their rent bonus (halved).
export const GEMPA_RENT_MULTIPLIER = 0.5
export const GEMPA_DURATION_ROUNDS = 2
// Demo Buruh: all property-track passive income halved.
export const DEMO_BURUH_PASSIVE_MULTIPLIER = 0.5
export const DEMO_BURUH_DURATION_ROUNDS = 2
// Festival Budaya / Boom Tambang / Musim Liburan: region tiles earn 2× rent.
export const REGION_BONUS_MULTIPLIER = 2
export const REGION_BONUS_DURATION_ROUNDS = 3
// Inspeksi Pajak: richest player pays this fraction of their cash. (Korupsi
// Terungkap reuses KORUPSI_FINE, defined with the meta-action economy.)
export const INSPEKSI_PAJAK_RATE = 0.1
// Pemilu: the most-voted player skips their next turn for this many rounds.
export const PEMILU_SKIP_ROUNDS = 2
