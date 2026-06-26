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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Modal } from '@/components/ui/index.js'
import { formatRupiah, useGame } from '@/store/gameStore.js'

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
  const { t } = useTranslation()
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
    <Modal open={open} onClose={onClose} title={t('pinjol.title')} size="sm">
      <div className="text-xs text-ink-muted">
        {t('pinjol.terms', { maxLoans: PINJOL_MAX_LOANS, limit: formatRupiah(limit) })}
      </div>

      {/* Loan size */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {PINJOL_AMOUNTS.map((amt) => {
          const disabled = maxLoansReached || overLimit(amt)
          return (
            <Button
              key={amt}
              size="sm"
              variant={amount === amt ? 'primary' : 'secondary'}
              disabled={disabled}
              onClick={() => setAmount(amt)}
            >
              {formatRupiah(amt)}
            </Button>
          )
        })}
      </div>

      {/* Lender */}
      <div className="mt-4 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
        {t('pinjol.lender')}
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={lender === BANK ? 'info' : 'secondary'}
          onClick={() => setLender(BANK)}
        >
          {t('pinjol.bank')}
        </Button>
        {rentenirs.map((r) => (
          <Button
            key={r.id}
            size="sm"
            variant={lender === r.id ? 'info' : 'secondary'}
            disabled={r.cash < amount}
            title={r.cash < amount ? t('pinjol.notEnoughToLend') : undefined}
            onClick={() => setLender(r.id)}
          >
            {r.name} 🤝
          </Button>
        ))}
      </div>

      {/* Current loans */}
      {me.loans.length > 0 && (
        <Card flat tone="sunken" className="mt-4 p-2 text-xs text-ink-muted">
          {t('pinjol.activeLoans', { count: me.loans.length, owed: formatRupiah(outstanding) })}
        </Card>
      )}

      <Button block className="mt-4" disabled={!canBorrow} onClick={borrow}>
        {maxLoansReached
          ? t('pinjol.maxLoansReached')
          : overLimit(amount)
            ? t('pinjol.overBorrowLimit')
            : lenderShort
              ? t('pinjol.lenderShort')
              : t('pinjol.borrow', { amount: formatRupiah(amount) })}
      </Button>
      <Button block variant="ghost" size="sm" className="mt-2" onClick={onClose}>
        {t('pinjol.cancel')}
      </Button>
    </Modal>
  )
}
