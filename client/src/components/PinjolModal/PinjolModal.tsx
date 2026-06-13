import {
  BOARD,
  PINJOL_AMOUNTS,
  PINJOL_BORROW_LIMIT_MULTIPLE,
  PINJOL_MAX_LOANS,
  REGIONS,
  type GameState,
  type Player,
  type RupiahAmount,
} from '@tuan-tanah/shared'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { formatRupiah, useGame } from '../../store/gameStore.js'

const BANK = 'bank'

/** Total buy-price value of the tiles a player owns (mirrors the engine). */
function propertyValue(state: GameState, player: Player): RupiahAmount {
  let total = 0
  for (const tile of state.tiles) {
    if (tile.ownerId !== player.id) continue
    const region = BOARD[tile.id]?.region
    if (region) total += REGIONS[region].buyPrice
  }
  return total
}

export function PinjolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const takePinjol = useGame((s) => s.takePinjol)
  const [amount, setAmount] = useState<RupiahAmount>(PINJOL_AMOUNTS[0]!)
  const [lender, setLender] = useState<string>(BANK)

  if (!open || !state || !me) return null

  const outstanding = me.loans.reduce((sum, l) => sum + l.amount, 0)
  const limit = PINJOL_BORROW_LIMIT_MULTIPLE * propertyValue(state, me)
  const maxLoansReached = me.loans.length >= PINJOL_MAX_LOANS
  const rentenirs = state.players.filter(
    (p) => p.id !== me.id && p.role === 'rentenir' && !p.isEliminated,
  )

  const overLimit = (amt: RupiahAmount) => outstanding + amt > limit
  const lenderShort =
    lender !== BANK && (rentenirs.find((r) => r.id === lender)?.cash ?? 0) < amount
  const canBorrow = !maxLoansReached && !overLimit(amount) && !lenderShort

  const borrow = () => {
    takePinjol(amount, lender === BANK ? undefined : lender)
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="w-80 rounded-2xl bg-slate-800 p-5 text-white shadow-2xl"
        >
          <div className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            🏦 Pinjol
          </div>
          <div className="mt-1 text-lg font-bold">Take a loan</div>
          <div className="mt-1 text-xs text-slate-400">
            10% interest/round · max {PINJOL_MAX_LOANS} loans · borrow up to {formatRupiah(limit)}
          </div>

          {/* Loan size */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {PINJOL_AMOUNTS.map((amt) => {
              const disabled = maxLoansReached || overLimit(amt)
              return (
                <button
                  key={amt}
                  disabled={disabled}
                  onClick={() => setAmount(amt)}
                  className={`rounded-lg py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    amount === amt
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {formatRupiah(amt)}
                </button>
              )
            })}
          </div>

          {/* Lender */}
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Lender
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              onClick={() => setLender(BANK)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                lender === BANK ? 'bg-sky-500 text-white' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              Bank
            </button>
            {rentenirs.map((r) => (
              <button
                key={r.id}
                disabled={r.cash < amount}
                onClick={() => setLender(r.id)}
                title={r.cash < amount ? 'Not enough cash to lend' : undefined}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                  lender === r.id ? 'bg-sky-500 text-white' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {r.name} 🤝
              </button>
            ))}
          </div>

          {/* Current loans */}
          {me.loans.length > 0 && (
            <div className="mt-4 rounded-lg bg-slate-900/60 p-2 text-xs text-slate-300">
              {me.loans.length} active loan(s) · {formatRupiah(outstanding)} owed
            </div>
          )}

          <button
            onClick={borrow}
            disabled={!canBorrow}
            className="mt-4 w-full rounded-lg bg-amber-500 py-2.5 font-bold text-slate-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {maxLoansReached
              ? 'Max loans reached'
              : overLimit(amount)
                ? 'Over borrow limit'
                : lenderShort
                  ? 'Lender short on cash'
                  : `Borrow ${formatRupiah(amount)}`}
          </button>
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
