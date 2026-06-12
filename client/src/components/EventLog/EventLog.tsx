import { type GameState } from '@tuan-tanah/shared'
import { useEffect, useRef } from 'react'

export function EventLog({ state }: { state: GameState }) {
  const ref = useRef<HTMLDivElement>(null)
  const recent = state.log.slice(-40)

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [state.log.length])

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-1 text-xs font-semibold uppercase text-slate-400">Event log</h2>
      <div
        ref={ref}
        className="flex-1 space-y-1 overflow-y-auto rounded-lg bg-slate-900 p-2 text-xs text-slate-300"
      >
        {recent.map((e) => (
          <div key={e.id} className="border-b border-slate-800 pb-1 last:border-0">
            <span className="text-slate-600">R{e.round} · </span>
            {e.message}
          </div>
        ))}
        {recent.length === 0 && <div className="text-slate-600">No events yet.</div>}
      </div>
    </div>
  )
}
