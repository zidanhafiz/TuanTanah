import {
  BOARD,
  HOUSE_TIERS,
  LAHAN_LAND_PRICE,
  LAND_BUSINESS_TIERS,
  LAND_MAX_TIER,
  landTier,
  PROPERTY_TIERS,
  REGION_SET_RENT_MULTIPLIER,
  REGION_SET_VALUE_MULTIPLIER,
  REGIONS,
  SELL_REFUND_RATE,
  TRANSPORT_BUY_PRICE,
  TRANSPORT_RENT,
  type LandBusiness,
  type PropertyTrack,
  type RegionDef,
  type RupiahAmount,
  type TileId,
  type TileState,
} from '@tuan-tanah/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  effectSourceName,
  landBusinessName,
  landTierName,
  tierName,
  tileEffectLabel,
  tileName,
} from '@/i18n/gameData.js'
import { EffectIcon, isTileEffect } from '@/features/game/Board/icons.js'
import { Badge, Button, Card, Modal } from '@/components/ui/index.js'
import { formatRupiah, useGame } from '@/store/gameStore.js'

/** True if `ownerId` owns every tile in `region`. Mirrors the engine's ownsFullRegion. */
function ownsFullRegion(
  tiles: TileState[],
  region: RegionDef | undefined,
  ownerId: string | null,
): boolean {
  if (!region || !ownerId) return false
  return region.tileIds.every((tid) => tiles[tid]?.ownerId === ownerId)
}

/** Invested value of a tile (base buy price + cumulative build cost, scaled by the
 * Kantor Hukum price multiplier, doubled while the owner holds the full region).
 * Mirrors the engine's tileValue. */
function tileValue(tile: TileState, tiles: TileState[]): RupiahAmount {
  const def = BOARD[tile.id]
  if (!def) return 0
  if (def.type === 'buildable_land') {
    let value = LAHAN_LAND_PRICE
    if (tile.landBuild) {
      for (let t = 1; t <= tile.tier; t++) value += landTier(tile.landBuild, t)?.buildCost ?? 0
    }
    return Math.round(value * tile.priceMultiplier)
  }
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
  let market = Math.round(value * tile.priceMultiplier)
  if (tile.ownerId && def.region && ownsFullRegion(tiles, REGIONS[def.region], tile.ownerId)) {
    market *= REGION_SET_VALUE_MULTIPLIER
  }
  return market
}

type TFunc = ReturnType<typeof useTranslation>['t']

function tierLabel(tile: TileState, t: TFunc): string {
  if (tile.tier < 1) return t('property.unbuilt')
  if (tile.landBuild) return landTierName(t, tile.landBuild, tile.tier)
  if (!tile.track) return t('property.tierFallback', { tier: tile.tier })
  return tierName(t, tile.track, tile.tier)
}

/** Tier number + build cost of the tier above `currentTier` on a track, or null if maxed. */
function nextTierInfo(
  def: (typeof BOARD)[number],
  track: PropertyTrack,
  currentTier: number,
  discount: number,
  priceMult: number,
): { tier: number; cost: RupiahAmount } | null {
  if (!def.region) return null
  const tiers = track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  const tierDef = tiers[currentTier] // next tier (1-based) → 0-based index currentTier
  if (!tierDef) return null
  return {
    tier: tierDef.tier,
    cost: Math.round(REGIONS[def.region].buyPrice * tierDef.buildCostMult * discount * priceMult),
  }
}

