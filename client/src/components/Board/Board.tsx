import { BOARD, type GameState, type TileId } from '@tuan-tanah/shared'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { isRollAnimating, useRollAnim } from '../../store/rollAnimation.js'
import { DiceRoller } from '../DiceRoller/DiceRoller.js'
import { EDGE_TRACK, gridPos, innerSide } from './geometry.js'
import { OwnerPips, Tile } from './Tile.js'
import { TokenLayer } from './Tokens.js'

// Wider outer ring tracks give the playable tiles depth (see geometry.ts).
const GRID_TEMPLATE = `${EDGE_TRACK}fr repeat(9, 1fr) ${EDGE_TRACK}fr`

// Left/right tiles are rendered as the SAME portrait tile as top/bottom, rotated
// 90° so the colored header faces the board center. The cell is landscape
// (EDGE_TRACK × 1), so the pre-rotation portrait box is sized as the swapped
// dimensions (1 × EDGE_TRACK) in % of the cell, then centered + rotated.
const ROT_WIDTH = `${100 / EDGE_TRACK}%`
const ROT_HEIGHT = `${EDGE_TRACK * 100}%`

/** Rotation (deg) for a side tile so its header points inward; 0 for non-side tiles. */
function sideRotation(row: number, col: number): number {
  if (row > 1 && row < 11) {
    if (col === 1) return 90 // left column → header faces right
    if (col === 11) return -90 // right column → header faces left
  }
  return 0
}

export function Board({
  state,
  onSelectTile,
}: {
  state: GameState
  onSelectTile?: (id: TileId) => void
}) {
  const { t } = useTranslation()
  const current = state.players[state.currentPlayerIndex]
  const selectable = Boolean(onSelectTile)
  // Don't reveal the buy-target highlight until the token has finished walking.
  const animating = useRollAnim((s) => isRollAnimating(s.phase))

  return (
    <div className="aspect-square w-full max-w-[min(90vh,1024px)]">
      <div
        style={{ gridTemplateColumns: GRID_TEMPLATE, gridTemplateRows: GRID_TEMPLATE }}
        className="relative grid h-full w-full gap-[3px] rounded-xl border-2 border-ink bg-surface-sunken p-1 shadow-brutal"
      >
        {BOARD.map((def) => {
          const { row, col } = gridPos(def.id)
          const tile = state.tiles[def.id]
          const owner = tile?.ownerId
            ? (state.players.find((p) => p.id === tile.ownerId) ?? null)
            : null
          // Hold the buy-target highlight until the cinematic finishes so it
          // doesn't appear before the token has walked over to the tile.
          const isPending = state.turn.pendingBuyTileId === def.id && !animating
          const isCurrent = current?.position === def.id

          const rotate = sideRotation(row, col)
          const tileEl = (
            <Tile
              def={def}
              owner={owner}
              isPending={isPending}
              isCurrent={isCurrent}
              selectable={selectable}
              onSelect={onSelectTile}
              t={t}
            />
          )

          return (
            <div key={def.id} style={{ gridRow: row, gridColumn: col }} className="relative">
              {rotate ? (
                <div
                  className="absolute left-1/2 top-1/2"
                  style={{
                    width: ROT_WIDTH,
                    height: ROT_HEIGHT,
                    transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
                  }}
                >
                  {tileEl}
                </div>
              ) : (
                tileEl
              )}
              {owner && <OwnerPips tile={tile} owner={owner} side={innerSide(def.id)} />}
            </div>
          )
        })}

        {/* Animated player tokens (hop along tiles / teleport on cards). */}
        <TokenLayer state={state} />

        {/* Center area */}
        <div
          style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
          className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-lg bg-paper text-center"
        >
          {/* Faint rotated brand watermark for depth. */}
          <span className="pointer-events-none absolute select-none whitespace-nowrap font-display text-[5.5rem] uppercase leading-none tracking-tighter text-ink/[0.045] -rotate-[18deg]">
            {t('board.title')}
          </span>

          <div className="relative flex flex-col items-center">
            <div className="font-display text-4xl uppercase tracking-tight text-ink">
              {t('board.title')}
            </div>
            <div className="mt-1.5 h-1.5 w-16 rounded-full border border-ink bg-accent" />
            <div className="mt-2 inline-flex items-center rounded-full border-2 border-ink bg-surface px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-ink shadow-brutal-xs">
              {t('board.round', { round: state.round })}
            </div>
          </div>

          <div className="flex min-h-[4rem] items-center justify-center">
            <DiceRoller state={state} />
          </div>

          {current && (
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-3 py-1 text-sm shadow-brutal-sm"
              >
                <span
                  className="h-3 w-3 rounded-full border-2 border-ink"
                  style={{ background: current.color }}
                />
                <span>
                  <span className="text-ink-muted">{t('board.turn')} </span>
                  <span className="font-bold" style={{ color: current.color }}>
                    {current.name}
                  </span>
                </span>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
