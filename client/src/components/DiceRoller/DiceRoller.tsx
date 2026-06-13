import type { GameState } from '@tuan-tanah/shared'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

// Filled pip indices (0–8, row-major) for each die face.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

const TUMBLE_TICKS = 9
const TICK_MS = 65

/**
 * Two dice that tumble through random faces before settling on the authoritative
 * roll. Detects a new roll by signature (player + position + dice), so it fires
 * only on an actual dice roll — not on buys, upgrades, or turn passes.
 */
export function DiceRoller({ state }: { state: GameState }) {
  const dice = state.turn.lastDice
  const pos = state.players[state.currentPlayerIndex]?.position
  const sig = `${state.round}:${state.currentPlayerIndex}:${pos}:${dice?.join('-') ?? 'none'}`

  const [faces, setFaces] = useState<[number, number] | null>(dice)
  const [rolling, setRolling] = useState(false)
  const prevSig = useRef<string | null>(null)

  useEffect(() => {
    if (prevSig.current === null) {
      // First mount — show whatever's already there without tumbling.
      prevSig.current = sig
      setFaces(dice)
      return
    }
    if (sig === prevSig.current) return
    prevSig.current = sig

    if (!dice) {
      setFaces(null)
      setRolling(false)
      return
    }

    setRolling(true)
    let ticks = 0
    const iv = setInterval(() => {
      ticks += 1
      if (ticks >= TUMBLE_TICKS) {
        clearInterval(iv)
        setFaces(dice)
        setRolling(false)
      } else {
        setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)])
      }
    }, TICK_MS)
    return () => clearInterval(iv)
  }, [sig, dice])

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
      className="grid h-10 w-10 grid-cols-3 grid-rows-3 gap-0.5 rounded-lg border-2 border-ink bg-surface p-1.5 shadow-brutal-sm"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`rounded-full ${lit.includes(i) ? 'bg-ink' : 'bg-transparent'}`} />
      ))}
    </motion.div>
  )
}
