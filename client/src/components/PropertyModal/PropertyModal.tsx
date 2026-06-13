import {
  BOARD,
  HOUSE_TIERS,
  PROPERTY_TIERS,
  REGIONS,
  SELL_REFUND_RATE,
  TRANSPORT_BUY_PRICE,
  type PropertyTrack,
  type RupiahAmount,
  type TileId,
  type TileState,
} from '@tuan-tanah/shared'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { formatRupiah, useGame } from '../../store/gameStore.js'

/** Invested value of a tile (base buy price + cumulative build cost). Mirrors the engine's tileValue. */
function tileValue(tile: TileState): RupiahAmount {
  const def = BOARD[tile.id]
  if (!def) return 0
  const base =
    def.type === 'transport' ? TRANSPORT_BUY_PRICE : def.region ? REGIONS[def.region].buyPrice : 0
  if (base === 0) return 0
  let value = base
  if (tile.tier >= 1) {
    const tiers = tile.track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
    for (let t = 1; t <= tile.tier; t++) {
      const tierDef = tiers[t - 1]
      if (tierDef) value += base * tierDef.buildCostMult
    }
  }
  return value
}

function tierLabel(tile: TileState): string {
  if (tile.tier < 1) return 'Unbuilt'
  const tiers = tile.track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  return tiers[tile.tier - 1]?.name ?? `Tier ${tile.tier}`
}

/** Name + build cost of the tier above `currentTier` on a track, or null if maxed. */
function nextTierInfo(
  def: (typeof BOARD)[number],
  track: PropertyTrack,
  currentTier: number,
): { name: string; cost: RupiahAmount } | null {
  if (!def.region) return null
  const tiers = track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  const tierDef = tiers[currentTier] // next tier (1-based) → 0-based index currentTier
  if (!tierDef) return null
  return {
    name: tierDef.name,
    cost: Math.round(REGIONS[def.region].buyPrice * tierDef.buildCostMult),
  }
}

export function PropertyModal({
  tileId,
  open,
  onClose,
}: {
  tileId: TileId | null
  open: boolean
  onClose: () => void
}) {
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const isMyTurn = useGame((s) => s.isMyTurn)()
  const sell = useGame((s) => s.sell)
  const upgrade = useGame((s) => s.upgrade)
  // Mounted per-tile (keyed in Game.tsx), so the confirm step starts fresh each open.
  const [confirming, setConfirming] = useState(false)

  if (!open || tileId === null || !state) return null

  const def = BOARD[tileId]
  const tile = state.tiles[tileId]
  if (!def || !tile) return null

  const ownable = def.type === 'property' || def.type === 'transport'
  const owner = tile.ownerId ? state.players.find((p) => p.id === tile.ownerId) : null
  const region = def.region ? REGIONS[def.region] : null
  const refund = Math.round(tileValue(tile) * SELL_REFUND_RATE)
  // Sellable on your turn, or out of turn while you owe a debt (to raise cash).
  const iOweDebt = me ? state.pendingDebts.some((d) => d.debtorId === me.id) : false
  const canSell = ownable && me !== null && tile.ownerId === me.id && (isMyTurn || iOweDebt)

  // Develop a property tile. You build on your own tile; a Kontraktor may also
  // build on someone else's (earning a rent cut). Capped per turn (Pengusaha 2×).
  const isProperty = def.type === 'property' && !!def.region
  const ownsTile = me !== null && tile.ownerId === me.id
  const canKontraktorBuild = me?.role === 'kontraktor' && tile.ownerId !== null && !ownsTile
  const upgradeLimit = me?.role === 'pengusaha' ? 2 : 1
  const upgradesLeft = state.turn.upgradesUsed < upgradeLimit
  const atMaxTier = tile.track
    ? tile.tier >= (tile.track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS).length
    : false
  const canUpgrade =
    isProperty && isMyTurn && upgradesLeft && !atMaxTier && (ownsTile || canKontraktorBuild)

  const handleSell = () => {
    sell(tileId)
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
          {region && (
            <div className="h-1.5 w-full rounded-full" style={{ background: region.color }} />
          )}
          <div className="mt-2 text-lg font-bold">{def.name}</div>
          <div className="mt-0.5 text-xs text-slate-400">
            {region ? region.name : def.type === 'transport' ? 'Transport' : 'Tile'}
          </div>

          {ownable ? (
            <div className="mt-4 space-y-2 text-sm">
              <Row label="Owner">
                {owner ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: owner.color }}
                    />
                    {owner.name}
                    {owner.id === me?.id && <span className="text-amber-400">(you)</span>}
                  </span>
                ) : (
                  <span className="text-slate-400">Unowned</span>
                )}
              </Row>
              {owner && (
                <>
                  <Row label="Level">{tierLabel(tile)}</Row>
                  <Row label="Invested value">{formatRupiah(tileValue(tile))}</Row>
                </>
              )}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">This tile can&apos;t be owned.</div>
          )}

          {canUpgrade && (
            <div className="mt-5 space-y-2">
              {tile.tier === 0 ? (
                <>
                  <div className="text-xs text-slate-400">
                    {canKontraktorBuild
                      ? 'Build on this tile — you earn a rent cut:'
                      : 'Choose a track to build:'}
                  </div>
                  {(['house', 'property'] as const).map((track) => {
                    const info = nextTierInfo(def, track, 0)
                    if (!info) return null
                    const tooPoor = (me?.cash ?? 0) < info.cost
                    return (
                      <button
                        key={track}
                        disabled={tooPoor}
                        onClick={() => upgrade(tileId, track)}
                        className="w-full rounded-lg bg-sky-600 py-2 text-sm font-bold transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {track === 'house' ? 'Bangun Rumah' : 'Bangun Properti'} ({info.name}) —{' '}
                        {formatRupiah(info.cost)}
                      </button>
                    )
                  })}
                </>
              ) : (
                tile.track &&
                (() => {
                  const info = nextTierInfo(def, tile.track, tile.tier)
                  if (!info) return null
                  const tooPoor = (me?.cash ?? 0) < info.cost
                  return (
                    <button
                      disabled={tooPoor}
                      onClick={() => upgrade(tileId)}
                      className="w-full rounded-lg bg-sky-600 py-2.5 font-bold transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Upgrade to {info.name} — {formatRupiah(info.cost)}
                    </button>
                  )
                })()
              )}
            </div>
          )}

          {canSell &&
            (confirming ? (
              <div className="mt-5 space-y-2">
                <div className="rounded-lg bg-amber-500/15 px-3 py-2 text-center text-xs text-amber-200">
                  Sell {def.name} back to the bank for {formatRupiah(refund)}?
                </div>
                <button
                  onClick={handleSell}
                  className="w-full rounded-lg bg-rose-600 py-2.5 font-bold transition-colors hover:bg-rose-500"
                >
                  Confirm sell
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="w-full rounded-lg py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="mt-5 w-full rounded-lg bg-rose-600 py-2.5 font-bold transition-colors hover:bg-rose-500"
              >
                Sell back to bank — {formatRupiah(refund)}
              </button>
            ))}

          <button
            onClick={onClose}
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold">{children}</span>
    </div>
  )
}
