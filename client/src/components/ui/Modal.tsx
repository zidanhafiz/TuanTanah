import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { backdrop, modalPanel } from '../../lib/motion.js'

export interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Optional header title rendered in the framed bar. */
  title?: ReactNode
  /** Tailwind max-width class for the panel. */
  size?: 'sm' | 'md' | 'lg'
  /** Disable backdrop-click / Escape close (e.g. forced decisions). */
  dismissable?: boolean
  className?: string
}

const MAX_W = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' } as const

/**
 * Brutalist modal: dimmed backdrop + framed panel with consistent enter/exit
 * motion, Escape-to-close, backdrop dismiss, and body scroll-lock.
 */
export function Modal({
  open,
  onClose,
  children,
  title,
  size = 'md',
  dismissable = true,
  className = '',
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, dismissable, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          {...backdrop}
          className="fixed inset-0 z-modal flex items-center justify-center bg-ink/40 p-4"
          onClick={dismissable ? onClose : undefined}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            {...modalPanel}
            onClick={(e) => e.stopPropagation()}
            className={`w-full ${MAX_W[size]} overflow-hidden rounded-xl border-2 border-ink bg-surface shadow-brutal-xl ${className}`}
          >
            {title != null && (
              <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-accent px-4 py-2.5">
                <h2 className="font-display text-lg uppercase tracking-tight text-ink">{title}</h2>
                {dismissable && (
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="flex h-7 w-7 items-center justify-center rounded-md border-2 border-ink bg-surface text-sm font-black leading-none brutal-press"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            <div className="p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
