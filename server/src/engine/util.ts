import { randomUUID } from 'node:crypto'
import type { GameState, LogEntry, LogParams } from '@tuan-tanah/shared'
import { renderLogEn } from './messages.js'

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

function appendLog(state: GameState, entry: LogEntry): void {
  state.log.push(entry)
  // Keep the log bounded.
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200)
}

/**
 * Append a plain-text log entry (mutates state.log in place). Prefer `logKey` for
 * player-visible messages so the client can localize them; this stays for the few
 * non-localized lines (e.g. dev/debug).
 */
export function pushLog(state: GameState, message: string, playerId?: string): void {
  appendLog(state, { id: uid(), round: state.round, message, playerId })
}

/**
 * Append a structured, localizable log entry. `code` indexes the bilingual
 * message tables; `message` is rendered to English here as the fallback the
 * client re-localizes from `code` + `params`.
 */
export function logKey(
  state: GameState,
  code: string,
  params?: LogParams,
  playerId?: string,
): void {
  appendLog(state, {
    id: uid(),
    round: state.round,
    code,
    params,
    message: renderLogEn(code, params),
    playerId,
  })
}
