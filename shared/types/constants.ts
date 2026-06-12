// Single source of truth for all Tuan Tanah game data, transcribed from
// docs/GAME_DESIGN.md. Both the server engine and the client import from here.

import type { Role, RupiahAmount, TileId, TileType } from './game.js'

// Convenience helpers for readability.
const jt = (n: number): RupiahAmount => n * 1_000_000
const rb = (n: number): RupiahAmount => n * 1_000

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8

// Room master sets starting cash in this range.
export const STARTING_CASH_MIN = jt(5)
export const STARTING_CASH_MAX = jt(50)
export const STARTING_CASH_DEFAULT = jt(15)

// Bank starts effectively unlimited; tracked for accounting.
export const BANK_STARTING = jt(1_000_000)

// ---- Regions ----

export type RegionId =
  | 'papua'
  | 'kalimantan'
  | 'medan'
  | 'yogyakarta'
  | 'lombok'
  | 'surabaya'
  | 'bali'
  | 'jakarta'

export interface RegionDef {
  id: RegionId
  name: string
  color: string // tailwind-ish hex for board rendering
  buyPrice: RupiahAmount
  rentBase: RupiahAmount // "House Rent Base"
  passiveBase: RupiahAmount // "Property Passive Base"
  tileIds: TileId[]
}

export const REGIONS: Record<RegionId, RegionDef> = {
  papua: {
    id: 'papua',
    name: 'Papua',
    color: '#8B5A2B', // brown
    buyPrice: rb(600),
    rentBase: rb(200),
    passiveBase: rb(100),
    tileIds: [1, 2, 3],
  },
  kalimantan: {
    id: 'kalimantan',
    name: 'Kalimantan',
    color: '#14532D', // dark green
    buyPrice: jt(1),
    rentBase: rb(350),
    passiveBase: rb(175),
    tileIds: [6, 7, 8],
  },
  medan: {
    id: 'medan',
    name: 'Medan',
    color: '#CA8A04', // yellow
    buyPrice: jt(1.5),
    rentBase: rb(500),
    passiveBase: rb(250),
    tileIds: [11, 12, 13],
  },
  yogyakarta: {
    id: 'yogyakarta',
    name: 'Yogyakarta',
    color: '#7DD3FC', // light blue
    buyPrice: jt(2),
    rentBase: rb(700),
    passiveBase: rb(350),
    tileIds: [15, 17, 18],
  },
  lombok: {
    id: 'lombok',
    name: 'Lombok',
    color: '#F472B6', // pink
    buyPrice: jt(2.5),
    rentBase: rb(900),
    passiveBase: rb(450),
    tileIds: [21, 22, 23],
  },
  surabaya: {
    id: 'surabaya',
    name: 'Surabaya',
    color: '#DC2626', // red
    buyPrice: jt(3.5),
    rentBase: jt(1.2),
    passiveBase: rb(600),
    tileIds: [25, 26, 27],
  },
  bali: {
    id: 'bali',
    name: 'Bali',
    color: '#EA580C', // orange
    buyPrice: jt(6),
    rentBase: jt(2),
    passiveBase: jt(1),
    tileIds: [31, 32],
  },
  jakarta: {
    id: 'jakarta',
    name: 'Jakarta',
    color: '#374151', // dark grey
    buyPrice: jt(10),
    rentBase: jt(4),
    passiveBase: jt(2),
    tileIds: [35, 36],
  },
}

// Full-set bonus when one player owns every tile in a region.
export const REGION_SET_RENT_MULTIPLIER = 2
export const REGION_SET_PASSIVE_MULTIPLIER = 2

// ---- Board (40 tiles) ----

export interface TileDef {
  id: TileId
  name: string
  type: TileType
  region?: RegionId
  taxAmount?: RupiahAmount // for type 'tax'
}

