import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNow } from '@/hooks/useNow.js'
import { tileName } from '@/i18n/gameData.js'
import { formatRupiah, useGame } from '@/store/gameStore.js'
import { Badge, Button, Card, Modal } from '@/components/ui/index.js'

/**
 * Kantor Hukum force-buy auction. Driven entirely by `state.pendingAuction`: the
 * attacker and the tile's owner alternate raising the bid; the highest bid wins.
 * The to-act participant sees a bid form + a concede button; the current high
 * bidder and spectators see a read-only "waiting" view. Clears when the server
 * resolves the auction (concede or timeout).
 */
export function AuctionModal() {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const auctionBid = useGame((s) => s.auctionBid)
  const auctionConcede = useGame((s) => s.auctionConcede)
  const now = useNow(1000)
  const [amount, setAmount] = useState('')

  const auction = state?.pendingAuction
  if (!auction || !state || !me) return null
  const attacker = state.players.find((p) => p.id === auction.attackerId)
  const owner = state.players.find((p) => p.id === auction.ownerId)
  if (!attacker || !owner) return null

  // The to-act participant is always whoever isn't currently winning.
  const toActId = auction.highBidderId === auction.attackerId ? auction.ownerId : auction.attackerId
  const toAct = state.players.find((p) => p.id === toActId)
  const leader = state.players.find((p) => p.id === auction.highBidderId)
  const iAmOwner = me.id === auction.ownerId
  const isMyBid = me.id === toActId

  const minBid = auction.currentBid
  // `amount` holds raw digits only; the input renders them dot-grouped (1.000.000).
  const parsed = Number(amount)
  const validNumber = amount !== '' && Number.isFinite(parsed)
  const exceeds = validNumber && parsed > minBid
  const affordable = exceeds && parsed <= me.cash
  const canBid = exceeds && affordable
  // Can't place any legal raise — even Rp 1 over the current bid is unaffordable.
  const cannotAffordAny = me.cash <= minBid

  const secondsLeft =
    auction.deadline != null ? Math.max(0, Math.ceil((auction.deadline - now) / 1000)) : null

  const submit = () => {
    if (!canBid) return
    auctionBid(parsed)
    setAmount('')
  }

  return (
    <Modal open onClose={() => {}} title={t('auction.title')} size="sm" dismissable={false}>
      <div className="space-y-3">
        <div className="text-xs text-ink-muted">
          {t('auction.spectating', {
            attacker: attacker.name,
            owner: owner.name,
            tile: tileName(t, auction.tileId),
          })}
        </div>

        <Card flat tone="sunken" className="space-y-1 p-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-muted">{t('auction.currentBid')}</span>
            <span className="font-display text-lg font-bold text-ink">
              {formatRupiah(auction.currentBid)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-muted">
              {t('auction.leading', { name: leader?.name ?? '' })}
            </span>
            {leader && <Badge color={leader.color} className="h-3 w-3 p-0" />}
          </div>
          {secondsLeft != null && (
            <div className="flex justify-between text-xs">
              <span className="text-ink-muted">⏱</span>
              <span className="font-mono font-bold tabular-nums text-ink">{secondsLeft}s</span>
            </div>
          )}
        </Card>

        {isMyBid ? (
          <div className="space-y-2">
            <div className="text-xs text-ink-muted">
              {iAmOwner ? t('auction.ownerHint') : t('auction.attackerHint')}
            </div>
            {cannotAffordAny ? (
              <div className="text-xs font-semibold text-danger-strong">
                {t('auction.notEnoughCash')}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount === '' ? '' : Number(amount).toLocaleString('id-ID')}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit()
                  }}
                  placeholder={t('auction.bidPlaceholder', { min: formatRupiah(minBid) })}
                  className="w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 text-sm tabular-nums"
                />
                <Button block disabled={!canBid} onClick={submit}>
                  {t('auction.placeBid')}
                </Button>
                {validNumber && exceeds && !affordable && (
                  <div className="text-xs font-semibold text-danger-strong">
                    {t('auction.notEnoughCash')}
                  </div>
                )}
              </>
            )}
            <Button block variant="ghost" size="sm" onClick={auctionConcede}>
              {iAmOwner ? t('auction.giveUp') : t('auction.stopBidding')}
            </Button>
            <Card flat tone="sunken" className="p-2 text-xs text-ink-muted">
              {t('auction.cash', { amount: formatRupiah(me.cash) })}
            </Card>
          </div>
        ) : (
          <Card flat tone="info" className="p-3 text-center text-sm text-ink">
            {t('auction.waiting', { name: toAct?.name ?? '' })}
          </Card>
        )}
      </div>
    </Modal>
  )
}
