import { useTranslation } from 'react-i18next'
import { useSoundSettings } from '@/sound/index.js'

/**
 * Per-player mute toggle. Mirrors LanguageSwitcher's styling and persistence
 * model (choice is sticky via localStorage in `useSoundSettings`).
 */
export function SoundToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const muted = useSoundSettings((s) => s.muted)
  const toggleMuted = useSoundSettings((s) => s.toggleMuted)

  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-pressed={muted}
      aria-label={muted ? t('sound.unmute') : t('sound.mute')}
      title={muted ? t('sound.unmute') : t('sound.mute')}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink text-sm shadow-brutal-sm transition ${
        muted ? 'bg-surface-sunken text-ink-muted' : 'bg-accent text-ink'
      } ${className ?? ''}`}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
