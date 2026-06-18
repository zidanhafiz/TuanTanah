import {
  REGIONS,
  TRANSPORT_BUY_PRICE,
  type ActiveEffect,
  type Player,
  type TileDef,
  type TileId,
  type TileState,
} from '@tuan-tanah/shared'
import type { TFunction } from 'i18next'
import { tileEffectLabel, tileName } from '../../i18n/gameData.js'
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
  flip,
  effects,
  onSelect,
  t,
}: {
  def: TileDef
  owner: Player | null
  isPending: boolean
  isCurrent: boolean
  selectable: boolean
  /** Top-row tiles flip their internal order so the colored band hugs the board center. */
  flip?: boolean
  /** Active card effects currently targeting this tile (for the impact marker). */
  effects?: ActiveEffect[]
  onSelect?: (id: TileId) => void
  t: TFunction
}) {
  const region = def.region ? REGIONS[def.region] : null
  const isBuyable = def.type === 'property' || def.type === 'transport'
  const hasIcon = def.type !== 'property'
  const price = region ? region.buyPrice : def.type === 'transport' ? TRANSPORT_BUY_PRICE : null
  const name = tileName(t, def.id)

  // Impact marker for any card effect targeting this tile (e.g. Viral di Medsos
  // rent boost, Banjir Jakarta tier drop). Shows a badge with the full list on hover.
  const effectLabels = (effects ?? [])
    .map((e) => tileEffectLabel(t, e))
    .filter((l): l is string => l !== null)
  const effectMarker =
    effectLabels.length > 0 ? (
      <div
        className="absolute left-[0.3cqw] top-[0.3cqw] z-20 flex items-center gap-[0.2cqw] rounded border border-ink bg-warning px-[0.3cqw] text-[0.9cqw] font-extrabold leading-none text-ink"
        title={effectLabels.join(' · ')}
      >
        <span>⚡</span>
        {effectLabels.length === 1 ? (
          <span>{effectLabels[0]}</span>
        ) : (
          <span>{effectLabels.length}</span>
        )}
      </div>
    ) : null

  // When flipped, the header band sits on the bottom (band pulled into bottom
  // padding) and the price floats to the top; otherwise the classic top-down
  // order. Region (property) tiles use their region color; transport tiles use
  // the type color; everything else has no band.
  const bandColor = region ? region.color : def.type === 'transport' ? TYPE_COLOR.transport : null
  const band = bandColor ? (
    <div
      className={`-mx-[0.6cqw] h-[1cqw] ${flip ? '-mb-[0.6cqw]' : '-mt-[0.6cqw]'}`}
      style={{ background: bandColor }}
    />
  ) : null

  const body = hasIcon ? (
    /* Icon tiles (transport, GO, tax, jail, …): glyph + label, centered. */
    <div className="flex flex-1 flex-col items-center justify-center gap-[0.4cqw] px-[0.2cqw] text-center">
      <TileGlyph def={def} className="h-[2.4cqw] w-[2.4cqw]" />
      <span className="line-clamp-2 text-[1cqw] font-extrabold uppercase leading-tight tracking-tight text-ink">
        {name}
      </span>
    </div>
  ) : (
    /* Region (property) tiles: the location name sits next to the header band.
       When flipped, mt-auto on the name carries the gap so the band stays pinned
       to the bottom even when the tile is owned (and the price line is hidden). */
    <span
      className={`line-clamp-3 px-[0.2cqw] text-center text-[1.2cqw] font-extrabold leading-tight text-ink ${flip ? 'mb-[0.2cqw] mt-auto' : 'mt-[0.2cqw]'}`}
    >
      {name}
    </span>
  )

  // Price/tax line: pinned to the far edge from the band (bottom normally; top
  // when flipped, where the name's mt-auto provides the spacing instead).
  const edgeMargin = flip ? 'pb-[0.2cqw]' : 'mt-auto pt-[0.2cqw]'
  const priceLine = isBuyable && price !== null && !owner && (
    <span className={`w-full text-center text-[1.1cqw] font-bold text-ink-muted ${edgeMargin}`}>
      {compactRupiah(price)}
    </span>
  )
  const taxLine = def.type === 'tax' && def.taxPercent != null && (
    <span className={`w-full text-center text-[1.1cqw] font-bold text-danger-strong ${edgeMargin}`}>
      {def.taxPercent}%
    </span>
  )

  // Owner color band pinned to the edge nearest the board center (bottom, or top when flipped).
  const ownerBand = owner && <div className="h-[0.8cqw]" style={{ background: owner.color }} />

  return (
    <div
      onClick={onSelect ? () => onSelect(def.id) : undefined}
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-md border border-ink bg-surface text-[1.1cqw] leading-tight transition-all duration-200 ease-out ${
        isCurrent ? 'z-10 ring-2 ring-info shadow-brutal-sm' : isPending ? 'z-10 shadow-brutal' : ''
      } ${selectable ? 'cursor-pointer hover:z-10 hover:-translate-x-px hover:-translate-y-px hover:shadow-brutal' : ''}`}
    >
      {effectMarker}
      {flip && ownerBand}
      <div className="flex h-full flex-col p-[0.6cqw]">
        {flip ? (
          <>
            {priceLine}
            {taxLine}
            {body}
            {band}
          </>
        ) : (
          <>
            {band}
            {body}
            {priceLine}
            {taxLine}
          </>
        )}
      </div>
      {!flip && ownerBand}
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
