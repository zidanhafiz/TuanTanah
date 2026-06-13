import {
  BOARD,
  type GameState,
  type NegotiationDeal,
  type NegotiationDealType,
  type TileId,
} from '@tuan-tanah/shared'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
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

const inputClass = 'w-full rounded-lg bg-slate-700 px-3 py-2 text-sm text-white outline-none'
const labelClass = 'mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500'

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
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
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
          className="max-h-[90vh] w-80 overflow-y-auto rounded-2xl bg-slate-800 p-5 text-white shadow-2xl"
        >
          <div className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400">
            🤝 Negotiate
          </div>
          <div className="mt-1 text-lg font-bold">Propose a deal</div>

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
              <button
                key={dt.value}
                onClick={() => setType(dt.value)}
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                  type === dt.value
                    ? 'bg-fuchsia-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>

          {/* Your tile (swap only) */}
          {needsOffer && (
            <>
              <div className={labelClass}>Your tile to give</div>
              <select
                value={offerTileId}
                onChange={(e) =>
                  setOfferTileId(e.target.value === '' ? '' : Number(e.target.value))
                }
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
                onChange={(e) =>
                  setRequestTileId(e.target.value === '' ? '' : Number(e.target.value))
                }
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
                <button
                  onClick={() => setShareFrom('proposer')}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                    shareFrom === 'proposer'
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  You share
                </button>
                <button
                  onClick={() => setShareFrom('target')}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                    shareFrom === 'target'
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  They share
                </button>
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

          <button
            onClick={submit}
            disabled={!canPropose}
            className="mt-5 w-full rounded-lg bg-fuchsia-600 py-2.5 font-bold text-white transition-colors hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send proposal
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
