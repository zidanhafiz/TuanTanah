import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../store/gameStore.js'

/**
 * Brief "Your turn" flash when the turn passes to the local player. Reads turn
 * state from the store and shows once per transition (not on every re-render).
 */
export function TurnBanner() {
  const isMyTurn = useGame((s) => s.isMyTurn)()
  const phase = useGame((s) => s.state?.phase)
  const [show, setShow] = useState(false)
  const wasMyTurn = useRef(isMyTurn)

  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current && phase === 'playing') {
      setShow(true)
      const t = setTimeout(() => setShow(false), 1700)
      wasMyTurn.current = isMyTurn
      return () => clearTimeout(t)
    }
    wasMyTurn.current = isMyTurn
  }, [isMyTurn, phase])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -28, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          className="pointer-events-none fixed left-1/2 top-6 z-toast -translate-x-1/2 rounded-xl border-2 border-ink bg-accent px-6 py-2.5 font-display text-xl uppercase tracking-tight text-ink shadow-brutal-lg"
          role="status"
        >
          Your turn!
        </motion.div>
      )}
    </AnimatePresence>
  )
}
