// The classic Tuan Tanah board — the current (and only) map. A future map adds a
// sibling file here; the engine takes a board param when the 2nd map exists.
import type { RupiahAmount, TileId, TileType } from '../../types/game.js'
import type { RegionId } from '../regions.js'
import { jt } from '../units.js'

export interface TileDef {
  id: TileId
  name: string
  type: TileType
  region?: RegionId
  taxPercent?: number // for type 'tax' — percentage of the taxable base (0–100)
  taxBasis?: 'cash' | 'wealth' // for type 'tax' — what the percentage applies to (default 'wealth')
}

// Tax tiles charge a percentage of a taxable base.
// Penghasilan (income) 11% of cash on hand; Kemewahan (luxury) 20% of total wealth.
export const BOARD: TileDef[] = [
  { id: 0, name: 'GO', type: 'go' },
  { id: 1, name: 'Sentani', type: 'property', region: 'papua' },
  { id: 2, name: 'Timika', type: 'property', region: 'papua' },
  { id: 3, name: 'Jayapura', type: 'property', region: 'papua' },
  { id: 4, name: 'Pajak Penghasilan', type: 'tax', taxPercent: 11, taxBasis: 'cash' },
  { id: 5, name: 'Bandara Soekarno-Hatta', type: 'transport' },
  { id: 6, name: 'Balikpapan', type: 'property', region: 'kalimantan' },
  { id: 7, name: 'Samarinda', type: 'property', region: 'kalimantan' },
  { id: 8, name: 'Bontang', type: 'property', region: 'kalimantan' },
  { id: 9, name: 'Lahan Kosong', type: 'buildable_land' },
  { id: 10, name: 'Visiting Penjara', type: 'jail_visit' },
  { id: 11, name: 'Merdeka Walk', type: 'property', region: 'medan' },
  { id: 12, name: 'Kesawan', type: 'property', region: 'medan' },
  { id: 13, name: 'Deli', type: 'property', region: 'medan' },
  { id: 14, name: 'Pelabuhan Belawan', type: 'transport' },
  { id: 15, name: 'Malioboro', type: 'property', region: 'yogyakarta' },
  { id: 16, name: 'Kejadian Nasional', type: 'event' },
  { id: 17, name: 'Prambanan', type: 'property', region: 'yogyakarta' },
  { id: 18, name: 'Kotagede', type: 'property', region: 'yogyakarta' },
  { id: 19, name: 'Kantor Hukum', type: 'law_office' },
  { id: 20, name: 'Masuk Penjara', type: 'jail_go' },
  { id: 21, name: 'Senggigi', type: 'property', region: 'lombok' },
  { id: 22, name: 'Kuta Mandalika', type: 'property', region: 'lombok' },
  { id: 23, name: 'Sembalun', type: 'property', region: 'lombok' },
  { id: 24, name: 'Gunung Rinjani', type: 'vacation' },
  { id: 25, name: 'Darmo', type: 'property', region: 'surabaya' },
  { id: 26, name: 'Gubeng', type: 'property', region: 'surabaya' },
  { id: 27, name: 'Pakuwon', type: 'property', region: 'surabaya' },
  { id: 28, name: 'Pelabuhan Tanjung Priok', type: 'transport' },
  { id: 29, name: 'Lahan Kosong', type: 'buildable_land' },
  { id: 30, name: 'Pajak Kemewahan', type: 'tax', taxPercent: 20, taxBasis: 'wealth' },
  { id: 31, name: 'Kuta', type: 'property', region: 'bali' },
  { id: 32, name: 'Kintamani', type: 'property', region: 'bali' },
  { id: 33, name: 'Stasiun Gambir', type: 'transport' },
  { id: 34, name: 'Hustle', type: 'hustle' },
  { id: 35, name: 'Sudirman', type: 'property', region: 'jakarta' },
  { id: 36, name: 'Thamrin', type: 'property', region: 'jakarta' },
  { id: 37, name: 'Kejadian Nasional', type: 'event' },
  { id: 38, name: 'BSD City', type: 'property', region: 'tangerang' },
  { id: 39, name: 'Alam Sutera', type: 'property', region: 'tangerang' },
]

export const BOARD_SIZE = BOARD.length // 40
export const GO_TILE_ID = 0
export const JAIL_TILE_ID = 10 // where you sit while in jail (Visiting Penjara)
export const JAIL_GO_TILE_ID = BOARD.find((t) => t.type === 'jail_go')!.id // go-to-jail corner (Masuk Penjara)
export const LAW_OFFICE_TILE_ID = BOARD.find((t) => t.type === 'law_office')!.id // Kantor Hukum

export const TRANSPORT_TILE_IDS: TileId[] = BOARD.filter((t) => t.type === 'transport').map(
  (t) => t.id,
)

// NOTE: The design doc gives transport rent but no buy price; assumed Rp 2 juta.
export const TRANSPORT_BUY_PRICE: RupiahAmount = jt(2)

// ---- Transport rent ladder (by number owned) ----
// index = count owned (1–4)
export const TRANSPORT_RENT: Record<number, RupiahAmount> = {
  1: jt(1),
  2: jt(2),
  3: jt(4),
  4: jt(8),
}
export const MUDIK_TRANSPORT_MULTIPLIER = 2
