import type { GameState, Player } from '@tuan-tanah/shared'
import { motion, useAnimationControls } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useRollAnim } from '../../store/rollAnimation.js'
import { tileCenter, tokenOffset } from './geometry.js'

const STEP_SEC = 0.13 // per-tile hop duration

/**
 * Absolute overlay of player tokens above the board grid. Tokens animate
 * step-by-step through each intermediate tile on a dice walk (not a teleport),
 * and do a lift-and-drop when moved by a card/jail/transport.
 */
export function TokenLayer({ state }: { state: GameState }) {
  const total = state.players.length
  const current = state.players[state.currentPlayerIndex]
  // Expected forward steps this broadcast = the dice sum, but only when the
  // current player just rolled. Used to tell a walk apart from a teleport.
  const expectedSteps =
    state.turn.hasRolled && state.turn.lastDice
      ? state.turn.lastDice[0] + state.turn.lastDice[1]
      : -1

  return (
    <div className="pointer-events-none absolute inset-[3px] z-panel">
      {state.players.map((p, seatIndex) =>
        p.isEliminated ? null : (
          <PlayerToken
            key={p.id}
            player={p}
            seatIndex={seatIndex}
            totalSeats={total}
            expectedSteps={expectedSteps}
            isRoller={current?.id === p.id}
          />
        ),
      )}
    </div>
  )
}

function PlayerToken({
  player,
  seatIndex,
  totalSeats,
  expectedSteps,
  isRoller,
}: {
  player: Player
  seatIndex: number
  totalSeats: number
  expectedSteps: number
  isRoller: boolean
}) {
  const move = useAnimationControls()
  const bob = useAnimationControls()
  const prevPos = useRef(player.position)
  const off = tokenOffset(seatIndex, totalSeats)
  const phase = useRollAnim((s) => s.phase)

  const coord = (id: number) => {
    const c = tileCenter(id)
    return { left: `${c.left + off.dx}%`, top: `${c.top + off.dy}%` }
  }

  useEffect(() => {
    const from = prevPos.current
    const to = player.position
    if (from === to) return

    const d = (to - from + 40) % 40
    const isWalk = isRoller && d === expectedSteps && d > 0 && d <= 12

    // Hold the roller's dice-walk until the dice have finished tumbling. Commit
    // prevPos only once we actually start animating, so the held effect re-runs
    // (phase is in the dep list) and still sees from→to once it advances to `move`.
    if (isWalk && phase === 'dice') return
    prevPos.current = to

    let cancelled = false

    const run = async () => {
      if (isWalk) {
        // Hop through each intermediate tile in turn.
        for (let s = 1; s <= d; s++) {
          if (cancelled) return
          const id = (from + s) % 40
          void bob.start({
            y: [0, -9, 0],
            scale: [1, 1.12, 1],
            transition: { duration: STEP_SEC, ease: 'easeOut' },
          })
          await move.start({ ...coord(id), transition: { duration: STEP_SEC, ease: 'linear' } })
        }
        if (!cancelled) {
          void bob.start({ scale: [1, 1.25, 1], transition: { duration: 0.18, ease: 'easeOut' } })
        }
      } else {
        // Teleport: lift, slide, drop.
        await bob.start({ scale: 1.35, transition: { duration: 0.12 } })
        if (cancelled) return
        await move.start({ ...coord(to), transition: { duration: 0.28, ease: 'easeInOut' } })
        if (cancelled) return
        await bob.start({ scale: 1, transition: { duration: 0.12 } })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // Re-runs on position change and on cinematic phase change (so a held walk
    // resumes when the dice settle). expectedSteps/isRoller are read fresh on
    // each run and intentionally not in the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.position, phase])

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-[85%]"
      initial={coord(player.position)}
      animate={move}
    >
      {/* Ground shadow pinned at the tile center — stays put while the pawn hops. */}
      {isRoller && (
        <span className="absolute left-1/2 top-[85%] h-[5px] w-6 -translate-x-1/2 rounded-[50%] bg-ink/25" />
      )}
      <motion.div animate={bob} style={{ transformOrigin: 'bottom center' }}>
        <Pawn color={player.color} title={player.name} />
      </motion.div>
    </motion.div>
  )
}

/**
 * A standing game pawn: a head + flared body silhouette filled with the player
 * color, wrapped in the brutalist ink outline and a hard offset drop-shadow
 * (the box-shadow equivalent, but hugging the irregular shape).
 */
function Pawn({ color, title }: { color: string; title: string }) {
  return (
    <svg
      width="19"
      height="24"
      viewBox="0 0 24 30"
      className="block"
      style={{ filter: 'drop-shadow(1.5px 1.5px 0 #1A1714)' }}
    >
      <title>{title}</title>
      <g fill={color} stroke="#1A1714" strokeWidth={2} strokeLinejoin="round">
        {/* Body + flared foot. */}
        <path d="M9 11 C9 14 7 15 7 18 C6 21 4.5 22 4 25 C3.5 26.5 3 27 3 27.5 C3 28.5 4 29 6 29 L18 29 C20 29 21 28.5 21 27.5 C21 27 20.5 26.5 20 25 C19.5 22 18 21 17 18 C17 15 15 14 15 11 Z" />
        {/* Head — sits over the body to read as a collar. */}
        <circle cx="12" cy="6" r="4.8" />
      </g>
    </svg>
  )
}
