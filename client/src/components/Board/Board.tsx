import { BOARD, REGIONS, type GameState, type TileId } from '@tuan-tanah/shared'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { tileName } from '../../i18n/gameData.js'
import { isRollAnimating, useRollAnim } from '../../store/rollAnimation.js'
import { DiceRoller } from '../DiceRoller/DiceRoller.js'
import { gridPos } from './geometry.js'
import { TokenLayer } from './Tokens.js'

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
      <div className="relative grid h-full w-full grid-cols-11 grid-rows-11 gap-[3px] rounded-xl border-2 border-ink bg-surface-sunken p-1 shadow-brutal-sm">
        {BOARD.map((def) => {
          const { row, col } = gridPos(def.id)
          const tile = state.tiles[def.id]
          const owner = tile?.ownerId ? state.players.find((p) => p.id === tile.ownerId) : null
          const region = def.region ? REGIONS[def.region] : null
          // Hold the buy-target highlight until the cinematic finishes so it
          // doesn't appear before the token has walked over to the tile.
          const isPending = state.turn.pendingBuyTileId === def.id && !animating
          const isCurrent = current?.position === def.id

          return (
            <div
              key={def.id}
              style={{ gridRow: row, gridColumn: col }}
              onClick={onSelectTile ? () => onSelectTile(def.id) : undefined}
              className={`relative flex flex-col overflow-hidden rounded-md border border-ink bg-surface p-1.5 text-[11px] leading-tight transition-shadow ${
                isPending
                  ? 'ring-2 ring-accent-strong shadow-brutal-sm'
                  : isCurrent
                    ? 'ring-2 ring-info'
                    : ''
              } ${selectable ? 'cursor-pointer hover:ring-2 hover:ring-info' : ''}`}
            >
              {region && (
                <div
                  className="h-2 w-full rounded-sm border border-ink/50"
                  style={{ background: region.color }}
                />
              )}
              <div className="mt-1 line-clamp-3 font-semibold text-ink">{tileName(t, def.id)}</div>
              <div className="mt-auto flex items-center justify-between gap-0.5">
                <span className="text-[9px] font-semibold uppercase text-ink-faint">
                  {region ? '' : t(`board.types.${def.type}`, { defaultValue: '' })}
                </span>
                {owner && (
                  <span
                    className="flex items-center gap-0.5 rounded border border-ink px-1 text-[9px] font-bold leading-tight text-white"
                    style={{ background: owner.color }}
                  >
                    {tile && tile.tier > 0 ? `T${tile.tier}` : '•'}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {/* Animated player tokens (hop along tiles / teleport on cards). */}
        <TokenLayer state={state} />

        {/* Center area */}
        <div
          style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-ink bg-paper text-center shadow-brutal-sm"
        >
          <div className="font-display text-4xl uppercase tracking-tight text-ink">
            {t('board.title')}
          </div>
          <div className="mt-1 text-xs font-semibold text-ink-muted">
            {t('board.round', { round: state.round })}
          </div>
          <div className="mt-4 flex min-h-[2.5rem] items-center justify-center">
            <DiceRoller state={state} />
          </div>
          {current && (
            <div className="mt-4 h-5 text-sm">
              <span className="text-ink-muted">{t('board.turn')} </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={current.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="inline-block font-bold"
                  style={{ color: current.color }}
                >
                  {current.name}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
