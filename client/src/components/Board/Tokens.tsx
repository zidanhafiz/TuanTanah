import { JAIL_GO_TILE_ID, JAIL_TILE_ID, type GameState, type Player } from '@tuan-tanah/shared'
import { motion, useAnimationControls } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { onResync } from '../../lib/resync.js'
import { useGame } from '../../store/gameStore.js'
import { isRollAnimStuck, useRollAnim } from '../../store/rollAnimation.js'
import { tileCenter, tokenOffset } from './geometry.js'

const STEP_SEC = 0.13 // per-tile hop duration
const JAIL_BEAT_MS = 180 // beat on the go-to-jail corner before being hauled to the cell

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Absolute overlay of player tokens above the board grid. Tokens animate
 * step-by-step through each intermediate tile on a dice walk (not a teleport),
 * and do a lift-and-drop when moved by a card/jail/transport.
 */
export function TokenLayer({ state }: { state: GameState }) {
  const total = state.players.length
  const current = state.players[state.currentPlayerIndex]
  const myId = useGame((s) => s.playerId)
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
            isMe={myId === p.id}
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
  isMe,
}: {
  player: Player
  seatIndex: number
  totalSeats: number
  expectedSteps: number
  isRoller: boolean
  isMe: boolean
}) {
  const move = useAnimationControls()
  const bob = useAnimationControls()
  const prevPos = useRef(player.position)
  const prevInJail = useRef(player.inJail)
  // Cancel handle for the in-flight walk/teleport, held in a ref so the
  // visibility reconcile (below) can abort a journey frozen by tab-backgrounding.
  const runRef = useRef<{ cancelled: boolean } | null>(null)
  const off = tokenOffset(seatIndex, totalSeats)
  const phase = useRollAnim((s) => s.phase)

  const coord = (id: number) => {
    const c = tileCenter(id)
    return { left: `${c.left + off.dx}%`, top: `${c.top + off.dy}%` }
  }

  useEffect(() => {
    const from = prevPos.current
    const to = player.position
    const wasInJail = prevInJail.current
    // Jailed this transition: wasn't jailed, now jailed and sitting on the cell.
    // (Covers every path — landing on the corner, korupsi, a card.)
    const enteringJail = !wasInJail && player.inJail && to === JAIL_TILE_ID
    if (from === to && !enteringJail) {
      prevInJail.current = player.inJail
      return
    }

    const d = (to - from + 40) % 40
    const isWalk = !enteringJail && isRoller && d === expectedSteps && d > 0 && d <= 12
    // A dice roll that lands on the go-to-jail corner walks there first, then gets
    // hauled to the cell; any other jail trigger just yanks straight from here.
    const natural = isRoller && expectedSteps > 0 ? (from + expectedSteps) % 40 : -1
    const jailVia = enteringJail && natural === JAIL_GO_TILE_ID ? JAIL_GO_TILE_ID : null

    // Hold the roller's move until the dice have tumbled AND the post-roll beat
    // has elapsed (the `settle` pause), so the token only sets off once players
    // have read the roll. Walk, teleport, or jail trip, the roller waits for `move`.
    // Commit prevPos only once we actually start animating, so the held effect
    // re-runs (phase is in the dep list) and still sees from→to once it advances.
    if (isRoller && (phase === 'dice' || phase === 'settle')) return
    prevPos.current = to
    prevInJail.current = player.inJail

    const journey = { cancelled: false }
    runRef.current = journey

    // Hop through each intermediate tile from `from` to `target` (forward only).
    const walkTo = async (target: number) => {
      const steps = (target - from + 40) % 40
      for (let s = 1; s <= steps; s++) {
        if (journey.cancelled) return
        const id = (from + s) % 40
        void bob.start({
          y: [0, -9, 0],
          scale: [1, 1.12, 1],
          transition: { duration: STEP_SEC, ease: 'easeOut' },
        })
        await move.start({ ...coord(id), transition: { duration: STEP_SEC, ease: 'linear' } })
      }
    }

    // Haul the pawn off to the cell: yank up, fling across (accelerating, with a
    // little tumble), then land with a squash. Shared by every way into jail.
    const pullToJail = async () => {
      await bob.start({ scale: 1.35, y: -4, transition: { duration: 0.12, ease: 'easeOut' } })
      if (journey.cancelled) return
      void bob.start({
        rotate: [0, -14, 6, 0],
        scale: [1.35, 0.9, 1],
        transition: { duration: 0.42, ease: 'easeIn' },
      })
      await move.start({ ...coord(JAIL_TILE_ID), transition: { duration: 0.42, ease: 'easeIn' } })
      if (journey.cancelled) return
      await bob.start({ scale: [1.12, 1], y: 0, transition: { duration: 0.12, ease: 'easeOut' } })
    }

    const run = async () => {
      if (enteringJail) {
        // Step onto the go-to-jail corner first (dice landing), beat, then get pulled.
        if (jailVia != null) {
          await walkTo(jailVia)
          if (journey.cancelled) return
          await bob.start({ scale: [1, 1.2, 1], transition: { duration: 0.16, ease: 'easeOut' } })
          await wait(JAIL_BEAT_MS)
          if (journey.cancelled) return
        }
        await pullToJail()
      } else if (isWalk) {
        await walkTo(to)
        if (!journey.cancelled) {
          void bob.start({ scale: [1, 1.25, 1], transition: { duration: 0.18, ease: 'easeOut' } })
        }
      } else {
        // Teleport: lift, slide, drop.
        await bob.start({ scale: 1.35, transition: { duration: 0.12 } })
        if (journey.cancelled) return
        await move.start({ ...coord(to), transition: { duration: 0.28, ease: 'easeInOut' } })
        if (journey.cancelled) return
        await bob.start({ scale: 1, transition: { duration: 0.12 } })
      }
    }
    void run()
    return () => {
      journey.cancelled = true
    }
    // Re-runs on position change, jail state, and cinematic phase change (so a held
    // walk resumes when the dice settle). expectedSteps/isRoller are read fresh on
    // each run and intentionally not in the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.position, player.inJail, phase])

  // Backgrounding a tab pauses requestAnimationFrame and throttles timers, so a
  // walk in flight freezes mid-board and Framer never reliably resumes it — the
  // token is left stranded until a reload. On return (or, as a fallback, a click
  // when the cinematic looks stuck), abort the frozen journey and snap this token
  // straight to its authoritative position (what a reload does), then reset the
  // resting transforms. The store also requests a fresh state broadcast; this snap
  // is what moves the token's imperative controls, since a same-position resync
  // won't re-run the walk effect below. Skip a plain click during a healthy
  // animation so it isn't cut short.
  useEffect(() => {
    return onResync((viaInteraction) => {
      if (viaInteraction && !isRollAnimStuck()) return
      if (runRef.current) runRef.current.cancelled = true
      move.set(coord(player.position))
      bob.set({ x: 0, y: 0, scale: 1, rotate: 0 })
      prevPos.current = player.position
      prevInJail.current = player.inJail
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.position, player.inJail, seatIndex, totalSeats])

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-[85%]"
      style={{ zIndex: isMe ? 2 : isRoller ? 1 : 0 }}
      initial={coord(player.position)}
      animate={move}
    >
      {/* Soft locating halo centered on the local player's pawn feet — a gently
          pulsing, blurred glow in their color so they can always spot where they
          are. The pulse (scale) lives on the inner element; centering stays on the
          static wrapper so Framer's transform can't clobber the -translate. */}
      {isMe && (
        <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <motion.span
            className="block h-[1.2cqw] w-[3.6cqw] rounded-[50%] blur-[0.3cqw]"
            style={{ background: player.color }}
            animate={{ opacity: [0.45, 0.75, 0.45], scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
      )}
      {/* Ground shadow at the pawn's feet — stays put while the pawn hops. */}
      {isRoller && (
        <span className="absolute bottom-0 left-1/2 h-[0.6cqw] w-[3.2cqw] -translate-x-1/2 translate-y-1/2 rounded-[50%] bg-ink/25" />
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
      viewBox="0 0 24 30"
      className="block h-[3.5cqw] w-[2.8cqw]"
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
