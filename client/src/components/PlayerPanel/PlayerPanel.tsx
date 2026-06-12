import { ROLES, type GameState } from '@tuan-tanah/shared'
import { formatRupiah } from '../../store/gameStore.js'

export function PlayerPanel({
  state,
  myId,
  onSelect,
}: {
  state: GameState
  myId: string | null
  onSelect?: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase text-slate-400">Players</h2>
      {state.players.map((p, i) => {
        const isCurrent = i === state.currentPlayerIndex && state.phase === 'playing'
        const selectable = Boolean(onSelect) && p.id !== myId && !p.isEliminated
        return (
          <div
            key={p.id}
            onClick={selectable ? () => onSelect?.(p.id) : undefined}
            className={`rounded-lg border p-2.5 ${
              isCurrent ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700 bg-slate-800'
            } ${p.isEliminated ? 'opacity-40' : ''} ${
              selectable ? 'cursor-pointer hover:border-sky-400 hover:ring-1 hover:ring-sky-400' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
              <span className="text-sm font-semibold">
                {p.name}
                {p.id === myId && <span className="text-amber-400"> (you)</span>}
              </span>
              {p.inJail && <span className="text-[10px] text-red-400">🔒 jail</span>}
              {!p.isConnected && <span className="text-[10px] text-slate-500">offline</span>}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-slate-400">{p.role ? ROLES[p.role].name : '—'}</span>
              <span className="font-mono text-sm font-bold text-emerald-400">
                {formatRupiah(p.cash)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
