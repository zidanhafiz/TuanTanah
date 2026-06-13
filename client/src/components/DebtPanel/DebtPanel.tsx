import { type PendingDebt } from '@tuan-tanah/shared'
import { useState } from 'react'
import { formatRupiah, useGame } from '../../store/gameStore.js'
import { Button, Card } from '../ui/index.js'

/**
 * Shown in place of the turn controls when the current player owes an unpayable
 * charge. The debt settles automatically once they raise enough cash (selling a
 * property via the board, or taking a pinjol); "give up" declares bankruptcy.
 */
export function DebtPanel({ debt, onTakePinjol }: { debt: PendingDebt; onTakePinjol: () => void }) {
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
        ⚠️ Debt due
      </div>
      <div className="text-sm text-ink">
        You owe <span className="font-bold text-danger-strong">{formatRupiah(debt.amount)}</span>{' '}
        <span className="text-ink-muted">({debt.reason})</span>
        {creditor ? ` to ${creditor.name}` : ''}.
      </div>
      <div className="text-xs text-ink-muted">
        Cash {formatRupiah(me.cash)} · short {formatRupiah(shortfall)}
      </div>
      <div className="text-[11px] text-ink-muted">
        Raise the cash and it settles automatically — click one of your properties on the board to
        sell it, or take a pinjol.
      </div>
      <Button block size="sm" onClick={onTakePinjol}>
        🏦 Take a pinjol
      </Button>
      {confirmingGiveUp ? (
        <div className="space-y-2">
          <Card flat tone="danger" className="px-3 py-2 text-center text-xs text-ink">
            Give up and be eliminated? Your properties return to the bank.
          </Card>
          <Button block size="sm" variant="danger" onClick={() => resolveDebt(true)}>
            Confirm — declare bankruptcy
          </Button>
          <Button block size="sm" variant="ghost" onClick={() => setConfirmingGiveUp(false)}>
            Keep playing
          </Button>
        </div>
      ) : (
        <Button block size="sm" variant="secondary" onClick={() => setConfirmingGiveUp(true)}>
          Give up (declare bankruptcy)
        </Button>
      )}
    </Card>
  )
}
