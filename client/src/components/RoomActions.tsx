import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../store/gameStore.js'
import { Button, Modal } from './ui/index.js'

/** Copies the shareable room link (`/room/CODE`) to the clipboard. */
export function ShareLinkButton({ code, className }: { code: string; className?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = `${window.location.origin}/room/${code}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard blocked (insecure context / permissions) — fall back to prompt.
      window.prompt(t('roomActions.copyPrompt'), url)
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button variant="secondary" size="sm" onClick={share} className={`text-xs ${className ?? ''}`}>
      {copied ? t('roomActions.linkCopied') : t('roomActions.shareLink')}
    </Button>
  )
}

/**
 * Leaves the room/game and returns to home. In-game this is a forfeit, so we
 * confirm first when `confirm` is set.
 */
export function LeaveButton({
  confirm,
  label,
  className,
}: {
  confirm?: string
  label?: string
  className?: string
}) {
  const { t } = useTranslation()
  const leave = useGame((s) => s.leave)
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  const doLeave = () => {
    leave()
    navigate('/')
  }
  const onClick = () => {
    if (confirm) setConfirming(true)
    else doLeave()
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={onClick} className={`text-xs ${className ?? ''}`}>
        {label ?? t('roomActions.leave')}
      </Button>
      {confirm && (
        <Modal
          open={confirming}
          onClose={() => setConfirming(false)}
          title={t('roomActions.leaveTitle')}
          size="sm"
        >
          <p className="text-sm text-ink">{confirm}</p>
          <div className="mt-5 flex gap-2">
            <Button variant="ghost" size="sm" block onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" size="sm" block onClick={doLeave}>
              {t('roomActions.confirmLeave')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
