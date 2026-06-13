import type { CSSProperties, HTMLAttributes } from 'react'

type Tone = 'neutral' | 'accent' | 'info' | 'danger' | 'success'

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface text-ink',
  accent: 'bg-accent text-ink',
  info: 'bg-info text-ink',
  danger: 'bg-danger text-ink',
  success: 'bg-success text-ink',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  /** Override fill with an arbitrary color (e.g. a player's color). */
  color?: string
}

/** Small framed pill — owner chips, tier markers, role/status tags. */
export function Badge({ tone = 'neutral', color, className = '', style, ...props }: BadgeProps) {
  const colorStyle: CSSProperties | undefined = color
    ? { background: color, color: '#fff', ...style }
    : style
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border-2 border-ink px-1.5 py-0.5 text-[11px] font-bold leading-none ${color ? '' : TONE[tone]} ${className}`}
      style={colorStyle}
      {...props}
    />
  )
}
