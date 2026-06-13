import { type PendingDebt } from '@tuan-tanah/shared'
import { useState } from 'react'
import { formatRupiah, useGame } from '../../store/gameStore.js'

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
    <div className="space-y-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
      <div className="text-xs font-semibold uppercase tracking-widest text-rose-300">
        ⚠️ Debt due
      </div>
      <div className="text-sm">
        You owe <span className="font-bold text-rose-200">{formatRupiah(debt.amount)}</span>{' '}
        <span className="text-slate-400">({debt.reason})</span>
        {creditor ? ` to ${creditor.name}` : ''}.
      </div>
      <div className="text-xs text-slate-300">
        Cash {formatRupiah(me.cash)} · short {formatRupiah(shortfall)}
      </div>
      <div className="text-[11px] text-slate-400">
        Raise the cash and it settles automatically — click one of your properties on the board to
        sell it, or take a pinjol.
      </div>
      <button
        onClick={onTakePinjol}
        className="w-full rounded-lg bg-amber-500 py-2 text-sm font-bold text-slate-900 hover:bg-amber-400"
      >
        🏦 Take a pinjol
      </button>
      {confirmingGiveUp ? (
        <div className="space-y-2">
          <div className="rounded-lg bg-rose-600/20 px-3 py-2 text-center text-xs text-rose-200">
            Give up and be eliminated? Your properties return to the bank.
          </div>
          <button
            onClick={() => resolveDebt(true)}
            className="w-full rounded-lg bg-rose-600 py-2 text-sm font-bold hover:bg-rose-500"
          >
            Confirm — declare bankruptcy
          </button>
          <button
            onClick={() => setConfirmingGiveUp(false)}
            className="w-full rounded-lg py-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Keep playing
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmingGiveUp(true)}
          className="w-full rounded-lg bg-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-600"
        >
          Give up (declare bankruptcy)
        </button>
      )}
    </div>
  )
}
