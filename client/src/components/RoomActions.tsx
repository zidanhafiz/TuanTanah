import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../store/gameStore.js'
import { Button } from './ui/index.js'

/** Copies the shareable room link (`/room/CODE`) to the clipboard. */
export function ShareLinkButton({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = `${window.location.origin}/room/${code}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard blocked (insecure context / permissions) — fall back to prompt.
      window.prompt('Copy this room link:', url)
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button variant="secondary" size="sm" onClick={share} className={`text-xs ${className ?? ''}`}>
      {copied ? '✓ Link copied' : '🔗 Share link'}
    </Button>
  )
}

/**
 * Leaves the room/game and returns to home. In-game this is a forfeit, so we
 * confirm first when `confirm` is set.
 */
export function LeaveButton({
  confirm,
  label = 'Leave',
  className,
}: {
  confirm?: string
  label?: string
  className?: string
}) {
  const leave = useGame((s) => s.leave)
  const navigate = useNavigate()

  const onClick = () => {
    if (confirm && !window.confirm(confirm)) return
    leave()
    navigate('/')
  }

  return (
    <Button variant="danger" size="sm" onClick={onClick} className={`text-xs ${className ?? ''}`}>
      {label}
    </Button>
  )
}
