import { useTranslation } from 'react-i18next'
import { useNow } from '../../hooks/useNow.js'
import { useGame } from '../../store/gameStore.js'
import { Card } from '../ui/index.js'

// Below this many seconds the countdown switches to an urgent danger style.
const URGENT_AT_SECONDS = 10

/**
 * An urgent alarm banner shown only in the final seconds before the active
 * player's AFK auto-skip — the always-on per-turn countdown lives on the player
 * panel; this one fires late to grab attention. Driven by the server's
 * `turn.deadline`; the copy changes when it's your own turn. Hidden in the lobby,
 * after the game ends, or while play is paused on a debt/vote.
 */
export function AfkCountdown() {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const now = useNow(1000)

  if (!state || state.phase !== 'playing') return null
  const deadline = state.turn.deadline
  if (deadline == null) return null
  const current = state.players[state.currentPlayerIndex]
  if (!current || current.isEliminated) return null

  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000))
  if (secondsLeft > URGENT_AT_SECONDS) return null
  const mine = me?.id === current.id

  return (
    <Card flat tone="danger" className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className="font-semibold text-danger-strong">
        {mine ? t('game.afkMine') : t('game.afkOther', { name: current.name })}
      </span>
      <span className="font-mono font-bold tabular-nums text-danger-strong">
        {t('game.afkSeconds', { seconds: secondsLeft })}
      </span>
    </Card>
  )
}
