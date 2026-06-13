import {
  REGIONS,
  TRANSPORT_BUY_PRICE,
  type Player,
  type TileDef,
  type TileId,
  type TileState,
} from '@tuan-tanah/shared'
import type { TFunction } from 'i18next'
import { tileName } from '../../i18n/gameData.js'
import { compactRupiah } from '../../lib/format.js'
import type { Side } from './geometry.js'
import { DevPip, TileGlyph, TYPE_COLOR } from './icons.js'

/**
 * One board cell. Properties show a colored region header band + name + price;
 * every other tile (transport, GO, tax, jail, event, …) shows a centered glyph.
 * All text is centered. Ownership is shown by the bottom color band plus pips
 * rendered *outside* the tile (see OwnerPips) toward the board center.
 */
export function Tile({
  def,
  owner,
  isPending,
  isCurrent,
  selectable,
  onSelect,
  t,
}: {
  def: TileDef
  owner: Player | null
  isPending: boolean
  isCurrent: boolean
  selectable: boolean
  onSelect?: (id: TileId) => void
  t: TFunction
}) {
  const region = def.region ? REGIONS[def.region] : null
  const isBuyable = def.type === 'property' || def.type === 'transport'
  const hasIcon = def.type !== 'property'
  const stripColor = region ? region.color : TYPE_COLOR[def.type]
  const price = region ? region.buyPrice : def.type === 'transport' ? TRANSPORT_BUY_PRICE : null
  const name = tileName(t, def.id)

  return (
    <div
      onClick={onSelect ? () => onSelect(def.id) : undefined}
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-md border border-ink bg-surface text-[11px] leading-tight transition-all ${
        isPending
          ? 'z-10 ring-2 ring-accent-strong shadow-brutal'
          : isCurrent
            ? 'z-10 ring-2 ring-info shadow-brutal-sm'
            : ''
      } ${selectable ? 'cursor-pointer hover:z-10 hover:ring-2 hover:ring-info hover:shadow-brutal-sm' : ''}`}
    >
      <div className="flex h-full flex-col p-1.5">
        {/* Colored header band — region color for property, type color otherwise. */}
        <div className="-mx-1.5 -mt-1.5 h-2.5" style={{ background: stripColor }} />

        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-0.5 text-center">
          {hasIcon && <TileGlyph def={def} className="h-5 w-5 text-ink" />}
          <span
            className={`line-clamp-2 text-ink ${
              hasIcon
                ? 'text-[9px] font-bold uppercase tracking-tight'
                : 'text-[10px] font-semibold'
            }`}
          >
            {name}
          </span>
          {isBuyable && price !== null && (
            <span className="text-[10px] font-bold text-ink-muted">{compactRupiah(price)}</span>
          )}
          {def.type === 'tax' && def.taxAmount != null && (
            <span className="text-[10px] font-bold text-danger-strong">
              {compactRupiah(def.taxAmount)}
            </span>
          )}
        </div>
      </div>

      {/* Owner color band pinned to the bottom edge. */}
      {owner && <div className="h-2" style={{ background: owner.color }} />}
    </div>
  )
}

const SIDE_POS: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1 flex-row',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1 flex-row',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1 flex-col',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1 flex-col',
}

/**
 * Development pips for an owned tile, floated just outside the tile toward the
 * board center (so they never crowd the small cell). A single dot means owned
 * but undeveloped; otherwise one house/building pip per tier in the owner color.
 */
export function OwnerPips({
  tile,
  owner,
  side,
}: {
  tile: TileState | undefined
  owner: Player
  side: Side
}) {
  const tier = tile?.tier ?? 0
  return (
    <div
      className={`absolute z-20 flex items-center ${SIDE_POS[side]}`}
      title={tier > 0 ? `${owner.name} · T${tier}` : owner.name}
    >
      {tier <= 0 ? (
        <span
          className="h-3 w-3 rounded-full border border-ink"
          style={{ background: owner.color }}
        />
      ) : (
        Array.from({ length: tier }, (_, i) => (
          <DevPip key={i} track={tile?.track ?? null} color={owner.color} />
        ))
      )}
    </div>
  )
}
