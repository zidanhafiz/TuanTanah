import { useEffect } from 'react'
import { useGame } from '../store/gameStore.js'
import { Toast } from './ui/index.js'

export function ErrorToast() {
  const error = useGame((s) => s.error)
  const clearError = useGame((s) => s.clearError)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 3500)
    return () => clearTimeout(t)
  }, [error, clearError])

  return (
    <Toast show={Boolean(error)} tone="error" onDismiss={clearError}>
      {error}
    </Toast>
  )
}
