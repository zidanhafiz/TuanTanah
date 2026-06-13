import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'info' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:bg-accent-strong',
  secondary: 'bg-surface text-ink hover:bg-surface-sunken',
  danger: 'bg-danger text-ink hover:bg-danger-strong hover:text-white',
  success: 'bg-success text-ink hover:bg-success-strong hover:text-white',
  info: 'bg-info text-ink hover:bg-info-strong hover:text-white',
  ghost: 'border-transparent bg-transparent text-ink shadow-none hover:bg-surface-sunken',
}

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5',
  lg: 'px-5 py-3 text-lg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Stretch to fill the container width. */
  block?: boolean
}

/**
 * Brutalist button: thick ink border, hard offset shadow, tactile press.
 * `ghost` opts out of the frame for low-emphasis actions.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className = '', ...props },
  ref,
) {
  const framed = variant !== 'ghost' ? 'brutal brutal-press' : 'brutal-press'
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-bold ${framed} ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-brutal-sm disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:active:translate-x-0 disabled:active:translate-y-0 ${className}`}
      {...props}
    />
  )
})
