import {
  BOARD,
  type GameState,
  type NegotiationDeal,
  type NegotiationDealType,
  PLAYER_LOAN_MAX_RATE,
  type TileId,
} from '@tuan-tanah/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { describeDeal } from '../../i18n/dealText.js'
import { tileName } from '../../i18n/gameData.js'
import { Button, Card, Modal } from '../ui/index.js'
import { formatRupiah, useGame } from '../../store/gameStore.js'

const DEAL_TYPES: NegotiationDealType[] = [
  'property_swap',
  'cash_for_property',
  'rent_immunity',
  'revenue_share',
  'player_loan',
  'cash_gift',
]

const JUTA = 1_000_000
const MAX_RATE_PCT = Math.round(PLAYER_LOAN_MAX_RATE * 100)

function ownedTiles(state: GameState, playerId: string): { id: TileId; name: string }[] {
  return state.tiles
    .filter((t) => t.ownerId === playerId)
    .map((t) => ({ id: t.id, name: BOARD[t.id]!.name }))
}

const inputClass =
  'w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 text-sm outline-none transition focus:shadow-brutal-sm'
const labelClass = 'mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-faint'
const captionClass = 'mt-1 text-[11px] font-semibold text-ink-muted'

export interface NegotiationPrefill {
  targetId?: string
  type?: NegotiationDealType
  requestTileId?: TileId
}

