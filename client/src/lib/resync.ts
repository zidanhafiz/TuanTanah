const RESYNC_THROTTLE_MS = 1000

/**
 * Run `cb` whenever the page should re-sync with the authoritative server state:
 *  - the tab becomes visible again (`visibilitychange`) or the window regains
 *    focus (`focus`) — `cb(false)`, a "reactivation";
 *  - the user interacts with the page (`pointerdown`) — `cb(true)`. This is a
 *    fallback for environments where focus/visibility events don't fire reliably
 *    (e.g. some WSL/remote setups), so a click can still recover a stalled UI.
 *
 * Throttled so rapid input fires `cb` at most once per RESYNC_THROTTLE_MS.
 * Returns an unsubscribe fn. `cb` may fire repeatedly — keep it idempotent. The
 * `viaInteraction` arg lets callers gate disruptive recovery (resetting an
 * animation) to true reactivations or a genuinely stuck state.
 */
export function onResync(cb: (viaInteraction: boolean) => void): () => void {
  let last = 0
  const fire = (viaInteraction: boolean) => {
    const now = Date.now()
    if (now - last < RESYNC_THROTTLE_MS) return
    last = now
    cb(viaInteraction)
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') fire(false)
  }
  const onFocus = () => fire(false)
  const onPointer = () => fire(true)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onFocus)
  window.addEventListener('pointerdown', onPointer)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('pointerdown', onPointer)
  }
}
