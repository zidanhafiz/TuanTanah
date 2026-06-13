import type { PropertyTrack, TileDef, TileType } from '@tuan-tanah/shared'

/**
 * Neobrutalist board glyphs: bold ink strokes, simple shapes, no blur. Icons
 * read at ~18px on a tile; pips read at ~10px. Everything inherits `currentColor`
 * for the stroke so a tile can tint its own icon.
 */

type IconProps = { className?: string }

const SVG = (props: IconProps & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.1}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
  >
    {props.children}
  </svg>
)

const GoIcon = (p: IconProps) => (
  <SVG {...p}>
    <path d="M4 12h13" />
    <path d="M12 6l6 6-6 6" />
    <path d="M19 5v14" />
  </SVG>
)

const TaxIcon = (p: IconProps) => (
  <SVG {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 9.5v5M18 9.5v5" />
  </SVG>
)

const PlaneIcon = (p: IconProps) => (
  <SVG {...p}>
    <path d="M21 16v-2l-7-4V5a1.6 1.6 0 0 0-3.2 0v5l-7 4v2l7-2v3l-2 1.4V20l3.5-1 3.5 1v-1.6L14 17v-3z" />
  </SVG>
)

const ShipIcon = (p: IconProps) => (
  <SVG {...p}>
    <path d="M3 15l1.8 4.5a2 2 0 0 0 1.9 1.3h10.6a2 2 0 0 0 1.9-1.3L21 15z" />
    <path d="M12 3v8M9 6h6M5 15l7-3 7 3" />
  </SVG>
)

const TrainIcon = (p: IconProps) => (
  <SVG {...p}>
    <rect x="5" y="4" width="14" height="13" rx="3" />
    <path d="M5 11h14M9 17l-2 3M15 17l2 3" />
    <circle cx="9" cy="14" r="0.6" fill="currentColor" />
    <circle cx="15" cy="14" r="0.6" fill="currentColor" />
  </SVG>
)

const EventIcon = (p: IconProps) => (
  <SVG {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2.5" />
    <path d="M9.3 9a2.7 2.7 0 1 1 3.7 2.5c-.8.4-1 .8-1 1.8" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </SVG>
)

const HustleIcon = (p: IconProps) => (
  <SVG {...p}>
    <ellipse cx="12" cy="7" rx="6" ry="2.6" />
    <path d="M6 7v4c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V7" />
    <path d="M6 11v4c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-4" />
  </SVG>
)

const JailIcon = (p: IconProps) => (
  <SVG {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M9 4v16M15 4v16" />
  </SVG>
)

const JailGoIcon = (p: IconProps) => (
  <SVG {...p}>
    <rect x="11" y="4" width="9" height="16" rx="1.5" />
    <path d="M15.5 4v16" />
    <path d="M3 12h7M7 9l3 3-3 3" />
  </SVG>
)

const ParkingIcon = (p: IconProps) => (
  <SVG {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M10 17V8h3a2.5 2.5 0 0 1 0 5h-3" />
  </SVG>
)

/** Transports share a TileType; pick the real-world icon from the place name. */
function transportIcon(name: string): (p: IconProps) => React.ReactElement {
  if (/pelabuhan|tanjung/i.test(name)) return ShipIcon
  if (/stasiun|gambir/i.test(name)) return TrainIcon
  return PlaneIcon // Bandara + default
}

const TYPE_ICON: Partial<Record<TileType, (p: IconProps) => React.ReactElement>> = {
  go: GoIcon,
  tax: TaxIcon,
  event: EventIcon,
  hustle: HustleIcon,
  jail_visit: JailIcon,
  jail_go: JailGoIcon,
  parking: ParkingIcon,
}

/** The icon for a tile def, or null for plain property tiles (they show a price). */
export function TileGlyph({ def, className }: { def: TileDef; className?: string }) {
  const icon = def.type === 'transport' ? transportIcon(def.name) : TYPE_ICON[def.type]
  return icon ? icon({ className }) : null
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
  parking: '#51CF66', // success
  property: '#9A8F7D', // unused (region color wins)
}

/** A single development pip in the owner's color: a house or a building. */
export function DevPip({ track, color }: { track: PropertyTrack | null; color: string }) {
  if (track === 'property') {
    return (
      <svg viewBox="0 0 12 12" className="h-3 w-3" style={{ color }}>
        <rect
          x="2"
          y="2.5"
          width="8"
          height="8.5"
          rx="1"
          fill="currentColor"
          stroke="#1A1714"
          strokeWidth={1.4}
        />
        <rect x="4.4" y="4.6" width="1.4" height="1.4" fill="#1A1714" />
        <rect x="6.6" y="4.6" width="1.4" height="1.4" fill="#1A1714" />
      </svg>
    )
  }
  // house (and the unbuilt fallback)
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" style={{ color }}>
      <path
        d="M6 1.6 11 5.5 H9.8 V10.4 H2.2 V5.5 H1 Z"
        fill="currentColor"
        stroke="#1A1714"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  )
}
