import {
  BOARD,
  PINJOL_AMOUNTS,
  PINJOL_BORROW_LIMIT_MULTIPLE,
  PINJOL_INTEREST_RATE,
  PINJOL_MAX_LOANS,
  REGIONS,
  type GameState,
  type Player,
  type RupiahAmount,
} from '@tuan-tanah/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Modal } from '../ui/index.js'
import { formatRupiah, useGame } from '../../store/gameStore.js'

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

/**
 * Rentenir's once-per-round loanshark power: pick a rival and a loan size and
 * saddle them with a pinjol you fund and collect interest on. Mirrors the engine
 * guards in `forceLoan` so disabled states explain themselves before the emit.
 */
export function ForcePinjolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const forcePinjol = useGame((s) => s.forcePinjol)
  const [amount, setAmount] = useState<RupiahAmount>(PINJOL_AMOUNTS[0]!)
  const [targetId, setTargetId] = useState<string | null>(null)

  if (!open || !state || !me) return null

  const usedThisRound = me.forcedLoanRound === state.round
  const targets = state.players.filter((p) => p.id !== me.id && !p.isEliminated)
  const target = targets.find((p) => p.id === targetId) ?? null

  const outstanding = (p: Player) => p.loans.reduce((sum, l) => sum + l.amount, 0)
  const borrowLimit = (p: Player) => PINJOL_BORROW_LIMIT_MULTIPLE * propertyValue(state, p)
  const atMaxLoans = (p: Player) => p.loans.length >= PINJOL_MAX_LOANS
  const overLimit = (p: Player, amt: RupiahAmount) => outstanding(p) + amt > borrowLimit(p)

  const cannotFund = me.cash < amount
  const targetInvalid = !target || atMaxLoans(target) || overLimit(target, amount)
  const canForce = !usedThisRound && !cannotFund && !targetInvalid

  const force = () => {
    if (!target) return
    forcePinjol(target.id, amount)
    onClose()
  }

  const buttonLabel = usedThisRound
    ? t('forcePinjol.alreadyUsed')
    : !target
      ? t('forcePinjol.pickTarget')
      : atMaxLoans(target)
        ? t('forcePinjol.targetMaxLoans')
        : overLimit(target, amount)
          ? t('forcePinjol.targetOverLimit')
          : cannotFund
            ? t('forcePinjol.cannotFund')
            : t('forcePinjol.force', { name: target.name, amount: formatRupiah(amount) })

  return (
    <Modal open={open} onClose={onClose} title={t('forcePinjol.title')} size="sm">
      <div className="text-xs text-ink-muted">
        {t('forcePinjol.terms', { rate: Math.round(PINJOL_INTEREST_RATE * 100) })}
      </div>

      {/* Target rival */}
      <div className="mt-4 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
        {t('forcePinjol.target')}
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        {targets.map((p) => {
          const disabled = atMaxLoans(p) || overLimit(p, amount)
          return (
            <Button
              key={p.id}
              size="sm"
              variant={targetId === p.id ? 'info' : 'secondary'}
              disabled={disabled}
              title={
                atMaxLoans(p)
                  ? t('forcePinjol.targetMaxLoans')
                  : overLimit(p, amount)
                    ? t('forcePinjol.targetOverLimit')
                    : undefined
              }
              onClick={() => setTargetId(p.id)}
            >
              {p.name}
            </Button>
          )
        })}
      </div>

      {/* Loan size */}
      <div className="mt-4 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
        {t('forcePinjol.loanSize')}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {PINJOL_AMOUNTS.map((amt) => (
          <Button
            key={amt}
            size="sm"
            variant={amount === amt ? 'primary' : 'secondary'}
            disabled={me.cash < amt}
            title={me.cash < amt ? t('forcePinjol.cannotFund') : undefined}
            onClick={() => setAmount(amt)}
          >
            {formatRupiah(amt)}
          </Button>
        ))}
      </div>

      {target && (
        <Card flat tone="sunken" className="mt-4 p-2 text-xs text-ink-muted">
          {t('forcePinjol.targetLoans', {
            name: target.name,
            count: target.loans.length,
            max: PINJOL_MAX_LOANS,
            limit: formatRupiah(borrowLimit(target)),
          })}
        </Card>
      )}

      <Button block className="mt-4" disabled={!canForce} onClick={force}>
        {buttonLabel}
      </Button>
      <Button block variant="ghost" size="sm" className="mt-2" onClick={onClose}>
        {t('forcePinjol.cancel')}
      </Button>
    </Modal>
  )
}
