import { useEffect, useState } from 'react'

/**
 * A wall-clock value that re-renders on a fixed interval. Used to drive
 * client-side countdowns/elapsed timers (the game clock, the AFK countdown)
 * off `Date.now()` without the server having to push a tick every second.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
