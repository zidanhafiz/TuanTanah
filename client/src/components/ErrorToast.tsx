import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useGame } from '../store/gameStore.js'

export function ErrorToast() {
  const error = useGame((s) => s.error)
  const clearError = useGame((s) => s.clearError)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 3500)
    return () => clearTimeout(t)
  }, [error, clearError])

  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
          onClick={clearError}
          role="alert"
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
