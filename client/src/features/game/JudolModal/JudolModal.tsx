import { JUDOL_PRESET_DEPOSITS, type RupiahAmount } from '@tuan-tanah/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Modal } from '@/components/ui/index.js'
import { formatRupiah, useGame } from '@/store/gameStore.js'

const JUTA = 1_000_000
const inputClass =
  'w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 text-sm outline-none transition focus:shadow-brutal-sm'
const labelClass = 'mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-faint'

export function JudolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const me = useGame((s) => s.me)()
  const metaAction = useGame((s) => s.metaAction)
  const [amount, setAmount] = useState<RupiahAmount>(JUDOL_PRESET_DEPOSITS[0]!)

  if (!open || !me) return null

  const tooMuch = amount > me.cash
  const canPlay = amount > 0 && !tooMuch

  const play = () => {
    metaAction('judol', undefined, undefined, amount)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('judol.title')} size="sm">
      <div className="text-xs text-ink-muted">{t('judol.terms')}</div>

      {/* Preset deposits */}
      <div className={labelClass}>{t('judol.deposit')}</div>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {JUDOL_PRESET_DEPOSITS.map((amt) => (
          <Button
            key={amt}
            size="sm"
            variant={amount === amt ? 'primary' : 'secondary'}
            disabled={amt > me.cash}
            onClick={() => setAmount(amt)}
          >
            {formatRupiah(amt)}
          </Button>
        ))}
      </div>

      {/* Custom amount (in juta) */}
      <div className={labelClass}>{t('judol.custom')}</div>
      <input
        type="number"
        min={1}
        value={amount / JUTA}
        onChange={(e) => setAmount(Math.round(Number(e.target.value) * JUTA))}
        className={`mt-1 ${inputClass}`}
      />

      <Card flat tone="sunken" className="mt-4 p-2 text-xs text-ink-muted">
        {formatRupiah(me.cash)}
      </Card>

      <Button block className="mt-4" disabled={!canPlay} onClick={play}>
        {tooMuch
          ? t('judol.notEnoughCash')
          : amount <= 0
            ? t('judol.enterAmount')
            : t('judol.play', { amount: formatRupiah(amount) })}
      </Button>
      <Button block variant="ghost" size="sm" className="mt-2" onClick={onClose}>
        {t('judol.cancel')}
      </Button>
    </Modal>
  )
}
