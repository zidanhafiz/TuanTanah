import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type Language } from '../i18n/index.js'

/**
 * Per-player language toggle. Writes through i18next (persisted to localStorage
 * by the language detector), so each player's choice is independent and sticky.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const current = (SUPPORTED_LANGUAGES.find((l) => i18n.language.startsWith(l)) ?? 'id') as Language

  return (
    <div
      className={`inline-flex overflow-hidden rounded-lg border-2 border-ink shadow-brutal-sm ${className ?? ''}`}
      role="group"
      aria-label={t('language.label')}
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          onClick={() => void i18n.changeLanguage(lng)}
          className={`px-2.5 py-1 text-xs font-bold uppercase transition ${
            current === lng
              ? 'bg-accent text-ink'
              : 'bg-surface text-ink-muted hover:bg-surface-sunken'
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  )
}