// NOTE: Tax amounts are not specified in the design doc; these are assumptions
// (Penghasilan 2jt, Kemewahan 3jt, Hadiah 1jt) — adjust when finalized.
export const BOARD: TileDef[] = [
  { id: 0, name: 'GO', type: 'go' },
  { id: 1, name: 'Sentani', type: 'property', region: 'papua' },
  { id: 2, name: 'Timika', type: 'property', region: 'papua' },
  { id: 3, name: 'Jayapura', type: 'property', region: 'papua' },
  { id: 4, name: 'Pajak Penghasilan', type: 'tax', taxAmount: jt(2) },
  { id: 5, name: 'Bandara Soekarno-Hatta', type: 'transport' },
  { id: 6, name: 'Balikpapan', type: 'property', region: 'kalimantan' },
  { id: 7, name: 'Samarinda', type: 'property', region: 'kalimantan' },
  { id: 8, name: 'Bontang', type: 'property', region: 'kalimantan' },
  { id: 9, name: 'Hustle', type: 'hustle' },
  { id: 10, name: 'Visiting Penjara', type: 'jail_visit' },
  { id: 11, name: 'Merdeka Walk', type: 'property', region: 'medan' },
  { id: 12, name: 'Kesawan', type: 'property', region: 'medan' },
  { id: 13, name: 'Deli', type: 'property', region: 'medan' },
  { id: 14, name: 'Pelabuhan Belawan', type: 'transport' },
  { id: 15, name: 'Malioboro', type: 'property', region: 'yogyakarta' },
  { id: 16, name: 'Kejadian Nasional', type: 'event' },
  { id: 17, name: 'Prambanan', type: 'property', region: 'yogyakarta' },
  { id: 18, name: 'Kotagede', type: 'property', region: 'yogyakarta' },
  { id: 19, name: 'Parkir Bebas', type: 'parking' },
  { id: 20, name: 'Masuk Penjara', type: 'jail_go' },
  { id: 21, name: 'Senggigi', type: 'property', region: 'lombok' },
  { id: 22, name: 'Kuta Mandalika', type: 'property', region: 'lombok' },
  { id: 23, name: 'Sembalun', type: 'property', region: 'lombok' },
  { id: 24, name: 'Hustle', type: 'hustle' },
  { id: 25, name: 'Darmo', type: 'property', region: 'surabaya' },
  { id: 26, name: 'Gubeng', type: 'property', region: 'surabaya' },
  { id: 27, name: 'Pakuwon', type: 'property', region: 'surabaya' },
  { id: 28, name: 'Pelabuhan Tanjung Priok', type: 'transport' },
  { id: 29, name: 'Kejadian Nasional', type: 'event' },
  { id: 30, name: 'Pajak Kemewahan', type: 'tax', taxAmount: jt(3) },
  { id: 31, name: 'Kuta', type: 'property', region: 'bali' },
  { id: 32, name: 'Kintamani', type: 'property', region: 'bali' },
  { id: 33, name: 'Stasiun Gambir', type: 'transport' },
  { id: 34, name: 'Hustle', type: 'hustle' },
  { id: 35, name: 'Sudirman', type: 'property', region: 'jakarta' },
  { id: 36, name: 'Thamrin', type: 'property', region: 'jakarta' },
  { id: 37, name: 'Kejadian Nasional', type: 'event' },
  { id: 38, name: 'Parkir Bebas', type: 'parking' },
  { id: 39, name: 'Pajak Hadiah', type: 'tax', taxAmount: jt(1) },
]

export const BOARD_SIZE = BOARD.length // 40
export const GO_TILE_ID = 0
export const JAIL_TILE_ID = 10 // where you sit while in jail (Visiting Penjara)

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

// ---- House track (4 tiers) ----
export interface HouseTierDef {
  tier: number
  name: string
  buildCostMult: number // × region buyPrice
  rentMult: number // × region rentBase
}
export const HOUSE_TIERS: HouseTierDef[] = [
  { tier: 1, name: 'Rumah Kecil', buildCostMult: 0.5, rentMult: 1 },
  { tier: 2, name: 'Rumah Sedang', buildCostMult: 1, rentMult: 2.5 },
  { tier: 3, name: 'Rumah Besar', buildCostMult: 2, rentMult: 5 },
  { tier: 4, name: 'Villa / Hotel', buildCostMult: 4, rentMult: 10 },
]

// ---- Property track (5 tiers) ----
export interface PropertyTierDef {
  tier: number
  name: string
  buildCostMult: number // × region buyPrice
  rentMult: number // × region rentBase
  passiveMult: number // × region passiveBase
}
export const PROPERTY_TIERS: PropertyTierDef[] = [
  { tier: 1, name: 'Warung', buildCostMult: 0.3, rentMult: 0.5, passiveMult: 1 },
  { tier: 2, name: 'Toko', buildCostMult: 0.7, rentMult: 1, passiveMult: 2 },
  { tier: 3, name: 'Minimarket', buildCostMult: 1.5, rentMult: 2, passiveMult: 4 },
  { tier: 4, name: 'Mall', buildCostMult: 3, rentMult: 4, passiveMult: 7 },
  { tier: 5, name: 'Konglomerat', buildCostMult: 6, rentMult: 7, passiveMult: 12 },
]

