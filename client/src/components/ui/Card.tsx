import type { HTMLAttributes } from 'react'

type Tone = 'surface' | 'sunken' | 'accent' | 'info' | 'danger' | 'success'

const TONE: Record<Tone, string> = {
  surface: 'bg-surface',
  sunken: 'bg-surface-sunken',
  accent: 'bg-accent-soft',
  info: 'bg-info-soft',
  danger: 'bg-danger-soft',
  success: 'bg-success-soft',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone
  /** Smaller shadow for nested/secondary surfaces. */
  flat?: boolean
}

/** A framed surface — the brutalist replacement for the old `rounded-xl bg-slate-800/60` panels. */
export function Card({ tone = 'surface', flat, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl ${flat ? 'brutal-sm' : 'brutal'} ${TONE[tone]} ${className}`}
      {...props}
    />
  )
}
