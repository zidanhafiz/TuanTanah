import type { GameState } from '@tuan-tanah/shared'
import { create } from 'zustand'

/**
 * Cinematic phase machine for a dice roll. The server broadcasts the dice, the
 * new token position, and any pending buy in a *single* `game_state` event, so
 * without sequencing all three would animate at once. This drives the order:
 *
 *   dice (tumble) → move (token walks) → done (post-roll actions reveal)
 *
 * `idle` is the resting state between turns. Components read `phase` to know
 * what they're allowed to show; the timeline is scheduled in `noteIncomingState`
 * the instant a new state arrives — before React re-renders — so token effects
 * never observe a stale phase.
 */
export type RollPhase = 'idle' | 'dice' | 'move' | 'done'

interface RollAnimState {
  phase: RollPhase
  setPhase: (p: RollPhase) => void
}

export const useRollAnim = create<RollAnimState>((set) => ({
  phase: 'idle',
  setPhase: (phase) => set({ phase }),
}))

/** True while the cinematic should keep post-roll actions (buy/end-turn) hidden. */
export const isRollAnimating = (p: RollPhase): boolean => p === 'dice' || p === 'move'

// Timing — keep in sync with DiceRoller (TUMBLE_TICKS * TICK_MS) and Tokens (STEP_SEC).
const DICE_MS = 9 * 65 // dice tumble duration
const STEP_MS = 130 // per-tile token hop
const TELEPORT_MS = 560 // lift + slide + drop for a card/jail jump
const SETTLE_PAD_MS = 90 // small beat so the action lands just after the token

let prevSig: string | null = null
let prevPos: number | null = null
let timers: ReturnType<typeof setTimeout>[] = []

function clearTimers(): void {
  timers.forEach((t) => clearTimeout(t))
  timers = []
}

/**
 * Inspect a freshly-arrived authoritative state and, if it represents a new dice
 * roll, schedule the dice → move → done timeline. Call this synchronously in the
 * `game_state` socket handler (before `set({ state })`) so `phase` is already
 * correct by the time tokens re-render.
 */
export function noteIncomingState(next: GameState): void {
  const cp = next.players[next.currentPlayerIndex]
  const dice = next.turn.lastDice
  const pos = cp?.position ?? null
  const sig = `${next.round}:${next.currentPlayerIndex}:${dice?.join('-') ?? 'x'}:${next.turn.hasRolled}`

  const from = prevPos
  const firstSeen = prevSig === null
  const changed = sig !== prevSig
  prevSig = sig

  // First state we've seen, or a broadcast that isn't a roll/turn transition
  // (e.g. a buy after rolling) — leave the current phase untouched.
  if (firstSeen || !changed) {
    prevPos = pos
    return
  }

  const setPhase = useRollAnim.getState().setPhase
  clearTimers()

  const isRoll = next.turn.hasRolled && !!dice
  if (!isRoll) {
    // Turn passed to someone / pre-roll state — reset to resting.
    prevPos = pos
    setPhase('idle')
    return
  }

  // How long the token's journey takes, matched to Tokens.tsx so the reveal
  // lands right as it arrives.
  let moveMs = TELEPORT_MS
  if (from != null && pos != null) {
    const d = (pos - from + 40) % 40
    const diceSum = dice![0] + dice![1]
    if (d === 0) moveMs = 0
    else if (d === diceSum && d <= 12) moveMs = d * STEP_MS + 120
  }
  prevPos = pos

  setPhase('dice')
  timers.push(setTimeout(() => setPhase('move'), DICE_MS))
  timers.push(setTimeout(() => setPhase('done'), DICE_MS + moveMs + SETTLE_PAD_MS))
}

/** Reset cinematic state — call when leaving a room. */
export function resetRollAnim(): void {
  clearTimers()
  prevSig = null
  prevPos = null
  useRollAnim.getState().setPhase('idle')
}
