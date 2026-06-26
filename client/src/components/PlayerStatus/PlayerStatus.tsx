import type { TileId } from '@tuan-tanah/shared'
import { useTranslation } from 'react-i18next'
import { tierName, tileName } from '@/i18n/gameData.js'
import { formatRupiah, useGame } from '@/store/gameStore.js'
import { MoneyDelta } from '../ui/MoneyDelta.js'
import { Badge, Button, Card } from '../ui/index.js'

/**
 * "Me" side panel: the player's own cash, owned properties (click to open the
 * property dialog and act on them without hunting for the tile on the board),
 * and pinjol status with a one-tap repay. Reads `me` from the store directly.
 */
export function PlayerStatus({
  onOpenProperty,
  bare = false,
}: {
  onOpenProperty: (tileId: TileId) => void
  /** Render the inner content without the framed Card wrapper (for embedding). */
  bare?: boolean
}) {
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

  const nameOf = (id?: string) =>
    state.players.find((p) => p.id === id)?.name ?? t('negotiation.someone')

  // Active negotiation effects this player is party to (immunity / revenue share).
  const myDeals = state.activeEffects.filter(
    (e) =>
      (e.type === 'rent_immunity' && (e.targetPlayerId === me.id || e.ownerId === me.id)) ||
      (e.type === 'revenue_share' &&
        (e.targetPlayerId === me.id || e.beneficiaryPlayerId === me.id)),
  )
  // Loans where I'm the lender (money owed to me).
  const owedToMe = state.players.flatMap((p) =>
    p.loans.filter((l) => l.lenderId === me.id).map((loan) => ({ loan, borrower: p })),
  )
  // Pending deals I sent or received, awaiting a response.
  const myPending = state.pendingDeals.filter(
    (d) => d.fromPlayerId === me.id || d.toPlayerId === me.id,
  )

  const describeEffect = (e: (typeof myDeals)[number]): string => {
    if (e.type === 'rent_immunity') {
      const laps = e.lapsRemaining ?? 0
      return e.targetPlayerId === me.id
        ? t('status.immuneSelf', { name: nameOf(e.ownerId), laps })
        : t('status.immuneGranted', { name: nameOf(e.targetPlayerId), laps })
    }
    // revenue_share
    const percent = Math.round((e.multiplier ?? 0) * 100)
    const laps = e.lapsRemaining ?? 0
    return e.targetPlayerId === me.id
      ? t('status.shareOut', { name: nameOf(e.beneficiaryPlayerId), percent, laps })
      : t('status.shareIn', { name: nameOf(e.targetPlayerId), percent, laps })
  }

  const body = (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase text-ink-muted">{t('status.title')}</h2>
        <span className="relative font-mono text-sm font-bold text-success-strong">
          {formatRupiah(me.cash)}
          <MoneyDelta cash={me.cash} />
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

      {/* Loans owed to me (I'm the lender) */}
      {owedToMe.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            {t('status.owedToMe')}
          </div>
          <ul className="space-y-1">
            {owedToMe.map(({ loan, borrower }) => (
              <li
                key={loan.id}
                className="rounded-lg border-2 border-ink bg-surface-sunken px-2 py-1.5 text-[11px]"
              >
                <div className="font-semibold text-ink">{formatRupiah(loan.amount)}</div>
                <div className="text-ink-muted">
                  {t('status.owedMeta', {
                    name: borrower.name,
                    perLap: formatRupiah(loan.interestPerLap),
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active negotiations (immunity / revenue share) */}
      {myDeals.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            {t('status.activeDeals')}
          </div>
          <ul className="space-y-1">
            {myDeals.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border-2 border-ink bg-surface-sunken px-2 py-1.5 text-[11px] text-ink"
              >
                {describeEffect(e)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pending deals I sent or received */}
      {myPending.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            {t('status.pendingDeals')}
          </div>
          <ul className="space-y-1">
            {myPending.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border-2 border-ink bg-surface-sunken px-2 py-1.5 text-[11px] text-ink"
              >
                {t(d.fromPlayerId === me.id ? 'status.dealSent' : 'status.dealReceived', {
                  type: t(`negotiation.dealTypes.${d.type}`),
                  name: nameOf(d.fromPlayerId === me.id ? d.toPlayerId : d.fromPlayerId),
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )

  if (bare) return <div className="space-y-3">{body}</div>
  return <Card className="space-y-3 p-3">{body}</Card>
}