export function PropertyModal({
  tileId,
  open,
  onClose,
  onNegotiate,
}: {
  tileId: TileId | null
  open: boolean
  onClose: () => void
  /** Start a deal for this tile with its owner. Provided only when negotiation is allowed. */
  onNegotiate?: (intent: {
    type: 'cash_for_property' | 'property_swap'
    tileId: TileId
    ownerId: string
  }) => void
}) {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const isMyTurn = useGame((s) => s.isMyTurn)()
  const sell = useGame((s) => s.sell)
  const upgrade = useGame((s) => s.upgrade)
  const downgrade = useGame((s) => s.downgrade)
  const buildLahan = useGame((s) => s.buildLahan)
  // Mounted per-tile (keyed in Game.tsx), so the confirm step starts fresh each open.
  const [confirming, setConfirming] = useState(false)

  if (!open || tileId === null || !state) return null

  const def = BOARD[tileId]
  const tile = state.tiles[tileId]
  if (!def || !tile) return null

  const ownable = def.type === 'property' || def.type === 'transport'
  const isLand = def.type === 'buildable_land'
  const owner = tile.ownerId ? state.players.find((p) => p.id === tile.ownerId) : null
  const region = def.region ? REGIONS[def.region] : null
  // Card effects currently on this tile (rent/transport multiplier, gempa/banjir
  // tier drop) — same set surfaced as the on-board indicator.
  const tileEffects = state.activeEffects.filter(
    (e) => isTileEffect(e) && e.targetTileIds?.includes(tileId),
  )
  const refund = Math.round(tileValue(tile, state.tiles) * SELL_REFUND_RATE)
  // Sellable on your turn, or out of turn while you owe a debt (to raise cash).
  const iOweDebt = me ? state.pendingDebts.some((d) => d.debtorId === me.id) : false
  const canSell =
    (ownable || isLand) && me !== null && tile.ownerId === me.id && (isMyTurn || iOweDebt)
  // Lahan Kosong: pick + build the first tier on bare owned land (turn-only).
  const ownsLand = isLand && me !== null && tile.ownerId === me.id
  const canBuildLahan = ownsLand && isMyTurn && !tile.landBuild
  // Pengusaha builds & upgrades 20% cheaper (mirrors the engine's buildCostMultiplier).
  const buildDiscount = me?.role === 'pengusaha' ? 0.8 : 1
  // Upgrade an already-built business one tier (no per-turn cap — free upgrades).
  const landNextTier = tile.landBuild && tile.tier < LAND_MAX_TIER ? tile.tier + 1 : null
  const landNextCost =
    tile.landBuild && landNextTier
      ? Math.round(
          (landTier(tile.landBuild, landNextTier)?.buildCost ?? 0) *
            buildDiscount *
            tile.priceMultiplier,
        )
      : 0
  const canUpgradeLand = ownsLand && isMyTurn && landNextTier !== null

  // Develop a property tile. You build on your own tile; a Kontraktor may also
  // build on someone else's (earning a rent cut). No per-turn cap — build as many
  // tiers as cash allows.
  const isProperty = def.type === 'property' && !!def.region
  const ownsTile = me !== null && tile.ownerId === me.id
  const canKontraktorBuild = me?.role === 'kontraktor' && tile.ownerId !== null && !ownsTile
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
  const canUpgrade = canBuildHere && isMyTurn && !atMaxTier && !needFullRegion

  // Downgrade one tier on your own tile for a partial refund of that tier's build cost.
  // Allowed on your turn, or out of turn while you owe a debt (to raise cash).
  const currentTierMult =
    tile.tier >= 1 && tile.track
      ? ((tile.track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS)[tile.tier - 1]?.buildCostMult ?? 0)
      : 0
  const landCurrentBuildCost =
    isLand && tile.landBuild && tile.tier >= 1
      ? (landTier(tile.landBuild, tile.tier)?.buildCost ?? 0)
      : 0
  const downgradeRefund = isLand
    ? Math.round(landCurrentBuildCost * SELL_REFUND_RATE * tile.priceMultiplier)
    : def.region
      ? Math.round(
          REGIONS[def.region].buyPrice * currentTierMult * SELL_REFUND_RATE * tile.priceMultiplier,
        )
      : 0
  const canDowngrade =
    (isProperty || isLand) && (isMyTurn || iOweDebt) && ownsTile && tile.tier >= 1

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
              <Row label={t('property.investedValue')}>
                {formatRupiah(tileValue(tile, state.tiles))}
              </Row>
              {tile.priceMultiplier > 1 && (
                <Row label={t('property.priceBoost')}>
                  <Badge tone="accent">×{tile.priceMultiplier}</Badge>
                </Row>
              )}
            </>
          )}
        </Card>
      ) : isLand ? (
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
              <Row label={t('property.business')}>
                {tile.landBuild ? (
                  <Badge tone="accent">{landBusinessName(t, tile.landBuild)}</Badge>
                ) : (
                  <span className="text-ink-faint">{t('property.bareLand')}</span>
                )}
              </Row>
              {tile.landBuild && (
                <Row label={t('property.level')}>
                  <Badge tone="accent">{tierLabel(tile, t)}</Badge>
                </Row>
              )}
              <Row label={t('property.investedValue')}>
                {formatRupiah(tileValue(tile, state.tiles))}
              </Row>
              {tile.priceMultiplier > 1 && (
                <Row label={t('property.priceBoost')}>
                  <Badge tone="accent">×{tile.priceMultiplier}</Badge>
                </Row>
              )}
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
          <Card flat tone="sunken" className="max-h-80 overflow-auto p-1">
            <table className="w-full min-w-[26rem] border-collapse text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="whitespace-nowrap px-2 py-1.5 text-left">
                    {t('property.levelCol')}
                  </th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">
                    {t('property.rentCol')}
                  </th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">
                    {t('property.passiveCol')}
                  </th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">
                    {t('property.buildCol')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <ScheduleRow
                  name={t('property.landOnly')}
                  rent={formatRupiah(
                    Math.round(region.rentBase * PROPERTY_TIERS[0].rentMult * tile.priceMultiplier),
                  )}
                  passive="—"
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
                    priceMult={tile.priceMultiplier}
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

      {isLand && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t('property.landSchedule')}
          </div>
          {(tile.landBuild ? [tile.landBuild] : (['dapur_mbg', 'warkop_cafe'] as const)).map(
            (business) => (
              <Card key={business} flat tone="sunken" className="mb-2 overflow-x-auto p-1">
                <div className="px-2 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                  {landBusinessName(t, business)}
                </div>
                <table className="w-full min-w-[26rem] border-collapse text-sm">
                  <thead>
                    <tr className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                      <th className="whitespace-nowrap px-2 py-1.5 text-left">
                        {t('property.levelCol')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right">
                        {t('property.rentCol')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right">
                        {t('property.passiveCol')}
                      </th>
                      <th className="whitespace-nowrap px-2 py-1.5 text-right">
                        {t('property.buildCol')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {LAND_BUSINESS_TIERS[business].map((tierDef) => {
                      const current = tile.landBuild === business && tile.tier === tierDef.tier
                      return (
                        <tr
                          key={tierDef.tier}
                          className={current ? 'font-bold text-ink' : 'text-ink-muted'}
                        >
                          <td className="whitespace-nowrap px-2 py-1.5">
                            {landTierName(t, business, tierDef.tier)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                            {formatRupiah(tierDef.rent)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                            {formatRupiah(tierDef.passive)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                            {formatRupiah(tierDef.buildCost)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            ),
          )}
        </div>
      )}

      {def.type === 'transport' && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t('property.rentSchedule')}
          </div>
          <Card flat tone="sunken" className="overflow-x-auto p-1">
            <table className="w-full min-w-[20rem] border-collapse text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="whitespace-nowrap px-2 py-1.5 text-left">
                    {t('property.transportsOwned')}
                  </th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-right">
                    {t('property.rentCol')}
                  </th>
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

      {tileEffects.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t('property.activeEffects')}
          </div>
          <Card flat tone="sunken" className="space-y-2 p-3 text-sm">
            {tileEffects.map((effect) => {
              const source = effectSourceName(t, effect.sourceCard)
              return (
                <div key={effect.id} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-surface shadow-brutal-xs">
                    <EffectIcon effect={effect} className="h-4 w-4" />
                  </span>
                  <div className="flex flex-1 items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {source ??
                        t(`data.effects.${effect.type}`, { multiplier: effect.multiplier ?? 1 })}
                    </span>
                    <span className="text-xs text-ink-muted">{tileEffectLabel(t, effect)}</span>
                  </div>
                </div>
              )
            })}
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
                const info = nextTierInfo(def, track, 0, buildDiscount, tile.priceMultiplier)
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
              const info = nextTierInfo(
                def,
                tile.track,
                tile.tier,
                buildDiscount,
                tile.priceMultiplier,
              )
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

      {canBuildLahan && (
        <div className="mt-5 space-y-2">
          <div className="text-xs text-ink-muted">{t('property.buildLandPrompt')}</div>
          {(['dapur_mbg', 'warkop_cafe'] as LandBusiness[]).map((biz) => {
            const cost = Math.round(
              (landTier(biz, 1)?.buildCost ?? 0) * buildDiscount * tile.priceMultiplier,
            )
            const key = biz === 'dapur_mbg' ? 'property.buildDapur' : 'property.buildWarkop'
            return (
              <Button
                key={biz}
                block
                variant="info"
                size="sm"
                disabled={(me?.cash ?? 0) < cost}
                onClick={() => {
                  buildLahan(tileId, biz)
                  onClose()
                }}
              >
                {t(key, { cost: formatRupiah(cost) })}
              </Button>
            )
          })}
        </div>
      )}

      {canUpgradeLand && tile.landBuild && landNextTier !== null && (
        <Button
          block
          variant="info"
          className="mt-5"
          disabled={(me?.cash ?? 0) < landNextCost}
          onClick={() => buildLahan(tileId, tile.landBuild!)}
        >
          {t('property.upgradeTo', {
            name: landTierName(t, tile.landBuild, landNextTier),
            cost: formatRupiah(landNextCost),
          })}
        </Button>
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

      {/* Owned by someone else: jump into a deal (buy or swap) with the owner. */}
      {(ownable || isLand) && owner && owner.id !== me?.id && onNegotiate && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            block
            variant="success"
            size="sm"
            onClick={() => onNegotiate({ type: 'cash_for_property', tileId, ownerId: owner.id })}
          >
            {t('property.offerBuy')}
          </Button>
          <Button
            block
            variant="info"
            size="sm"
            onClick={() => onNegotiate({ type: 'property_swap', tileId, ownerId: owner.id })}
          >
            {t('property.proposeSwap')}
          </Button>
        </div>
      )}

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
  priceMult,
  t,
}: {
  region: RegionDef
  track: PropertyTrack
  currentTrack: PropertyTrack | null
  currentTier: number
  priceMult: number
  t: TFunc
}) {
  const tiers = track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
  // Property landing rent is flat (mirrors server computeRent): tier-1 price for
  // tiers 1–4, tier-2 price at max tier. House rent uses each tier's own mult.
  const rentMultFor = (td: (typeof tiers)[number]) =>
    track === 'property'
      ? (PROPERTY_TIERS[td.tier >= PROPERTY_TIERS.length ? 1 : 0]?.rentMult ?? td.rentMult)
      : td.rentMult
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="px-2 pb-0.5 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint"
        >
          {track === 'house' ? t('property.house') : t('property.property')}
        </td>
      </tr>
      {tiers.map((td) => (
        <ScheduleRow
          key={td.tier}
          name={tierName(t, track, td.tier)}
          rent={formatRupiah(Math.round(region.rentBase * rentMultFor(td) * priceMult))}
          // Only the property track earns passive income; the house track shows "—".
          passive={
            track === 'property'
              ? formatRupiah(
                  Math.round(
                    region.passiveBase *
                      (PROPERTY_TIERS[td.tier - 1]?.passiveMult ?? 0) *
                      priceMult,
                  ),
                )
              : '—'
          }
          cost={formatRupiah(Math.round(region.buyPrice * td.buildCostMult * priceMult))}
          current={currentTrack === track && currentTier === td.tier}
        />
      ))}
    </>
  )
}

/** One row of the development schedule: level name, rent earned, passive income, build cost. */
function ScheduleRow({
  name,
  rent,
  passive,
  cost,
  current,
}: {
  name: string
  rent: string
  passive: string
  cost: string
  current?: boolean
}) {
  return (
    <tr className={current ? 'bg-accent-soft font-semibold text-ink' : 'text-ink-muted'}>
      <td className="whitespace-nowrap px-2 py-1.5">{name}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums text-ink">
        {rent}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{passive}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{cost}</td>
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
