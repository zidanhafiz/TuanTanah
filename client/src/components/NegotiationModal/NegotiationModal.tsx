import {
  BOARD,
  type GameState,
  type NegotiationDeal,
  type NegotiationDealType,
  type TileId,
} from '@tuan-tanah/shared'
import { useState } from 'react'
import { Button, Modal } from '../ui/index.js'
import { useGame } from '../../store/gameStore.js'

const DEAL_TYPES: { value: NegotiationDealType; label: string }[] = [
  { value: 'property_swap', label: 'Property swap' },
  { value: 'cash_for_property', label: 'Cash for property' },
  { value: 'rent_immunity', label: 'Rent immunity' },
  { value: 'revenue_share', label: 'Revenue share' },
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
    <Modal open={open} onClose={onClose} title="🤝 Propose a deal" size="sm">
      {/* Target player */}
      <div className={labelClass}>With</div>
      <select
        value={targetId}
        onChange={(e) => {
          setTargetId(e.target.value)
          setRequestTileId('')
        }}
        className={`mt-1 ${inputClass}`}
      >
        <option value="">Select a player…</option>
        {targets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Deal type */}
      <div className={labelClass}>Deal type</div>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {DEAL_TYPES.map((dt) => (
          <Button
            key={dt.value}
            size="sm"
            variant={type === dt.value ? 'primary' : 'secondary'}
            onClick={() => setType(dt.value)}
          >
            {dt.label}
          </Button>
        ))}
      </div>

      {/* Your tile (swap only) */}
      {needsOffer && (
        <>
          <div className={labelClass}>Your tile to give</div>
          <select
            value={offerTileId}
            onChange={(e) => setOfferTileId(e.target.value === '' ? '' : Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">Select your tile…</option>
            {myTiles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Their tile */}
      {needsRequest && (
        <>
          <div className={labelClass}>
            {type === 'rent_immunity' ? 'Their tile for immunity' : 'Their tile you want'}
          </div>
          <select
            value={requestTileId}
            onChange={(e) => setRequestTileId(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={!targetId}
            className={`mt-1 ${inputClass} disabled:opacity-40`}
          >
            <option value="">{targetId ? 'Select their tile…' : 'Pick a player first'}</option>
            {targetTiles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Cash */}
      {needsCash && (
        <>
          <div className={labelClass}>
            {type === 'rent_immunity' ? 'Price you pay (juta)' : 'Your offer (juta)'}
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
          <div className={labelClass}>Share %</div>
          <input
            type="number"
            min={1}
            max={100}
            value={sharePercent}
            onChange={(e) => setSharePercent(Number(e.target.value))}
            className={`mt-1 ${inputClass}`}
          />
          <div className={labelClass}>Who shares income</div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={shareFrom === 'proposer' ? 'info' : 'secondary'}
              onClick={() => setShareFrom('proposer')}
            >
              You share
            </Button>
            <Button
              size="sm"
              variant={shareFrom === 'target' ? 'info' : 'secondary'}
              onClick={() => setShareFrom('target')}
            >
              They share
            </Button>
          </div>
        </>
      )}

      {/* Rounds */}
      {needsRounds && (
        <>
          <div className={labelClass}>Duration (rounds)</div>
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
        Send proposal
      </Button>
      <Button block variant="ghost" size="sm" onClick={onClose} className="mt-2">
        Cancel
      </Button>
    </Modal>
  )
}
