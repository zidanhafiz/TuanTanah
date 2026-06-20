import { type PendingDebt } from '@tuan-tanah/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatRupiah, useGame } from '../../store/gameStore.js'
import { Button, Card } from '../ui/index.js'

/**
 * Shown in place of the turn controls when the current player owes an unpayable
 * charge. The debt settles automatically once they raise enough cash (selling or
 * downgrading a property via the board, or taking a pinjol); "give up" declares
 * bankruptcy.
 */
export function DebtPanel({ debt, onTakePinjol }: { debt: PendingDebt; onTakePinjol: () => void }) {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const resolveDebt = useGame((s) => s.resolveDebt)
  const [confirmingGiveUp, setConfirmingGiveUp] = useState(false)
  if (!state || !me) return null

  const creditor = debt.creditorId ? state.players.find((p) => p.id === debt.creditorId) : null
  const shortfall = Math.max(0, debt.amount - me.cash)

  return (
    <Card tone="danger" className="space-y-2 p-3">
      <div className="text-xs font-bold uppercase tracking-widest text-danger-strong">
        {t('debt.title')}
      </div>
      <div className="text-sm text-ink">
        {t('debt.owePre')}{' '}
        <span className="font-bold text-danger-strong">{formatRupiah(debt.amount)}</span>{' '}
        <span className="text-ink-muted">({debt.reason})</span>
        {creditor ? t('debt.oweTo', { name: creditor.name }) : ''}.
      </div>
      <div className="text-xs text-ink-muted">
        {t('debt.cashShort', { cash: formatRupiah(me.cash), shortfall: formatRupiah(shortfall) })}
      </div>
      <div className="text-[11px] text-ink-muted">{t('debt.autoSettleHint')}</div>
      <Button block size="sm" onClick={onTakePinjol}>
        {t('debt.takePinjol')}
      </Button>
      {confirmingGiveUp ? (
        <div className="space-y-2">
          <Card flat tone="danger" className="px-3 py-2 text-center text-xs text-ink">
            {t('debt.giveUpConfirm')}
          </Card>
          <Button block size="sm" variant="danger" onClick={() => resolveDebt(true)}>
            {t('debt.confirmBankruptcy')}
          </Button>
          <Button block size="sm" variant="ghost" onClick={() => setConfirmingGiveUp(false)}>
            {t('debt.keepPlaying')}
          </Button>
        </div>
      ) : (
        <Button block size="sm" variant="secondary" onClick={() => setConfirmingGiveUp(true)}>
          {t('debt.giveUp')}
        </Button>
      )}
    </Card>
  )
}
