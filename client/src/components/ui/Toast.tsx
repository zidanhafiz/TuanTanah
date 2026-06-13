import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { toastSlide } from '../../lib/motion.js'

type Tone = 'error' | 'info' | 'success'

const TONE: Record<Tone, string> = {
  error: 'bg-danger text-ink',
  info: 'bg-info text-ink',
  success: 'bg-success text-ink',
}

export interface ToastProps {
  show: boolean
  children: ReactNode
  tone?: Tone
  onDismiss?: () => void
}

/** Bottom-centered framed toast with consistent slide-up motion. */
export function Toast({ show, children, tone = 'error', onDismiss }: ToastProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          {...toastSlide}
          className={`fixed bottom-6 left-1/2 z-toast max-w-[90vw] -translate-x-1/2 cursor-pointer rounded-lg border-2 border-ink px-4 py-2.5 text-sm font-bold shadow-brutal ${TONE[tone]}`}
          onClick={onDismiss}
          role="alert"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
