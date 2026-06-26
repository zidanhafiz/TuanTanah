import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { EASE_SNAP } from '@/lib/motion.js'

/**
 * A transient label that rises and fades out — the shared vocabulary for the
 * floating money-change pop (PlayerPanel) and the recent-log flash (board
 * center). Render it with a changing `id` (an incrementing counter or a
 * log-entry id); each new id mounts a fresh copy that drifts up and disappears
 * while the previous one exits. Pass `null` to show nothing. Positioning is the
 * caller's job — wrap it in a `relative` (or absolute) parent.
 */
export function FloatUp({
  id,
  children,
  className,
  rise = 16,
}: {
  id: string | number | null
  children: ReactNode
  className?: string
  rise?: number
}) {
  return (
    <AnimatePresence>
      {id != null && (
        <motion.div
          key={id}
          initial={{ opacity: 0, y: 0, scale: 0.82 }}
          animate={{ opacity: 1, y: -rise, scale: 1 }}
          exit={{ opacity: 0, y: -rise * 1.6, scale: 0.95 }}
          transition={{ duration: 0.45, ease: EASE_SNAP }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
