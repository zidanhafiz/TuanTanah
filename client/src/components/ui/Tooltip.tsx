import { AnimatePresence, motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'

export interface TooltipProps {
  /** Bubble content. When empty/nullish the trigger renders with no tooltip. */
  content: ReactNode
  children: ReactNode
  /** Anchor the bubble above (default) or below the trigger. */
  side?: 'top' | 'bottom'
  /** Extra wrapper classes — pass `w-full` when wrapping a block button. */
  className?: string
}

const tip = {
  initial: { opacity: 0, y: 4, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.96 },
  transition: { duration: 0.12 },
}

/**
 * Brutalist hover/focus tooltip: a framed ink bubble anchored to the trigger.
 * Shown on pointer hover and keyboard focus. Wrap a `block` button and pass
 * `className="w-full"` so the trigger keeps its full width inside the wrapper.
 */
export function Tooltip({ content, children, side = 'top', className = '' }: TooltipProps) {
  const [open, setOpen] = useState(false)
  if (content == null || content === '') return <>{children}</>
  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            {...tip}
            role="tooltip"
            className={`pointer-events-none absolute left-1/2 z-tooltip w-max max-w-[200px] -translate-x-1/2 rounded-md border-2 border-ink bg-ink px-2 py-1 text-center text-[11px] font-semibold leading-snug text-surface shadow-brutal-sm ${
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
