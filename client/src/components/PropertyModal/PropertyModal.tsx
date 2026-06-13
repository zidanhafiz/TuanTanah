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
import { useState } from 'react'
import { Badge, Button, Card, Modal } from '../ui/index.js'
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
    <Modal open={open} onClose={onClose} title={def.name} size="sm">
      {/* Region accent + subtitle */}
      {region && (
        <div
          className="h-2 w-full rounded-full border-2 border-ink"
          style={{ background: region.color }}
        />
      )}
      <div className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
        {region ? region.name : def.type === 'transport' ? 'Transport' : 'Tile'}
      </div>

      {ownable ? (
        <Card flat tone="sunken" className="mt-4 space-y-2 p-3 text-sm">
          <Row label="Owner">
            {owner ? (
              <Badge color={owner.color}>
                {owner.name}
                {owner.id === me?.id && ' (you)'}
              </Badge>
            ) : (
              <span className="text-ink-faint">Unowned</span>
            )}
          </Row>
          {owner && (
            <>
              <Row label="Level">
                {tile.tier >= 1 ? (
                  <Badge tone="accent">
                    {tierLabel(tile)}
                    {tile.track ? ` · ${tile.track === 'house' ? 'Rumah' : 'Properti'}` : ''}
                  </Badge>
                ) : (
                  <span className="text-ink-faint">{tierLabel(tile)}</span>
                )}
              </Row>
              <Row label="Invested value">{formatRupiah(tileValue(tile))}</Row>
            </>
          )}
        </Card>
      ) : (
        <div className="mt-4 text-sm text-ink-muted">This tile can&apos;t be owned.</div>
      )}

      {canUpgrade && (
        <div className="mt-5 space-y-2">
          {tile.tier === 0 ? (
            <>
              <div className="text-xs text-ink-muted">
                {canKontraktorBuild
                  ? 'Build on this tile — you earn a rent cut:'
                  : 'Choose a track to build:'}
              </div>
              {(['house', 'property'] as const).map((track) => {
                const info = nextTierInfo(def, track, 0)
                if (!info) return null
                const tooPoor = (me?.cash ?? 0) < info.cost
                return (
                  <Button
                    key={track}
                    block
                    variant="info"
                    size="sm"
                    disabled={tooPoor}
                    onClick={() => upgrade(tileId, track)}
                  >
                    {track === 'house' ? 'Bangun Rumah' : 'Bangun Properti'} ({info.name}) —{' '}
                    {formatRupiah(info.cost)}
                  </Button>
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
                <Button block variant="info" disabled={tooPoor} onClick={() => upgrade(tileId)}>
                  Upgrade to {info.name} — {formatRupiah(info.cost)}
                </Button>
              )
            })()
          )}
        </div>
      )}

      {canSell &&
        (confirming ? (
          <div className="mt-5 space-y-2">
            <Card
              flat
              tone="accent"
              className="px-3 py-2 text-center text-xs font-semibold text-ink"
            >
              Sell {def.name} back to the bank for {formatRupiah(refund)}?
            </Card>
            <Button block variant="danger" onClick={handleSell}>
              Confirm sell
            </Button>
            <Button block variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button block variant="danger" className="mt-5" onClick={() => setConfirming(true)}>
            Sell back to bank — {formatRupiah(refund)}
          </Button>
        ))}

      <Button block variant="ghost" size="sm" className="mt-2" onClick={onClose}>
        Close
      </Button>
    </Modal>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold text-ink">{children}</span>
    </div>
  )
}
