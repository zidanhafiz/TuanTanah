import {
  BOARD,
  type GameState,
  type NegotiationDeal,
  type NegotiationDealType,
  type TileId,
} from '@tuan-tanah/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tileName } from '../../i18n/gameData.js'
import { Button, Modal } from '../ui/index.js'
import { useGame } from '../../store/gameStore.js'

const DEAL_TYPES: NegotiationDealType[] = [
  'property_swap',
  'cash_for_property',
  'rent_immunity',
  'revenue_share',
]

const JUTA = 1_000_000

function ownedTiles(state: GameState, playerId: string): { id: TileId; name: string }[] {
  return state.tiles
    .filter((t) => t.ownerId === playerId)
    .map((t) => ({ id: t.id, name: BOARD[t.id]!.name }))
}

const inputClass =
  'w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 text-sm outline-none transition focus:shadow-brutal-sm'
const labelClass = 'mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-faint'

export function NegotiationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const proposeDeal = useGame((s) => s.proposeDeal)

  const [targetId, setTargetId] = useState<string>('')
  const [type, setType] = useState<NegotiationDealType>('property_swap')
  const [offerTileId, setOfferTileId] = useState<number | ''>('')
  const [requestTileId, setRequestTileId] = useState<number | ''>('')
  const [cashJuta, setCashJuta] = useState<number>(5)
  const [rounds, setRounds] = useState<number>(3)
  const [sharePercent, setSharePercent] = useState<number>(20)
  const [shareFrom, setShareFrom] = useState<'proposer' | 'target'>('proposer')

  if (!open || !state || !me) return null

  const targets = state.players.filter((p) => p.id !== me.id && !p.isEliminated)
  const myTiles = ownedTiles(state, me.id)
  const targetTiles = targetId ? ownedTiles(state, targetId) : []

  const needsOffer = type === 'property_swap'
  const needsRequest = type !== 'revenue_share'
  const needsCash = type === 'cash_for_property' || type === 'rent_immunity'
  const needsRounds = type === 'rent_immunity' || type === 'revenue_share'
  const needsShare = type === 'revenue_share'

  const canPropose =
    targetId !== '' &&
    (!needsOffer || offerTileId !== '') &&
    (!needsRequest || requestTileId !== '') &&
    (!needsCash || cashJuta > 0) &&
    (!needsRounds || rounds >= 1) &&
    (!needsShare || (sharePercent > 0 && sharePercent <= 100))

  const submit = () => {
    const deal: NegotiationDeal = {
      id: '', // assigned server-side
      type,
      fromPlayerId: me.id,
      toPlayerId: targetId,
      status: 'pending',
      ...(needsOffer ? { offerTileId: offerTileId as TileId } : {}),
      ...(needsRequest ? { requestTileId: requestTileId as TileId } : {}),
      ...(needsCash ? { cashAmount: Math.round(cashJuta * JUTA) } : {}),
      ...(needsRounds ? { rounds } : {}),
      ...(needsShare ? { sharePercent, shareFrom } : {}),
    }
    proposeDeal(deal)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('negotiation.title')} size="sm">
      {/* Target player */}
      <div className={labelClass}>{t('negotiation.with')}</div>
      <select
        value={targetId}
        onChange={(e) => {
          setTargetId(e.target.value)
          setRequestTileId('')
        }}
        className={`mt-1 ${inputClass}`}
      >
        <option value="">{t('negotiation.selectPlayer')}</option>
        {targets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

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

      {/* Their tile */}
      {needsRequest && (
        <>
          <div className={labelClass}>
            {type === 'rent_immunity'
              ? t('negotiation.theirTileImmunity')
              : t('negotiation.theirTileWant')}
          </div>
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

      {/* Cash */}
      {needsCash && (
        <>
          <div className={labelClass}>
            {type === 'rent_immunity' ? t('negotiation.priceYouPay') : t('negotiation.yourOffer')}
          </div>
          <input
            type="number"
            min={1}
            value={cashJuta}
            onChange={(e) => setCashJuta(Number(e.target.value))}
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

      {/* Rounds */}
      {needsRounds && (
        <>
          <div className={labelClass}>{t('negotiation.duration')}</div>
          <input
            type="number"
            min={1}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          />
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
