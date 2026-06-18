import type { PropertyTrack, TileDef, TileType } from '@tuan-tanah/shared'
import { createElement } from 'react'
import {
  ChevronsLeft,
  Building2,
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
  type LucideIcon,
} from 'lucide-react'

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
