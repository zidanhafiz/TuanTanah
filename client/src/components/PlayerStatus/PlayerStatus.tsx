import type { TileId } from '@tuan-tanah/shared'
import { useTranslation } from 'react-i18next'
import { tierName, tileName } from '../../i18n/gameData.js'
import { formatRupiah, useGame } from '../../store/gameStore.js'
import { Badge, Button, Card } from '../ui/index.js'

/**
 * "Me" side panel: the player's own cash, owned properties (click to open the
 * property dialog and act on them without hunting for the tile on the board),
 * and pinjol status with a one-tap repay. Reads `me` from the store directly.
 */
export function PlayerStatus({ onOpenProperty }: { onOpenProperty: (tileId: TileId) => void }) {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const isMyTurn = useGame((s) => s.isMyTurn)()
  const repayPinjol = useGame((s) => s.repayPinjol)

  if (!state || !me) return null

  const myTiles = state.tiles.filter((tile) => tile.ownerId === me.id)
  const totalOwed = me.loans.reduce((sum, l) => sum + l.amount, 0)
  const canRepayAll = isMyTurn && me.cash >= totalOwed && me.loans.length > 0

  const lenderName = (lenderId: string | null) =>
    lenderId
      ? (state.players.find((p) => p.id === lenderId)?.name ?? t('status.bank'))
      : t('status.bank')

  return (
    <Card className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase text-ink-muted">{t('status.title')}</h2>
        <span className="font-mono text-sm font-bold text-success-strong">
          {formatRupiah(me.cash)}
        </span>
      </div>

      {/* Owned properties */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
          {t('status.myProperties')}
        </div>
        {myTiles.length === 0 ? (
          <div className="text-xs text-ink-faint">{t('status.noProperties')}</div>
        ) : (
          <ul className="space-y-1">
            {myTiles.map((tile) => (
              <li key={tile.id}>
                <button
                  onClick={() => onOpenProperty(tile.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border-2 border-ink bg-surface px-2 py-1.5 text-left text-xs shadow-brutal-sm hover:bg-surface-sunken"
                >
                  <span className="truncate font-semibold text-ink">{tileName(t, tile.id)}</span>
                  {tile.tier >= 1 && tile.track ? (
                    <Badge tone="accent">{tierName(t, tile.track, tile.tier)}</Badge>
                  ) : (
                    <span className="text-ink-faint">{t('status.unbuilt')}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Loans */}
      {me.loans.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            {t('status.myLoans')}
          </div>
          <ul className="space-y-1">
            {me.loans.map((loan) => (
              <li
                key={loan.id}
                className="flex items-center justify-between gap-2 rounded-lg border-2 border-ink bg-surface-sunken px-2 py-1.5 text-[11px]"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{formatRupiah(loan.amount)}</div>
                  <div className="text-ink-muted">
                    {t('status.loanMeta', {
                      lender: lenderName(loan.lenderId),
                      perLap: formatRupiah(loan.interestPerLap),
                      paid: formatRupiah(loan.interestPaid),
                    })}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!isMyTurn || me.cash < loan.amount}
                  onClick={() => repayPinjol(loan.id)}
                >
                  {t('status.repay')}
                </Button>
              </li>
            ))}
          </ul>
          <Button
            block
            size="sm"
            variant="danger"
            className="mt-2"
            disabled={!canRepayAll}
            onClick={() => repayPinjol()}
          >
            {t('status.payOffAll', { amount: formatRupiah(totalOwed) })}
          </Button>
        </div>
      )}
    </Card>
  )
}
