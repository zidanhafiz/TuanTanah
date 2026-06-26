import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNow } from '@/hooks/useNow.js'
import { useGame } from '@/store/gameStore.js'

/** Format a duration in ms as M:SS (or H:MM:SS once past an hour). */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Elapsed match time, ticking every second off the shared `startedAt` timestamp.
 * Purely client-side — every client derives the same value from server state, so
 * no per-second broadcast is needed. Renders nothing until the game is live.
 */
export function GameTimer() {
  const { t } = useTranslation()
  const startedAt = useGame((s) => s.state?.startedAt)
  const phase = useGame((s) => s.state?.phase)
  const now = useNow(1000)

  if (phase !== 'playing' || !startedAt) return null
  const elapsed = formatElapsed(now - startedAt)

  return (
    <span
      className="flex items-center gap-1 font-mono font-bold tabular-nums text-ink"
      title={t('game.elapsed', { time: elapsed })}
    >
      <Clock size={12} strokeWidth={2.5} />
      {elapsed}
    </span>
  )
}
