import { randomUUID } from 'node:crypto'
import type { GameState, LogEntry } from '@tuan-tanah/shared'

export type Rng = () => number

export const defaultRng: Rng = Math.random

export function uid(): string {
  return randomUUID()
}

/** Fisher–Yates shuffle (pure — returns a new array). */
export function shuffle<T>(arr: readonly T[], rng: Rng = defaultRng): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Append a log entry (mutates state.log in place). */
export function pushLog(state: GameState, message: string, playerId?: string): void {
  const entry: LogEntry = {
    id: uid(),
    round: state.round,
    message,
    playerId,
  }
  state.log.push(entry)
  // Keep the log bounded.
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200)
}
