// Hustle deck — the side-gig cards drawn on the Hustle tile / meta-action.
import type { PassType, RupiahAmount, TileId } from '../../types/game.js'
import { GO_TILE_ID, LAW_OFFICE_TILE_ID } from '../boards/classic.js'
import { jt, rb } from '../units.js'

// Hustle cards come in four kinds: `earn` adds cash, `cost` deducts cash, `pass`
// grants a free-pass card to the drawer's inventory, and `move` advances the
// drawer (no dice) to a target tile, resolving it like a landing.
export type HustleCard =
  | { id: string; name: string; kind: 'earn'; amount: RupiahAmount }
  | { id: string; name: string; kind: 'cost'; amount: RupiahAmount }
  | { id: string; name: string; kind: 'pass'; pass: PassType }
  | { id: string; name: string; kind: 'move'; target: TileId }
export const HUSTLE_CARDS: HustleCard[] = [
  { id: 'gofood_driver', name: 'GoFood Driver', kind: 'earn', amount: rb(500) },
  { id: 'dropshipper', name: 'Dropshipper', kind: 'earn', amount: jt(1) },
  { id: 'jual_online', name: 'Jual Online', kind: 'earn', amount: rb(750) },
  { id: 'freelance_design', name: 'Freelance Design', kind: 'earn', amount: jt(1.5) },
  { id: 'endorse_produk', name: 'Endorse Produk', kind: 'earn', amount: jt(2) },
  { id: 'jual_pulsa', name: 'Jual Pulsa', kind: 'earn', amount: rb(400) },
  { id: 'content_creator', name: 'Content Creator', kind: 'earn', amount: jt(1.2) },
  { id: 'joki_tugas', name: 'Joki Tugas', kind: 'earn', amount: jt(1.1) },
  { id: 'affiliate_marketing', name: 'Affiliate Marketing', kind: 'earn', amount: jt(1.3) },
  { id: 'jualan_snack_viral', name: 'Jualan Snack Viral', kind: 'earn', amount: rb(600) },
  // Overhaul additions (TTG-28)
  { id: 'profit_kripto', name: 'Profit Kripto', kind: 'earn', amount: jt(1.5) },
  { id: 'giveaway_terlucu', name: 'Giveaway Komentar Terlucu', kind: 'earn', amount: rb(800) },
  { id: 'teman_bayar_utang', name: 'Teman Lama Bayar Utang', kind: 'earn', amount: jt(1) },
  { id: 'joki_mobile_legend', name: 'Joki Mobile Legend', kind: 'earn', amount: rb(700) },
  { id: 'ulang_tahun', name: 'Ulang Tahun', kind: 'pass', pass: 'jail_free' },
  { id: 'undangan_kondangan', name: 'Undangan Kondangan', kind: 'cost', amount: rb(500) },
  { id: 'top_up_diamond', name: 'Top Up Diamond', kind: 'cost', amount: rb(600) },
  { id: 'donate_dramok', name: 'Donate Dramok', kind: 'cost', amount: rb(400) },
  // Advance cards (TTG-xx): move the drawer to a tile with no dice roll.
  { id: 'advance_go', name: 'Pulang Kampung', kind: 'move', target: GO_TILE_ID }, // → GO (0), pays salary
  {
    id: 'advance_law_office',
    name: 'Panggilan Pengadilan',
    kind: 'move',
    target: LAW_OFFICE_TILE_ID,
  }, // → Kantor Hukum (19)
]
