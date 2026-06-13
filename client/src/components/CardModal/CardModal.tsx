import { HUSTLE_CARDS, KEJADIAN_CARDS } from '@tuan-tanah/shared'
import { useEffect } from 'react'
import { Badge, Card, Modal } from '../ui/index.js'
import { formatRupiah, useGame } from '../../store/gameStore.js'

const HUSTLE = new Map(HUSTLE_CARDS.map((c) => [c.id, c]))
const KEJADIAN = new Map(KEJADIAN_CARDS.map((c) => [c.id, c]))

export function CardModal() {
  const card = useGame((s) => s.lastCard)
  const dismiss = useGame((s) => s.dismissCard)
  const state = useGame((s) => s.state)

  useEffect(() => {
    if (!card) return
    const t = setTimeout(dismiss, 4000)
    return () => clearTimeout(t)
  }, [card, dismiss])

  if (!card) return null
  const player = state?.players.find((p) => p.id === card.playerId)
  const isHustle = card.type === 'hustle'
  const detail = isHustle
    ? `Earn ${formatRupiah(HUSTLE.get(card.cardId)?.earn ?? 0)}`
    : (KEJADIAN.get(card.cardId)?.effect ?? '')

  return (
    <Modal
      open={card != null}
      onClose={dismiss}
      title={isHustle ? 'Hustle' : 'Kejadian Nasional'}
      size="sm"
    >
      <Card flat tone={isHustle ? 'success' : 'info'} className="p-4 text-center">
        <div className="font-display text-2xl uppercase tracking-tight text-ink">{card.name}</div>
        <div className="mt-3 text-sm font-semibold text-ink">{detail}</div>
      </Card>
      {player && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-muted">
          Drawn by <Badge color={player.color}>{player.name}</Badge>
        </div>
      )}
    </Modal>
  )
}
