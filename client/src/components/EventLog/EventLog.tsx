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
      <h2 className="mb-1 text-xs font-bold uppercase text-ink-muted">Event log</h2>
      <div
        ref={ref}
        className="flex-1 space-y-1 overflow-y-auto rounded-lg border-2 border-ink bg-surface-sunken p-2 text-xs text-ink"
      >
        {recent.map((e) => (
          <div key={e.id} className="border-b border-ink/15 pb-1 last:border-0">
            <span className="text-ink-faint">R{e.round} · </span>
            {e.message}
          </div>
        ))}
        {recent.length === 0 && <div className="text-ink-faint">No events yet.</div>}
      </div>
    </div>
  )
}