// ---- Roles ----
export interface RoleDef {
  id: Role
  name: string
  salary: RupiahAmount // collected at GO
  ability: string
}
export const ROLES: Record<Role, RoleDef> = {
  pengusaha: {
    id: 'pengusaha',
    name: 'Pengusaha',
    salary: jt(3),
    ability: 'Upgrade 2 tiers per turn',
  },
  politisi: { id: 'politisi', name: 'Politisi', salary: jt(4), ability: 'Lobby costs 50% less' },
  freelancer: {
    id: 'freelancer',
    name: 'Freelancer',
    salary: jt(3),
    ability: 'Salary 1.5× when passing GO',
  },
  investor: {
    id: 'investor',
    name: 'Investor',
    salary: jt(2.5),
    ability: 'Earn 5% from every rent paid to others',
  },
  kontraktor: {
    id: 'kontraktor',
    name: 'Kontraktor',
    salary: jt(3),
    ability: "Build on others' property for 30% cut",
  },
  ojol_driver: {
    id: 'ojol_driver',
    name: 'Ojol Driver',
    salary: jt(1.5),
    ability: 'Never pay travel/movement tax',
  },
  influencer: {
    id: 'influencer',
    name: 'Influencer',
    salary: jt(2),
    ability: 'Once per game: viral boost 3× for 3 turns',
  },
  pejabat: {
    id: 'pejabat',
    name: 'Pejabat',
    salary: jt(5),
    ability: 'Once per game: block any kejadian card',
  },
  rentenir: {
    id: 'rentenir',
    name: 'Rentenir',
    salary: jt(3.5),
    ability: 'Force one player per round to take pinjol, earns the interest',
  },
  sales: {
    id: 'sales',
    name: 'Sales',
    salary: jt(2.5),
    ability: 'Buy property 25% cheaper + earn 15% bank bonus on initiated deals',
  },
}

export const ALL_ROLES: Role[] = Object.keys(ROLES) as Role[]

// Token colors assigned to players in join order.
export const PLAYER_COLORS = [
  '#EF4444', // red
  '#3B82F6', // blue
  '#22C55E', // green
  '#EAB308', // yellow
  '#A855F7', // purple
  '#EC4899', // pink
  '#F97316', // orange
  '#14B8A6', // teal
]

// ---- Pinjol ----
export const PINJOL_AMOUNTS: RupiahAmount[] = [jt(2), jt(5), jt(10)]
export const PINJOL_INTEREST_RATE = 0.1 // 10% per round
export const PINJOL_MAX_LOANS = 3
export const PINJOL_BORROW_LIMIT_MULTIPLE = 3 // ≤ 3× total property value

// ---- Jail ----
export const JAIL_DURATION_TURNS = 2
export const JAIL_EXIT_COST = jt(1)

// ---- Cards ----
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
    id: 'viral_medsos',
    name: 'Viral di Medsos',
    effect: 'One random property earns 3× for 3 rounds',
  },
  {
    id: 'reshuffle_kabinet',
    name: 'Reshuffle Kabinet',
    effect: 'All lobby effects immediately reset',
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
    effect: 'All property track owners earn Rp 1 juta bonus',
  },
  { id: 'pemilu', name: 'Pemilu', effect: 'All players vote — most voted player skips next turn' },
]

export interface HustleCard {
  id: string
  name: string
  earn: RupiahAmount
}
export const HUSTLE_CARDS: HustleCard[] = [
  { id: 'gofood_driver', name: 'GoFood Driver', earn: rb(500) },
  { id: 'dropshipper', name: 'Dropshipper', earn: jt(1) },
  { id: 'jual_online', name: 'Jual Online', earn: rb(750) },
  { id: 'freelance_design', name: 'Freelance Design', earn: jt(1.5) },
  { id: 'endorse_produk', name: 'Endorse Produk', earn: jt(2) },
  { id: 'ojek_wisata', name: 'Ojek Wisata', earn: rb(600) },
  { id: 'rental_motor_bali', name: 'Rental Motor Bali', earn: rb(800) },
  { id: 'jual_pulsa', name: 'Jual Pulsa', earn: rb(400) },
  { id: 'warung_dadakan', name: 'Warung Dadakan', earn: rb(700) },
  { id: 'content_creator', name: 'Content Creator', earn: jt(1.2) },
  { id: 'reseller_thrift', name: 'Reseller Thrift', earn: rb(900) },
  { id: 'joki_tugas', name: 'Joki Tugas', earn: jt(1.1) },
  { id: 'ngamen_online', name: 'Ngamen Online', earn: rb(500) },
  { id: 'affiliate_marketing', name: 'Affiliate Marketing', earn: jt(1.3) },
  { id: 'jualan_snack_viral', name: 'Jualan Snack Viral', earn: rb(600) },
]

// ---- Meta action costs ----
export const META_ACTION_COSTS = {
  lobby: jt(2),
  sabotage: jt(3),
} as const

export const KORUPSI_SUCCESS_RATE = 0.6 // 60% success, 40% caught
export const KORUPSI_STEAL_AMOUNT: RupiahAmount = jt(5) // taken from bank on success
export const KORUPSI_FINE: RupiahAmount = jt(3) // paid to bank when caught (matches Korupsi Terungkap card)

// Sabotage applies a temporary rent_multiplier effect to one tile.
export const SABOTAGE_RENT_MULTIPLIER = 0.5 // halves the target tile's rent
export const SABOTAGE_DURATION_ROUNDS = 2
