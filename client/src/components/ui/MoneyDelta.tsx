import { useEffect, useRef, useState } from 'react'
import { compactRupiah } from '@/lib/format.js'
import { isRollAnimating, useRollAnim } from '@/store/rollAnimation.js'
import { FloatUp } from './FloatUp.js'

/**
 * Floats a "+Rp …" / "−Rp …" pop above a player's cash whenever it changes, by
 * diffing the latest cash against the previously-rendered value. Shared by the
 * per-player rows (PlayerPanel) and the "me" status panel (PlayerStatus) so the
 * delta reads identically wherever cash is shown. Render inside a `relative`
 * parent; the pop is absolutely positioned against it.
 *
 * While a dice/token cinematic is in flight the diff is held back: cash changes
 * that arrive in the roll broadcast (rent, tax, …) only pop once the token has
 * landed, matching the action buttons and center log. `prev` is left untouched
 * during the move so the delta is measured against the pre-roll balance — any
 * intermediate changes accumulate into the single pop shown on arrival.
 */
export function MoneyDelta({ cash, rise = 18 }: { cash: number; rise?: number }) {
  const animating = useRollAnim((s) => isRollAnimating(s.phase))
  const prev = useRef(cash)
  const counter = useRef(0)
  const [pop, setPop] = useState<{ id: number; delta: number } | null>(null)

  useEffect(() => {
    // Wait for the token to land before revealing the change.
    if (animating) return
    const delta = cash - prev.current
    prev.current = cash
    if (!delta) return
    const id = ++counter.current
    setPop({ id, delta })
    const timer = setTimeout(() => setPop((p) => (p?.id === id ? null : p)), 1100)
    return () => clearTimeout(timer)
  }, [cash, animating])

  return (
    <FloatUp
      id={pop?.id ?? null}
      rise={rise}
      className={`pointer-events-none absolute -top-3.5 right-0 whitespace-nowrap font-mono text-[11px] font-extrabold ${
        pop && pop.delta > 0 ? 'text-success-strong' : 'text-danger-strong'
      }`}
    >
      {pop ? `${pop.delta > 0 ? '+' : '−'}${compactRupiah(Math.abs(pop.delta))}` : null}
    </FloatUp>
  )
}
