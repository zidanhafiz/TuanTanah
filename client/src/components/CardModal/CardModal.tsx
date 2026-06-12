import { HUSTLE_CARDS, KEJADIAN_CARDS } from '@tuan-tanah/shared'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
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
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
      >
        <motion.div
          initial={{ scale: 0.7, rotate: -6, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className={`w-80 rounded-2xl p-6 shadow-2xl ${
            isHustle ? 'bg-emerald-600' : 'bg-indigo-600'
          } text-white`}
        >
          <div className="text-xs font-semibold uppercase tracking-widest opacity-80">
            {isHustle ? 'Hustle' : 'Kejadian Nasional'}
          </div>
          <div className="mt-1 text-2xl font-bold">{card.name}</div>
          <div className="mt-3 text-sm opacity-90">{detail}</div>
          {player && <div className="mt-4 text-xs opacity-70">Drawn by {player.name}</div>}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
