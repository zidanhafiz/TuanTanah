import { HUSTLE_CARDS } from '@tuan-tanah/shared'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { hustleName, kejadianEffect, kejadianName } from '../../i18n/gameData.js'
import { Badge, Card, Modal } from '../ui/index.js'
import { formatRupiah, useGame } from '../../store/gameStore.js'
import { isRollAnimating, useRollAnim } from '../../store/rollAnimation.js'

const HUSTLE = new Map(HUSTLE_CARDS.map((c) => [c.id, c]))

export function CardModal() {
  const { t } = useTranslation()
  const card = useGame((s) => s.lastCard)
  const dismiss = useGame((s) => s.dismissCard)
  const state = useGame((s) => s.state)
  // A card arrives in the same broadcast as the roll, but it shouldn't flip open
  // until the token has actually walked onto the tile that drew it.
  const animating = useRollAnim((s) => isRollAnimating(s.phase))
  const visible = card != null && !animating

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(dismiss, 4000)
    return () => clearTimeout(timer)
  }, [visible, dismiss])

  if (!card || !visible) return null
  const player = state?.players.find((p) => p.id === card.playerId)
  const isHustle = card.type === 'hustle'
  const name = isHustle ? hustleName(t, card.cardId) : kejadianName(t, card.cardId)
  const detail = isHustle
    ? t('card.earn', { amount: formatRupiah(HUSTLE.get(card.cardId)?.earn ?? 0) })
    : kejadianEffect(t, card.cardId)

  return (
    <Modal
      open={card != null}
      onClose={dismiss}
      title={isHustle ? t('card.hustle') : t('card.kejadianNasional')}
      size="sm"
    >
      <Card flat tone={isHustle ? 'success' : 'info'} className="p-4 text-center">
        <div className="font-display text-2xl uppercase tracking-tight text-ink">{name}</div>
        <div className="mt-3 text-sm font-semibold text-ink">{detail}</div>
      </Card>
      {player && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-muted">
          {t('card.drawnBy')} <Badge color={player.color}>{player.name}</Badge>
        </div>
      )}
    </Modal>
  )
}
