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
import { useTranslation } from 'react-i18next'
import { tierName, tileName } from '../../i18n/gameData.js'
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

type TFunc = ReturnType<typeof useTranslation>['t']

function tierLabel(tile: TileState, t: TFunc): string {
  if (tile.tier < 1) return t('property.unbuilt')
  if (!tile.track) return t('property.tierFallback', { tier: tile.tier })
  return tierName(t, tile.track, tile.tier)
}

/** Tier number + build cost of the tier above `currentTier` on a track, or null if maxed. */
function nextTierInfo(
  def: (typeof BOARD)[number],
  track: PropertyTrack,
  currentTier: number,
): { tier: number; cost: RupiahAmount } | null {
  if (!def.region) return null
  const tiers = track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  const tierDef = tiers[currentTier] // next tier (1-based) → 0-based index currentTier
  if (!tierDef) return null
  return {
    tier: tierDef.tier,
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
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const isMyTurn = useGame((s) => s.isMyTurn)()
  const sell = useGame((s) => s.sell)
  const upgrade = useGame((s) => s.upgrade)
  const downgrade = useGame((s) => s.downgrade)
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
  // Optional room rule: the tile owner must own the whole region before building.
  const needFullRegion =
    state.settings.requireFullRegionToBuild &&
    def.region != null &&
    tile.ownerId != null &&
    !REGIONS[def.region].tileIds.every((tid) => state.tiles[tid]?.ownerId === tile.ownerId)
  const canBuildHere = isProperty && (ownsTile || canKontraktorBuild)
  const canUpgrade = canBuildHere && isMyTurn && upgradesLeft && !atMaxTier && !needFullRegion

  // Downgrade one tier on your own tile for a partial refund of that tier's build cost.
  const currentTierMult =
    tile.tier >= 1 && tile.track
      ? ((tile.track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS)[tile.tier - 1]?.buildCostMult ?? 0)
      : 0
  const downgradeRefund = def.region
    ? Math.round(REGIONS[def.region].buyPrice * currentTierMult * SELL_REFUND_RATE)
    : 0
  const canDowngrade = isProperty && isMyTurn && ownsTile && tile.tier >= 1

  const handleSell = () => {
    sell(tileId)
    onClose()
  }
  const handleDowngrade = () => {
    downgrade(tileId)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={tileName(t, tileId)} size="sm">
      {/* Region accent + subtitle */}
      {region && (
        <div
          className="h-2 w-full rounded-full border-2 border-ink"
          style={{ background: region.color }}
        />
      )}
      <div className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
        {region
          ? region.name
          : def.type === 'transport'
            ? t('property.transport')
            : t('property.tile')}
      </div>

      {ownable ? (
        <Card flat tone="sunken" className="mt-4 space-y-2 p-3 text-sm">
          <Row label={t('property.owner')}>
            {owner ? (
              <Badge color={owner.color}>
                {owner.name}
                {owner.id === me?.id && t('common.youParen')}
              </Badge>
            ) : (
              <span className="text-ink-faint">{t('property.unowned')}</span>
            )}
          </Row>
          {owner && (
            <>
              <Row label={t('property.level')}>
                {tile.tier >= 1 ? (
                  <Badge tone="accent">
                    {tierLabel(tile, t)}
                    {tile.track
                      ? ` · ${tile.track === 'house' ? t('property.house') : t('property.property')}`
                      : ''}
                  </Badge>
                ) : (
                  <span className="text-ink-faint">{tierLabel(tile, t)}</span>
                )}
              </Row>
              <Row label={t('property.investedValue')}>{formatRupiah(tileValue(tile))}</Row>
            </>
          )}
        </Card>
      ) : (
        <div className="mt-4 text-sm text-ink-muted">{t('property.cantOwn')}</div>
      )}

      {canUpgrade && (
        <div className="mt-5 space-y-2">
          {tile.tier === 0 ? (
            <>
              <div className="text-xs text-ink-muted">
                {canKontraktorBuild ? t('property.buildRentCut') : t('property.chooseTrack')}
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
                    {track === 'house'
                      ? t('property.buildHouse', {
                          name: tierName(t, track, info.tier),
                          cost: formatRupiah(info.cost),
                        })
                      : t('property.buildProperty', {
                          name: tierName(t, track, info.tier),
                          cost: formatRupiah(info.cost),
                        })}
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
              const track = tile.track
              return (
                <Button block variant="info" disabled={tooPoor} onClick={() => upgrade(tileId)}>
                  {t('property.upgradeTo', {
                    name: tierName(t, track, info.tier),
                    cost: formatRupiah(info.cost),
                  })}
                </Button>
              )
            })()
          )}
        </div>
      )}

      {canBuildHere && needFullRegion && (
        <Card flat tone="sunken" className="mt-4 px-3 py-2 text-center text-xs text-ink-muted">
          {t('property.needFullRegion')}
        </Card>
      )}

      {canDowngrade && (
        <Button block variant="secondary" className="mt-3" onClick={handleDowngrade}>
          {t('property.downgrade', { refund: formatRupiah(downgradeRefund) })}
        </Button>
      )}

      {canSell &&
        (confirming ? (
          <div className="mt-5 space-y-2">
            <Card
              flat
              tone="accent"
              className="px-3 py-2 text-center text-xs font-semibold text-ink"
            >
              {t('property.sellConfirm', {
                name: tileName(t, tileId),
                refund: formatRupiah(refund),
              })}
            </Card>
            <Button block variant="danger" onClick={handleSell}>
              {t('property.confirmSell')}
            </Button>
            <Button block variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : (
          <Button block variant="danger" className="mt-5" onClick={() => setConfirming(true)}>
            {t('property.sellBack', { refund: formatRupiah(refund) })}
          </Button>
        ))}

      <Button block variant="ghost" size="sm" className="mt-2" onClick={onClose}>
        {t('property.close')}
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
