import type {
  ActiveEffect,
  EffectType,
  LandBusiness,
  PropertyTrack,
  TileDef,
  TileType,
} from '@tuan-tanah/shared'
import type { TFunction } from 'i18next'
import { createElement } from 'react'
import {
  ChevronsLeft,
  Building2,
  Coffee,
  Coins,
  HelpCircle,
  Hotel,
  House,
  Landmark,
  Lock,
  Mountain,
  Plane,
  Scale,
  Ship,
  Siren,
  Sprout,
  Store,
  TrainFront,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { effectSourceName, tileEffectLabel } from '../../i18n/gameData.js'

/**
 * Board glyphs come from lucide-react. They're rendered with a chunky 2.1 stroke
 * (matching the neobrutalist line weight) and inherit `currentColor` so a tile
 * can tint its own icon. The development pips below stay hand-drawn — lucide has
 * no house/building-stack pip that reads at ~10px.
 */

/** Transports share a TileType; pick the real-world icon from the place name. */
function transportIcon(name: string): LucideIcon {
  if (/pelabuhan|tanjung/i.test(name)) return Ship
  if (/stasiun|gambir/i.test(name)) return TrainFront
  return Plane // Bandara + default
}

const TYPE_ICON: Partial<Record<TileType, LucideIcon>> = {
  go: ChevronsLeft,
  tax: Landmark,
  event: HelpCircle, // the "?" Kejadian card
  hustle: Coins,
  jail_visit: Lock, // just visiting
  jail_go: Siren, // go to jail — police siren
  buildable_land: Sprout, // Lahan Kosong — empty plot to develop
  law_office: Scale, // Kantor Hukum — scales of justice
  vacation: Mountain, // Gunung Rinjani
}

/** The icon for a tile def, or null for plain property tiles (they show a price). */
export function TileGlyph({ def, className }: { def: TileDef; className?: string }) {
  const Icon = def.type === 'transport' ? transportIcon(def.name) : TYPE_ICON[def.type]
  return Icon
    ? createElement(Icon, {
        className,
        style: { color: TYPE_COLOR[def.type] },
        strokeWidth: 2.1,
        absoluteStrokeWidth: true,
      })
    : null
}

/** Color of a tile's header band by type (properties override with region color). */
export const TYPE_COLOR: Record<TileType, string> = {
  go: '#F59E0B', // accent-strong
  tax: '#E03131', // danger-strong
  transport: '#1C7ED6', // info-strong
  event: '#A855F7', // purple
  hustle: '#2F9E44', // success-strong
  jail_visit: '#9A8F7D', // ink-faint
  jail_go: '#E03131', // danger-strong
  buildable_land: '#A16207', // soil / greenfield
  law_office: '#4F46E5', // indigo — legal
  vacation: '#0D9488', // teal — mountain getaway
  property: '#9A8F7D', // unused (region color wins)
}

/**
 * The development glyph for a built tile: a lucide building icon plus the tier
 * count ("3×" + house). The icon depends on track + tier — early tiers stack the
 * same building (house / minimart), while the top tier swaps to a premium icon:
 *   house track → Hotel at tier 4 (Villa / Hotel)
 *   property track → Building2 at tier 5 (Konglomerat)
 */
function devIcon(track: PropertyTrack, tier: number): { Icon: LucideIcon; counted: boolean } {
  if (track === 'house') {
    return tier >= 4 ? { Icon: Hotel, counted: false } : { Icon: House, counted: true }
  }
  // property track (Warung → Mall stack the Store; Konglomerat is its own icon)
  return tier >= 5 ? { Icon: Building2, counted: false } : { Icon: Store, counted: true }
}

/** A development badge: tier count + building icon in the owner's color. */
export function DevGlyph({
  track,
  tier,
  color,
}: {
  track: PropertyTrack
  tier: number
  color: string
}) {
  const { Icon, counted } = devIcon(track, tier)
  return (
    <div className="flex items-center gap-[0.2cqw] rounded-md border border-ink bg-surface px-[0.35cqw] py-[0.2cqw] shadow-brutal-sm">
      {counted && tier > 1 && (
        <span className="text-[1.6cqw] font-extrabold leading-none text-ink">{tier}×</span>
      )}
      {createElement(Icon, {
        className: 'h-[2.2cqw] w-[2.2cqw]',
        style: { color },
        strokeWidth: 2.2,
        absoluteStrokeWidth: true,
      })}
    </div>
  )
}

/** Development badge for a built Lahan Kosong business: tier count + business icon. */
export function LandGlyph({
  business,
  tier,
  color,
}: {
  business: LandBusiness
  tier: number
  color: string
}) {
  const Icon = business === 'dapur_mbg' ? UtensilsCrossed : Coffee
  return (
    <div className="flex items-center gap-[0.2cqw] rounded-md border border-ink bg-surface px-[0.35cqw] py-[0.2cqw] shadow-brutal-sm">
      {tier > 1 && (
        <span className="text-[1.6cqw] font-extrabold leading-none text-ink">{tier}×</span>
      )}
      {createElement(Icon, {
        className: 'h-[2.2cqw] w-[2.2cqw]',
        style: { color },
        strokeWidth: 2.2,
        absoluteStrokeWidth: true,
      })}
    </div>
  )
}

// Card effects we surface as an on-board glyph beside the owner pip: the rent /
// transport multipliers and the gempa/banjir tier drop. Other effect types
// (passive tweaks, deals, turn skips) aren't tile-local, so they get no marker.
const TILE_EFFECT_TYPES = new Set<EffectType>([
  'rent_multiplier',
  'transport_multiplier',
  'tier_drop',
])

/** Whether an effect should show a tile glyph (it targets a tile in a visible way). */
export function isTileEffect(effect: ActiveEffect): boolean {
  return TILE_EFFECT_TYPES.has(effect.type)
}

// A boost (multiplier ≥ 1) reads green/up; a penalty — a rent cut or a tier drop
// from Gempa Bumi / Banjir Jakarta — reads red. tier_drop gets the hazard icon
// to set destructive events apart from a plain rent reduction.
function effectVisual(effect: ActiveEffect): { Icon: LucideIcon; color: string } {
  if (effect.type === 'tier_drop') return { Icon: TriangleAlert, color: '#E03131' } // danger-strong
  const boost = (effect.multiplier ?? 1) >= 1
  return boost
    ? { Icon: TrendingUp, color: '#2F9E44' } // success-strong
    : { Icon: TrendingDown, color: '#E03131' } // danger-strong
}

/**
 * Just the tinted lucide icon for an effect (boost/penalty/tier drop), sized by
 * the caller's className. Used both on the cqw-scaled board badge and in the
 * (rem-scaled) property modal, so size lives with the caller, not here.
 */
export function EffectIcon({ effect, className }: { effect: ActiveEffect; className?: string }) {
  const { Icon, color } = effectVisual(effect)
  return createElement(Icon, {
    className,
    style: { color },
    strokeWidth: 2.4,
    absoluteStrokeWidth: true,
  })
}

/**
 * A card-effect badge for a tile (rent/transport multiplier, tier drop), styled
 * like the development pip so it sits naturally beside the owner indicator. The
 * full label ("Sewa ×2 · 3 rounds", prefixed with its source) moves to the hover
 * tooltip instead of crowding the cell with text.
 */
export function EffectGlyph({ effect, t }: { effect: ActiveEffect; t: TFunction }) {
  const label = tileEffectLabel(t, effect)
  const source = effectSourceName(t, effect.sourceCard)
  const tooltip = label ? (source ? `${source}: ${label}` : label) : undefined
  return (
    <div
      className="flex items-center justify-center rounded-md border border-ink bg-surface px-[0.25cqw] py-[0.25cqw] shadow-brutal-sm"
      title={tooltip}
    >
      <EffectIcon effect={effect} className="h-[1.8cqw] w-[1.8cqw]" />
    </div>
  )
}
