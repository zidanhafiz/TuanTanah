import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query and re-render when it flips. Used to switch
 * layout structure (not just visibility) — e.g. surfacing the turn-action
 * controls inside the board on tablet/desktop but keeping them in the sidebar
 * on phones, where the board center is too cramped for them.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
