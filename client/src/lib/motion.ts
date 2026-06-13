/**
 * Shared motion vocabulary for Framer Motion.
 *
 * One source of truth for durations/easings so every transition (token hops,
 * modal enter/exit, phase changes, toasts) feels like the same system.
 */

export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const

/** Standard ease — most transitions. */
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const

/** Overshoot ease — matches the chunky `ease-snap` used on hover/press. */
export const EASE_SNAP = [0.34, 1.56, 0.64, 1] as const

/** Springy token hop between board tiles. */
export const SPRING_HOP = { type: 'spring', stiffness: 700, damping: 30, mass: 0.6 } as const

/** Soft spring for panels/modals settling in. */
export const SPRING_SOFT = { type: 'spring', stiffness: 400, damping: 32 } as const

/** Modal panel enter/exit. */
export const modalPanel = {
  initial: { opacity: 0, scale: 0.95, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 8 },
  transition: { duration: DURATION.base, ease: EASE_SNAP },
} as const

/** Backdrop fade. */
export const backdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.fast },
} as const

/** Toast slide-up. */
export const toastSlide = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.96 },
  transition: { duration: DURATION.base, ease: EASE_SNAP },
} as const
