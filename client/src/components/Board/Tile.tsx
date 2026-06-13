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
import { DevGlyph, TileGlyph, TYPE_COLOR } from './icons.js'

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
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-md border border-ink bg-surface text-[1.1cqw] leading-tight transition-all duration-200 ease-out ${
        isPending
          ? 'z-10 ring-2 ring-accent-strong shadow-brutal'
          : isCurrent
            ? 'z-10 ring-2 ring-info shadow-brutal-sm'
            : ''
      } ${selectable ? 'cursor-pointer hover:z-10 hover:-translate-x-px hover:-translate-y-px hover:ring-2 hover:ring-info hover:shadow-brutal' : ''}`}
    >
      <div className="flex h-full flex-col p-[0.6cqw]">
        {/* Colored header band — region color for property, type color otherwise. */}
        <div className="-mx-[0.6cqw] -mt-[0.6cqw] h-[1cqw]" style={{ background: stripColor }} />

        {hasIcon ? (
          /* Icon tiles (transport, GO, tax, jail, …): glyph + label, centered. */
          <div className="flex flex-1 flex-col items-center justify-center gap-[0.4cqw] px-[0.2cqw] text-center">
            <TileGlyph def={def} className="h-[2.4cqw] w-[2.4cqw] text-ink" />
            <span className="line-clamp-2 text-[1cqw] font-extrabold uppercase leading-tight tracking-tight text-ink">
              {name}
            </span>
          </div>
        ) : (
          /* Region (property) tiles: the location name sits right up at the top. */
          <span className="mt-[0.2cqw] line-clamp-3 px-[0.2cqw] text-center text-[1.2cqw] font-extrabold leading-tight text-ink">
            {name}
          </span>
        )}

        {/* Price sits close to the bottom edge — and disappears once the tile is owned. */}
        {isBuyable && price !== null && !owner && (
          <span className="mt-auto w-full pt-[0.2cqw] text-center text-[1.1cqw] font-bold text-ink-muted">
            {compactRupiah(price)}
          </span>
        )}
        {def.type === 'tax' && def.taxAmount != null && (
          <span className="mt-auto w-full pt-[0.2cqw] text-center text-[1.1cqw] font-bold text-danger-strong">
            {compactRupiah(def.taxAmount)}
          </span>
        )}
      </div>

      {/* Owner color band pinned to the bottom edge. */}
      {owner && <div className="h-[0.8cqw]" style={{ background: owner.color }} />}
    </div>
  )
}

const SIDE_POS: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-[0.4cqw] flex-row',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-[0.4cqw] flex-row',
  left: 'right-full top-1/2 -translate-y-1/2 mr-[0.4cqw] flex-col',
  right: 'left-full top-1/2 -translate-y-1/2 ml-[0.4cqw] flex-col',
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
  const track = tile?.track ?? null
  return (
    <div
      className={`absolute z-20 flex items-center ${SIDE_POS[side]}`}
      title={tier > 0 ? `${owner.name} · T${tier}` : owner.name}
    >
      {tier <= 0 || !track ? (
        <span
          className="h-[1.4cqw] w-[1.4cqw] rounded-full border border-ink"
          style={{ background: owner.color }}
        />
      ) : (
        <DevGlyph track={track} tier={tier} color={owner.color} />
      )}
    </div>
  )
}
