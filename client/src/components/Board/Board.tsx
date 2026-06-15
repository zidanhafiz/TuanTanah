import { BOARD, type GameState, type TileId } from '@tuan-tanah/shared'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isRollAnimating, useRollAnim } from '../../store/rollAnimation.js'
import { DiceRoller } from '../DiceRoller/DiceRoller.js'
import { FloatUp } from '../ui/FloatUp.js'
import { EDGE_TRACK, gridPos, innerSide } from './geometry.js'
import { OwnerPips, Tile } from './Tile.js'
import { TokenLayer } from './Tokens.js'

// Beat added after the token lands before the center flash appears, so it reads
// as a consequence of the move rather than racing the token onto the tile.
const CENTER_LOG_LAND_DELAY_MS = 360

/**
 * Flashes the newest log entry in the middle of the board — it rises and fades
 * so play has a glanceable "what just happened" without watching the side log.
 *
 * Like the post-roll action buttons, it holds while the dice/token cinematic is
 * in flight: a log entry that arrives in the same broadcast as a roll is shown
 * only once the token has landed (plus a short beat), keeping the flash in sync
 * with the token's actual position. Out-of-band entries (e.g. a buy after the
 * move has settled) fire immediately as before.
 */
function CenterLog({ log }: { log: GameState['log'] }) {
  const animating = useRollAnim((s) => isRollAnimating(s.phase))
  const last = log[log.length - 1]
  const prevId = useRef(last?.id)
  // Tracks whether the pending entry surfaced mid-cinematic, so we only add the
  // landing beat to entries that were actually waiting on the token.
  const heldDuringMove = useRef(false)
  const [item, setItem] = useState<GameState['log'][number] | null>(null)

  useEffect(() => {
    if (!last || last.id === prevId.current) return
    // Hold the flash until the token finishes walking (matches the action buttons).
    if (animating) {
      heldDuringMove.current = true
      return
    }
    prevId.current = last.id
    const delay = heldDuringMove.current ? CENTER_LOG_LAND_DELAY_MS : 0
    heldDuringMove.current = false
    const show = setTimeout(() => setItem(last), delay)
    return () => clearTimeout(show)
  }, [last, animating])

  useEffect(() => {
    if (!item) return
    const timer = setTimeout(() => setItem((x) => (x?.id === item.id ? null : x)), 2400)
    return () => clearTimeout(timer)
  }, [item])

  return (
    <div className="pointer-events-none absolute inset-x-[1.2cqw] bottom-[1.2cqw] flex justify-center">
      <FloatUp id={item?.id ?? null} rise={14}>
        <span className="line-clamp-2 max-w-[90%] rounded-lg border-2 border-ink bg-surface px-[1.2cqw] py-[0.4cqw] text-center text-[1.1cqw] font-bold text-ink shadow-brutal-xs">
          {item?.message}
        </span>
      </FloatUp>
    </div>
  )
}

// The board is a square CSS container (`container-type: inline-size`), so every in-cell
// dimension — font, padding, header band, icon, gap — is expressed in `cqw`
// (1cqw = 1% of the board's width) rather than fixed px. That keeps the whole
// board proportional at any screen size: the grid lays out natively (square,
// even, crisp) while its contents scale with it. The cqw values are calibrated
// so the board matches its original look at ~1000px wide (1cqw ≈ 10px) and
// shrinks uniformly below that. Text that no longer fits truncates via
// line-clamp. Keep this calibration in mind when tweaking any in-board size.

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
  centerSlot,
}: {
  state: GameState
  onSelectTile?: (id: TileId) => void
  /** Turn-action controls (roll, meta actions) surfaced inside the board center. */
  centerSlot?: ReactNode
}) {
  const { t } = useTranslation()
  const current = state.players[state.currentPlayerIndex]
  const selectable = Boolean(onSelectTile)
  // Don't reveal the buy-target highlight until the token has finished walking.
  const animating = useRollAnim((s) => isRollAnimating(s.phase))

  return (
    <div
      style={{ containerType: 'inline-size' }}
      className="aspect-square w-full max-w-[min(90vh,1024px)]"
    >
      <div
        style={{ gridTemplateColumns: GRID_TEMPLATE, gridTemplateRows: GRID_TEMPLATE }}
        className="relative grid h-full w-full gap-[0.3cqw] rounded-xl border-2 border-ink bg-surface-sunken p-[0.4cqw] shadow-brutal"
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
          // Top-row tiles flip their internal order (owner band + price on top,
          // header band on the bottom) so the colored band hugs the board center.
          const flip = row === 1
          const tileEl = (
            <Tile
              def={def}
              owner={owner}
              isPending={isPending}
              isCurrent={isCurrent}
              selectable={selectable}
              flip={flip}
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
          className="relative flex flex-col items-center justify-center gap-[1.6cqw] overflow-hidden rounded-lg bg-paper text-center"
        >
          {/* Faint rotated brand watermark for depth. */}
          <span className="pointer-events-none absolute select-none whitespace-nowrap font-display text-[8.8cqw] uppercase leading-none tracking-tighter text-ink/[0.045] -rotate-[18deg]">
            {t('board.title')}
          </span>

          <div className="relative flex flex-col items-center">
            <div className="font-display text-[3.6cqw] uppercase tracking-tight text-ink">
              {t('board.title')}
            </div>
            <div className="mt-[0.6cqw] h-[0.6cqw] w-[6.4cqw] rounded-full border border-ink bg-accent" />
            <div className="mt-[0.8cqw] inline-flex items-center rounded-full border-2 border-ink bg-surface px-[1.2cqw] py-[0.2cqw] text-[1.2cqw] font-bold uppercase tracking-wide text-ink shadow-brutal-xs">
              {t('board.round', { round: state.round })}
            </div>
          </div>

          <div className="flex min-h-[6.4cqw] items-center justify-center">
            <DiceRoller state={state} />
          </div>

          {centerSlot && (
            <div className="relative z-10 flex w-full max-w-[18rem] flex-col gap-2">
              {centerSlot}
            </div>
          )}

          {current && (
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative inline-flex items-center gap-[0.8cqw] rounded-full border-2 border-ink bg-surface px-[1.2cqw] py-[0.4cqw] text-[1.4cqw] shadow-brutal-sm"
              >
                <span
                  className="h-[1.2cqw] w-[1.2cqw] rounded-full border-2 border-ink"
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

          <CenterLog log={state.log} />
        </div>
      </div>
    </div>
  )
}
