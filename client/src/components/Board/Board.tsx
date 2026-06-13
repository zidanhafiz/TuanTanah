import { BOARD, REGIONS, type GameState, type TileId } from '@tuan-tanah/shared'
import { AnimatePresence, motion } from 'framer-motion'
import { DiceRoller } from '../DiceRoller/DiceRoller.js'
import { gridPos } from './geometry.js'
import { TokenLayer } from './Tokens.js'

const TYPE_LABEL: Record<string, string> = {
  go: 'GO',
  tax: 'Pajak',
  transport: 'Transport',
  event: 'Kejadian',
  hustle: 'Hustle',
  jail_visit: 'Jenguk',
  jail_go: 'Penjara!',
  parking: 'Parkir',
}

export function Board({
  state,
  onSelectTile,
}: {
  state: GameState
  onSelectTile?: (id: TileId) => void
}) {
  const current = state.players[state.currentPlayerIndex]
  const selectable = Boolean(onSelectTile)

  return (
    <div className="aspect-square w-full max-w-[min(82vh,860px)]">
      <div className="relative grid h-full w-full grid-cols-11 grid-rows-11 gap-[3px] rounded-xl border-2 border-ink bg-surface-sunken p-[3px] shadow-brutal-sm">
        {BOARD.map((def) => {
          const { row, col } = gridPos(def.id)
          const tile = state.tiles[def.id]
          const owner = tile?.ownerId ? state.players.find((p) => p.id === tile.ownerId) : null
          const region = def.region ? REGIONS[def.region] : null
          const isPending = state.turn.pendingBuyTileId === def.id
          const isCurrent = current?.position === def.id

          return (
            <div
              key={def.id}
              style={{ gridRow: row, gridColumn: col }}
              onClick={onSelectTile ? () => onSelectTile(def.id) : undefined}
              className={`relative flex flex-col overflow-hidden rounded-[5px] border border-ink bg-surface p-1 text-[9px] leading-tight transition-shadow ${
                isPending
                  ? 'ring-2 ring-accent-strong shadow-brutal-sm'
                  : isCurrent
                    ? 'ring-2 ring-info'
                    : ''
              } ${selectable ? 'cursor-pointer hover:ring-2 hover:ring-info' : ''}`}
            >
              {region && (
                <div
                  className="h-1.5 w-full rounded-sm border border-ink/50"
                  style={{ background: region.color }}
                />
              )}
              <div className="mt-0.5 line-clamp-2 font-semibold text-ink">{def.name}</div>
              <div className="mt-auto flex items-center justify-between gap-0.5">
                <span className="text-[8px] font-semibold uppercase text-ink-faint">
                  {region ? '' : (TYPE_LABEL[def.type] ?? '')}
                </span>
                {owner && (
                  <span
                    className="flex items-center gap-0.5 rounded border border-ink px-1 text-[8px] font-bold leading-tight text-white"
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
          <div className="font-display text-3xl uppercase tracking-tight text-ink">Tuan Tanah</div>
          <div className="mt-1 text-xs font-semibold text-ink-muted">Round {state.round}</div>
          <div className="mt-4 flex min-h-[2.5rem] items-center justify-center">
            <DiceRoller state={state} />
          </div>
          {current && (
            <div className="mt-4 h-5 text-sm">
              <span className="text-ink-muted">Turn: </span>
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
