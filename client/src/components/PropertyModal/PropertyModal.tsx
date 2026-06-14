import {
  BOARD,
  HOUSE_TIERS,
  PROPERTY_TIERS,
  REGION_SET_RENT_MULTIPLIER,
  REGIONS,
  SELL_REFUND_RATE,
  TRANSPORT_BUY_PRICE,
  TRANSPORT_RENT,
  type PropertyTrack,
  type RegionDef,
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
    <Modal open={open} onClose={onClose} title={tileName(t, tileId)} size="lg">
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

      {isProperty && region && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t('property.rentSchedule')}
          </div>
          <Card flat tone="sunken" className="max-h-80 overflow-y-auto p-1">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-2 py-1.5 text-left">{t('property.levelCol')}</th>
                  <th className="px-2 py-1.5 text-right">{t('property.rentCol')}</th>
                  <th className="px-2 py-1.5 text-right">{t('property.buildCol')}</th>
                </tr>
              </thead>
              <tbody>
                <ScheduleRow
                  name={t('property.landOnly')}
                  rent={formatRupiah(region.rentBase)}
                  cost="—"
                  current={tile.tier === 0}
                />
                {(tile.track ? [tile.track] : (['house', 'property'] as const)).map((track) => (
                  <TrackSection
                    key={track}
                    region={region}
                    track={track}
                    currentTrack={tile.track}
                    currentTier={tile.tier}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-1.5 px-1 text-[11px] text-ink-muted">
            {t('property.regionBonus', { mult: REGION_SET_RENT_MULTIPLIER, region: region.name })}
          </div>
        </div>
      )}

      {def.type === 'transport' && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t('property.rentSchedule')}
          </div>
          <Card flat tone="sunken" className="p-1">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-2 py-1.5 text-left">{t('property.transportsOwned')}</th>
                  <th className="px-2 py-1.5 text-right">{t('property.rentCol')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(TRANSPORT_RENT).map(([count, rent]) => (
                  <tr key={count} className="text-ink-muted">
                    <td className="px-2 py-1.5">
                      {t('property.transportCount', { count: Number(count) })}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-ink">
                      {formatRupiah(rent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
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

/** A track sub-header row plus its per-tier rent/build-cost rows. */
function TrackSection({
  region,
  track,
  currentTrack,
  currentTier,
  t,
}: {
  region: RegionDef
  track: PropertyTrack
  currentTrack: PropertyTrack | null
  currentTier: number
  t: TFunc
}) {
  const tiers = track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  return (
    <>
      <tr>
        <td
          colSpan={3}
          className="px-2 pb-0.5 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint"
        >
          {track === 'house' ? t('property.house') : t('property.property')}
        </td>
      </tr>
      {tiers.map((td) => (
        <ScheduleRow
          key={td.tier}
          name={tierName(t, track, td.tier)}
          rent={formatRupiah(Math.round(region.rentBase * td.rentMult))}
          cost={formatRupiah(Math.round(region.buyPrice * td.buildCostMult))}
          current={currentTrack === track && currentTier === td.tier}
        />
      ))}
    </>
  )
}

/** One row of the development schedule: level name, rent earned, build cost. */
function ScheduleRow({
  name,
  rent,
  cost,
  current,
}: {
  name: string
  rent: string
  cost: string
  current?: boolean
}) {
  return (
    <tr className={current ? 'bg-accent-soft font-semibold text-ink' : 'text-ink-muted'}>
      <td className="px-2 py-1.5">{name}</td>
      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-ink">{rent}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{cost}</td>
    </tr>
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
