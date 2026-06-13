import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher.js'
import { SoundToggle } from '../components/SoundToggle.js'
import { Button, Card } from '../components/ui/index.js'
import { useGame } from '../store/gameStore.js'

export function Home() {
  const { t } = useTranslation()
  const join = useGame((s) => s.join)
  const joining = useGame((s) => s.joining)
  const connected = useGame((s) => s.connected)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const canSubmit = name.trim().length > 0 && connected && !joining
  const goToRoom = (roomId: string) => navigate(`/room/${roomId}`)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <SoundToggle />
        <LanguageSwitcher />
      </div>
      <div className="-rotate-1">
        <h1 className="rounded-xl border-2 border-ink bg-accent px-6 py-2 font-display text-5xl uppercase tracking-tight text-ink shadow-brutal-lg">
          {t('home.title')}
        </h1>
      </div>
      <p className="mt-4 font-semibold text-ink-muted">{t('home.subtitle')}</p>

      <Card className="mt-10 w-full max-w-sm space-y-4 p-6">
        <label className="block">
          <span className="text-sm font-bold text-ink">{t('home.yourName')}</span>
          <input
            className="mt-1 w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 font-medium outline-none transition focus:shadow-brutal-sm"
            value={name}
            maxLength={20}
            placeholder={t('home.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <Button block disabled={!canSubmit} onClick={() => join(name, undefined, goToRoom)}>
          {t('home.createRoom')}
        </Button>

        <div className="flex items-center gap-3 text-xs font-bold uppercase text-ink-faint">
          <span className="h-0.5 flex-1 bg-ink/20" /> {t('home.orJoin')}{' '}
          <span className="h-0.5 flex-1 bg-ink/20" />
        </div>

        <div className="flex gap-2">
          <input
            className="w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 font-bold uppercase tracking-widest outline-none transition focus:shadow-brutal-sm"
            value={code}
            maxLength={6}
            placeholder={t('home.roomCodePlaceholder')}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button
            variant="secondary"
            disabled={!canSubmit || code.trim().length < 4}
            onClick={() => join(name, code.trim(), goToRoom)}
            className="shrink-0"
          >
            {t('home.join')}
          </Button>
        </div>
      </Card>

      <p className="mt-6 flex items-center gap-2 text-xs font-bold text-ink-muted">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full border-2 border-ink ${connected ? 'bg-success' : 'bg-danger'}`}
        />
        {connected ? t('connection.connected') : t('connection.connecting')}
      </p>
    </div>
  )
}
