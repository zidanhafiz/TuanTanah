import { BOARD, REGIONS, type GameState, type TileId } from '@tuan-tanah/shared'
import { motion } from 'framer-motion'

// Map a tile id (0–39) to an 11×11 grid cell, GO at bottom-right, going
// counter-clockwise (left along the bottom) like a classic Monopoly board.
function gridPos(id: TileId): { row: number; col: number } {
  if (id === 0) return { row: 11, col: 11 }
  if (id < 10) return { row: 11, col: 11 - id }
  if (id === 10) return { row: 11, col: 1 }
  if (id < 20) return { row: 11 - (id - 10), col: 1 }
  if (id === 20) return { row: 1, col: 1 }
  if (id < 30) return { row: 1, col: 1 + (id - 20) }
  if (id === 30) return { row: 1, col: 11 }
  return { row: 1 + (id - 30), col: 11 }
}

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
      <div className="grid h-full w-full grid-cols-11 grid-rows-11 gap-[3px] rounded-xl bg-slate-700 p-[3px]">
        {BOARD.map((def) => {
          const { row, col } = gridPos(def.id)
          const tile = state.tiles[def.id]
          const owner = tile?.ownerId ? state.players.find((p) => p.id === tile.ownerId) : null
          const region = def.region ? REGIONS[def.region] : null
          const here = state.players.filter((p) => p.position === def.id && !p.isEliminated)
          const isPending = state.turn.pendingBuyTileId === def.id
          const isCurrent = current?.position === def.id

          return (
            <div
              key={def.id}
              style={{ gridRow: row, gridColumn: col }}
              onClick={onSelectTile ? () => onSelectTile(def.id) : undefined}
              className={`relative flex flex-col overflow-hidden rounded-[5px] bg-slate-900 p-1 text-[9px] leading-tight ${
                isPending ? 'ring-2 ring-amber-400' : isCurrent ? 'ring-1 ring-white/40' : ''
              } ${selectable ? 'cursor-pointer hover:ring-2 hover:ring-sky-400' : ''}`}
            >
              {region && <div className="h-1.5 w-full rounded-sm" style={{ background: region.color }} />}
              <div className="mt-0.5 line-clamp-2 font-semibold text-slate-200">{def.name}</div>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-[8px] text-slate-500">
                  {region ? '' : (TYPE_LABEL[def.type] ?? '')}
                </span>
                {owner && (
                  <span
                    className="flex items-center gap-0.5 rounded px-1 text-[8px] font-bold text-white"
                    style={{ background: owner.color }}
                  >
                    {tile && tile.tier > 0 ? `T${tile.tier}` : '•'}
                  </span>
                )}
              </div>

              {/* Player tokens */}
              {here.length > 0 && (
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-0.5 p-0.5">
                  {here.map((p) => (
                    <motion.span
                      key={p.id}
                      layoutId={`token-${p.id}`}
                      className="h-2.5 w-2.5 rounded-full border border-white/70 shadow"
                      style={{ background: p.color }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Center area */}
        <div
          style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
          className="flex flex-col items-center justify-center rounded-lg bg-slate-800/60 text-center"
        >
          <div className="text-3xl font-black tracking-tight text-amber-400">Tuan Tanah</div>
          <div className="mt-1 text-xs text-slate-400">Round {state.round}</div>
          {state.turn.lastDice && (
            <div className="mt-4 flex gap-2">
              {state.turn.lastDice.map((d, i) => (
                <Die key={i} value={d} />
              ))}
            </div>
          )}
          {current && (
            <div className="mt-4 text-sm">
              <span className="text-slate-400">Turn: </span>
              <span className="font-bold" style={{ color: current.color }}>
                {current.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Die({ value }: { value: number }) {
  return (
    <motion.div
      key={value}
      initial={{ rotate: -90, scale: 0.6 }}
      animate={{ rotate: 0, scale: 1 }}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-lg font-bold text-slate-900 shadow"
    >
      {value}
    </motion.div>
  )
}
