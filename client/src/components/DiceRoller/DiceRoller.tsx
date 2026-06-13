import type { GameState } from '@tuan-tanah/shared'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRollAnim } from '../../store/rollAnimation.js'

// Filled pip indices (0–8, row-major) for each die face.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

// Tumble cadence. The cinematic's `dice` phase lasts ~9 ticks (see DICE_MS in
// store/rollAnimation.ts); the phase change is what settles the dice, not a
// local tick count.
const TICK_MS = 65

const rnd = (): number => 1 + Math.floor(Math.random() * 6)

/**
 * Two dice that tumble through random faces while the cinematic is in its `dice`
 * phase, then settle on the authoritative roll. The phase is driven centrally
 * (see store/rollAnimation.ts) so the dice finish tumbling *before* the token
 * starts walking.
 */
export function DiceRoller({ state }: { state: GameState }) {
  const phase = useRollAnim((s) => s.phase)
  const finalDice = state.turn.lastDice
  const rolling = phase === 'dice'
  const [tumble, setTumble] = useState<[number, number]>([1, 1])

  useEffect(() => {
    if (phase !== 'dice') return
    const iv = setInterval(() => setTumble([rnd(), rnd()]), TICK_MS)
    return () => clearInterval(iv)
  }, [phase])

  // While rolling, show the tumbling faces; otherwise the authoritative roll.
  const faces = rolling ? tumble : finalDice
  if (!faces) return null
  return (
    <div className="flex gap-2">
      <DieFace value={faces[0]} rolling={rolling} />
      <DieFace value={faces[1]} rolling={rolling} />
    </div>
  )
}

function DieFace({ value, rolling }: { value: number; rolling: boolean }) {
  const lit = PIPS[value] ?? []
  return (
    <motion.div
      animate={
        rolling ? { rotate: [0, -18, 18, 0], y: [0, -5, 0] } : { rotate: 0, scale: [1.25, 1] }
      }
      transition={
        rolling
          ? { duration: 0.26, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }
      }
      className="grid h-12 w-12 grid-cols-3 grid-rows-3 gap-0.5 rounded-lg border-2 border-ink bg-surface p-1.5 shadow-brutal-sm"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`rounded-full ${lit.includes(i) ? 'bg-ink' : 'bg-transparent'}`} />
      ))}
    </motion.div>
  )
}