export function NegotiationModal({
  open,
  onClose,
  prefill,
}: {
  open: boolean
  onClose: () => void
  prefill?: NegotiationPrefill
}) {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const proposeDeal = useGame((s) => s.proposeDeal)

  const [targetId, setTargetId] = useState<string>(prefill?.targetId ?? '')
  const [type, setType] = useState<NegotiationDealType>(prefill?.type ?? 'property_swap')
  const [offerTileId, setOfferTileId] = useState<number | ''>('')
  const [requestTileId, setRequestTileId] = useState<number | ''>(prefill?.requestTileId ?? '')
  const [cashJuta, setCashJuta] = useState<number>(5)
  const [laps, setLaps] = useState<number>(3)
  const [sharePercent, setSharePercent] = useState<number>(20)
  const [shareFrom, setShareFrom] = useState<'proposer' | 'target'>('proposer')
  const [immuneFor, setImmuneFor] = useState<'proposer' | 'target'>('proposer')
  const [cashFrom, setCashFrom] = useState<'proposer' | 'target'>('proposer')
  const [interestPct, setInterestPct] = useState<number>(10)

  if (!open || !state || !me) return null

  const targets = state.players.filter((p) => p.id !== me.id && !p.isEliminated)
  const myTiles = ownedTiles(state, me.id)
  const targetTiles = targetId ? ownedTiles(state, targetId) : []

  const needsOffer = type === 'property_swap'
  const needsRequest = type === 'property_swap' || type === 'cash_for_property'
  const needsImmunity = type === 'rent_immunity'
  const needsLaps = type === 'rent_immunity' || type === 'revenue_share'
  const needsShare = type === 'revenue_share'
  const needsCash =
    type === 'cash_for_property' ||
    type === 'rent_immunity' ||
    type === 'player_loan' ||
    type === 'cash_gift' ||
    type === 'property_swap'
  // Cash is required (> 0) for these; optional (0 = free) for swap top-up and immunity fee.
  const cashRequired =
    type === 'cash_for_property' || type === 'player_loan' || type === 'cash_gift'
  const needsCashDir = type === 'property_swap' || type === 'player_loan' || type === 'cash_gift'
  const needsInterest = type === 'player_loan'

  const cashLabel =
    type === 'rent_immunity'
      ? t('negotiation.immunityFee')
      : type === 'player_loan'
        ? t('negotiation.loanAmount')
        : type === 'cash_gift'
          ? t('negotiation.giftAmount')
          : type === 'property_swap'
            ? t('negotiation.cashTopup')
            : t('negotiation.yourOffer')

  const cashDirLabels: [string, string] =
    type === 'player_loan'
      ? [t('negotiation.youLend'), t('negotiation.theyLend')]
      : type === 'cash_gift'
        ? [t('negotiation.youGive'), t('negotiation.theyGive')]
        : [t('negotiation.youAddCash'), t('negotiation.theyAddCash')]

  const canPropose =
    targetId !== '' &&
    (!needsOffer || offerTileId !== '') &&
    (!needsRequest || requestTileId !== '') &&
    (!cashRequired || cashJuta > 0) &&
    (!needsLaps || laps >= 1) &&
    (!needsShare || (sharePercent > 0 && sharePercent <= 100)) &&
    (!needsInterest || (interestPct >= 0 && interestPct <= MAX_RATE_PCT))

  // Build the deal object that will be sent (also drives the live preview).
  const buildDeal = (): NegotiationDeal => {
    const cashAmount = Math.round(cashJuta * JUTA)
    return {
      id: '', // assigned server-side
      type,
      fromPlayerId: me.id,
      toPlayerId: targetId,
      status: 'pending',
      ...(needsOffer ? { offerTileId: offerTileId as TileId } : {}),
      ...(needsRequest ? { requestTileId: requestTileId as TileId } : {}),
      // property_swap: only include a top-up when there's actually cash.
      ...(type === 'property_swap' && cashJuta > 0 ? { cashAmount, cashFrom } : {}),
      ...(type === 'cash_for_property' ? { cashAmount } : {}),
      // rent_immunity: direction + laps; fee may be 0 (free gift). Covers all the
      // other player's properties.
      ...(needsImmunity ? { immuneFor, cashAmount, laps } : {}),
      ...(needsShare ? { sharePercent, shareFrom, laps } : {}),
      ...(type === 'player_loan' ? { cashAmount, cashFrom, interestRate: interestPct / 100 } : {}),
      ...(type === 'cash_gift' ? { cashAmount, cashFrom } : {}),
    }
  }

  const submit = () => {
    proposeDeal(buildDeal())
    onClose()
  }

  const targetName = targets.find((p) => p.id === targetId)?.name ?? ''

  return (
    <Modal open={open} onClose={onClose} title={t('negotiation.title')} size="sm">
      {/* Target player — clickable chips with token colours */}
      <div className={labelClass}>{t('negotiation.with')}</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {targets.map((p) => {
          const selected = p.id === targetId
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setTargetId(p.id)
                setRequestTileId('')
              }}
              className={`inline-flex items-center gap-2 rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-bold transition ${
                selected
                  ? 'bg-accent text-ink shadow-brutal-sm'
                  : 'bg-surface hover:shadow-brutal-sm'
              }`}
            >
              <span
                className="h-3 w-3 rounded-full border-2 border-ink"
                style={{ background: p.color }}
              />
              {p.name}
            </button>
          )
        })}
      </div>

      {/* Deal type */}
      <div className={labelClass}>{t('negotiation.dealType')}</div>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {DEAL_TYPES.map((dt) => (
          <Button
            key={dt}
            size="sm"
            variant={type === dt ? 'primary' : 'secondary'}
            onClick={() => setType(dt)}
          >
            {t(`negotiation.dealTypes.${dt}`)}
          </Button>
        ))}
      </div>

      {/* Your tile (swap only) */}
      {needsOffer && (
        <>
          <div className={labelClass}>{t('negotiation.yourTileToGive')}</div>
          <select
            value={offerTileId}
            onChange={(e) => setOfferTileId(e.target.value === '' ? '' : Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">{t('negotiation.selectYourTile')}</option>
            {myTiles.map((tile) => (
              <option key={tile.id} value={tile.id}>
                {tileName(t, tile.id)}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Their tile (swap / cash-for-property) */}
      {needsRequest && (
        <>
          <div className={labelClass}>{t('negotiation.theirTileWant')}</div>
          <select
            value={requestTileId}
            onChange={(e) => setRequestTileId(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={!targetId}
            className={`mt-1 ${inputClass} disabled:opacity-40`}
          >
            <option value="">
              {targetId ? t('negotiation.selectTheirTile') : t('negotiation.pickPlayerFirst')}
            </option>
            {targetTiles.map((tile) => (
              <option key={tile.id} value={tile.id}>
                {tileName(t, tile.id)}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Rent immunity: who is immune (covers all of the other player's properties) */}
      {needsImmunity && (
        <>
          <div className={labelClass}>{t('negotiation.whoIsImmune')}</div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={immuneFor === 'proposer' ? 'info' : 'secondary'}
              onClick={() => setImmuneFor('proposer')}
            >
              {t('negotiation.immuneMe')}
            </Button>
            <Button
              size="sm"
              variant={immuneFor === 'target' ? 'info' : 'secondary'}
              onClick={() => setImmuneFor('target')}
            >
              {t('negotiation.immuneThem')}
            </Button>
          </div>
        </>
      )}

      {/* Cash amount (+ live Rupiah caption + direction toggle grouped together) */}
      {needsCash && (
        <>
          <div className={labelClass}>{cashLabel}</div>
          <input
            type="number"
            min={cashRequired ? 1 : 0}
            value={cashJuta}
            onChange={(e) => setCashJuta(Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          />
          <div className={captionClass}>
            {t('negotiation.cashEquals', { amount: formatRupiah(Math.round(cashJuta * JUTA)) })}
          </div>
          {/* Who pays the cash (swap top-up / loan lender / gift giver) */}
          {needsCashDir && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={cashFrom === 'proposer' ? 'info' : 'secondary'}
                onClick={() => setCashFrom('proposer')}
              >
                {cashDirLabels[0]}
              </Button>
              <Button
                size="sm"
                variant={cashFrom === 'target' ? 'info' : 'secondary'}
                onClick={() => setCashFrom('target')}
              >
                {cashDirLabels[1]}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Player loan: interest rate */}
      {needsInterest && (
        <>
          <div className={labelClass}>{t('negotiation.interestRate')}</div>
          <input
            type="number"
            min={0}
            max={MAX_RATE_PCT}
            value={interestPct}
            onChange={(e) => setInterestPct(Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          />
        </>
      )}

      {/* Revenue share */}
      {needsShare && (
        <>
          <div className={labelClass}>{t('negotiation.sharePercent')}</div>
          <input
            type="number"
            min={1}
            max={100}
            value={sharePercent}
            onChange={(e) => setSharePercent(Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          />
          <div className={labelClass}>{t('negotiation.whoShares')}</div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={shareFrom === 'proposer' ? 'info' : 'secondary'}
              onClick={() => setShareFrom('proposer')}
            >
              {t('negotiation.youShare')}
            </Button>
            <Button
              size="sm"
              variant={shareFrom === 'target' ? 'info' : 'secondary'}
              onClick={() => setShareFrom('target')}
            >
              {t('negotiation.theyShare')}
            </Button>
          </div>
        </>
      )}

      {/* Laps duration */}
      {needsLaps && (
        <>
          <div className={labelClass}>{t('negotiation.durationLaps')}</div>
          <input
            type="number"
            min={1}
            value={laps}
            onChange={(e) => setLaps(Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          />
        </>
      )}

      {/* Live preview — exactly what the target will see */}
      {canPropose && (
        <>
          <div className={labelClass}>{t('negotiation.preview', { name: targetName })}</div>
          <Card flat tone="sunken" className="mt-1 p-3 text-sm text-ink">
            {describeDeal(state, buildDeal(), t)}
          </Card>
        </>
      )}

      <Button block onClick={submit} disabled={!canPropose} className="mt-5">
        {t('negotiation.sendProposal')}
      </Button>
      <Button block variant="ghost" size="sm" onClick={onClose} className="mt-2">
        {t('negotiation.cancel')}
      </Button>
    </Modal>
  )
}
