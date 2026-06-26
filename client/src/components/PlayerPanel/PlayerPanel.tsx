import { type GameState } from '@tuan-tanah/shared'
import { useTranslation } from 'react-i18next'
import { useNow } from '@/hooks/useNow.js'
import { passTypeName, roleName } from '@/i18n/gameData.js'
import { formatRupiah } from '@/store/gameStore.js'
import { MoneyDelta } from '../ui/MoneyDelta.js'

// Below this many seconds the current player's turn countdown turns urgent.
const URGENT_AT_SECONDS = 10

/** Format remaining seconds as M:SS. */
function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlayerPanel({
  state,
  myId,
  onSelect,
}: {
  state: GameState
  myId: string | null
  onSelect?: (id: string) => void
}) {
  const { t } = useTranslation()
  const now = useNow(1000)
  const deadline = state.turn.deadline
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-bold uppercase text-ink-muted">{t('player.players')}</h2>
      {state.players.map((p, i) => {
        const isCurrent = i === state.currentPlayerIndex && state.phase === 'playing'
        // The active player's turn carries a live AFK countdown, shown on their row.
        const turnSecondsLeft =
          isCurrent && deadline != null ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null
        const selectable = Boolean(onSelect) && p.id !== myId && !p.isEliminated
        return (
          <div
            key={p.id}
            onClick={selectable ? () => onSelect?.(p.id) : undefined}
            className={`rounded-lg border-2 border-ink p-2.5 ${
              isCurrent ? 'bg-accent-soft shadow-brutal-sm' : 'bg-surface'
            } ${p.isEliminated ? 'opacity-40' : ''} ${
              selectable ? 'cursor-pointer hover:shadow-brutal-sm' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full border-2 border-ink"
                style={{ background: p.color }}
              />
              <span className="text-sm font-bold text-ink">
                {p.name}
                {p.id === myId && (
                  <span className="font-bold text-ink">{t('common.youParen')}</span>
                )}
              </span>
              {p.inJail && (
                <span className="text-[10px] font-bold text-danger-strong">{t('player.jail')}</span>
              )}
              {!p.isConnected && (
                <span className="text-[10px] text-ink-faint">{t('player.offline')}</span>
              )}
              {p.afkStrikes > 0 && !p.isEliminated && (
                <span className="text-[10px] font-bold text-danger-strong">
                  {t('player.afk', { count: p.afkStrikes })}
                </span>
              )}
              {turnSecondsLeft != null && (
                <span
                  className={`ml-auto font-mono text-xs font-bold tabular-nums ${
                    turnSecondsLeft <= URGENT_AT_SECONDS ? 'text-danger-strong' : 'text-ink-muted'
                  }`}
                >
                  {formatClock(turnSecondsLeft)}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-ink-muted">
                {p.role ? roleName(t, p.role) : t('common.dash')}
              </span>
              <span className="relative font-mono text-sm font-bold text-success-strong">
                {formatRupiah(p.cash)}
                <MoneyDelta cash={p.cash} />
              </span>
            </div>
            {p.loans.length > 0 && (
              <div className="mt-1 text-[10px] font-semibold text-ink-muted">
                {t('player.loans', {
                  count: p.loans.length,
                  owed: formatRupiah(p.loans.reduce((s, l) => s + l.amount, 0)),
                  perRound: formatRupiah(p.loans.reduce((s, l) => s + l.interestPerLap, 0)),
                })}
              </div>
            )}
            {p.ownedCards.length > 0 && (
              <div className="mt-1 text-[10px] font-semibold text-ink-muted">
                {t('player.passes', {
                  count: p.ownedCards.length,
                  list: p.ownedCards.map((c) => passTypeName(t, c.type)).join(', '),
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
