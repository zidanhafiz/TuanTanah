import { Flag, House, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGame } from '@/store/gameStore.js'
import { GameTimer } from '../GameTimer/GameTimer.js'
import { LeaveButton, SurrenderButton } from '../RoomActions.js'
import { SoundToggle } from '../SoundToggle.js'

/**
 * Full-width page header above the board + sidebar: the Tuan Tanah brand and
 * room/round on the left, sound toggle and leave/surrender on the right.
 * Transparent (no card frame) — it reads as the page's title bar. On mobile the
 * leave/surrender buttons collapse to icon-only. Game-state banners (debt,
 * winner) live in the sidebar, not here.
 */
export function GameHeader() {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()

  if (!state) return null

  const { phase } = state

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-3">
        <span className="rounded-xl border-2 border-ink bg-accent px-3 py-1 font-display text-lg uppercase tracking-tight text-ink shadow-brutal">
          {t('home.title')}
        </span>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="font-bold text-ink">{t('game.room', { code: state.roomId })}</span>
          <span>{t('game.round', { round: state.round })}</span>
          <GameTimer />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <SoundToggle className="h-8 w-8 text-sm" />
        {phase === 'ended' ? (
          <LeaveButton label={t('common.backHome')} icon={<House size={16} strokeWidth={2.5} />} />
        ) : (
          <>
            {me && !me.isEliminated && (
              <SurrenderButton icon={<Flag size={16} strokeWidth={2.5} />} />
            )}
            <LeaveButton
              confirm={t('game.leaveConfirm')}
              label={t('game.leaveGame')}
              icon={<LogOut size={16} strokeWidth={2.5} />}
            />
          </>
        )}
      </div>
    </div>
  )
}
