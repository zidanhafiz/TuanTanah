import {
  BOARD,
  HOUSE_TIERS,
  LAHAN_LAND_PRICE,
  LAW_OFFICE_FREEPASS_PRICE,
  LAW_OFFICE_JAIL_FEE,
  LAW_OFFICE_PRICE_MULT_MAX,
  LAW_OFFICE_PRICE_MULT_MIN,
  LAW_OFFICE_TRANSFER_RATE,
  PROPERTY_TIERS,
  REGIONS,
  TRANSPORT_BUY_PRICE,
  landTier,
  type PassType,
  type TileId,
  type TileState,
} from '@tuan-tanah/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tileName } from '../../i18n/gameData.js'
import { Button, Card, Modal } from '../ui/index.js'
import { formatRupiah, useGame } from '../../store/gameStore.js'

type Mode = 'menu' | 'buy' | 'transfer' | 'jail' | 'freepass' | 'upgrade'
const PASSES: PassType[] = ['rent_free', 'tax_free', 'jail_free']
const MULTIPLIERS = Array.from(
  { length: LAW_OFFICE_PRICE_MULT_MAX - LAW_OFFICE_PRICE_MULT_MIN + 1 },
  (_, i) => LAW_OFFICE_PRICE_MULT_MIN + i,
)

/** Current market value of an owned tile — mirrors the engine's `tileValue`. */
function investedValue(tile: TileState): number {
  const def = BOARD[tile.id]!
  if (def.type === 'buildable_land') {
    let value = LAHAN_LAND_PRICE
    if (tile.landBuild) {
      for (let tr = 1; tr <= tile.tier; tr++) value += landTier(tile.landBuild, tr)?.buildCost ?? 0
    }
    return Math.round(value * tile.priceMultiplier)
  }
  const base =
    def.type === 'transport' ? TRANSPORT_BUY_PRICE : def.region ? REGIONS[def.region].buyPrice : 0
  if (base === 0) return 0
  let value = base
  if (tile.tier >= 1) {
    const tiers = tile.track === 'house' ? HOUSE_TIERS : PROPERTY_TIERS
    for (let tr = 1; tr <= tile.tier; tr++) value += base * (tiers[tr - 1]?.buildCostMult ?? 0)
  }
  return Math.round(value * tile.priceMultiplier)
}

function buyCost(tileId: TileId): number {
  const def = BOARD[tileId]!
  if (def.type === 'transport') return TRANSPORT_BUY_PRICE
  if (def.type === 'buildable_land') return LAHAN_LAND_PRICE
  return def.region ? REGIONS[def.region].buyPrice : 0
}

interface Choice {
  key: string | number
  label: string
  sub: string
  disabled: boolean
  onClick: () => void
}

/**
 * Kantor Hukum landing modal: the current player picks one legal action (buy a
 * tile remotely, force-buy a rival's property at a 30% discount, force-jail a
 * rival, or buy a free-pass card) or skips. Visibility is driven by the server's
 * `turn.pendingLawOffice`; resolving any action clears it and unmounts the modal.
 */
export function KantorHukumModal({
  open,
  onClose,
  onSkip,
}: {
  open: boolean
  onClose: () => void
  onSkip: () => void
}) {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const lawOfficeBuy = useGame((s) => s.lawOfficeBuy)
  const lawOfficeTransfer = useGame((s) => s.lawOfficeTransfer)
  const lawOfficeJail = useGame((s) => s.lawOfficeJail)
  const lawOfficeFreepass = useGame((s) => s.lawOfficeFreepass)
  const lawOfficePriceUpgrade = useGame((s) => s.lawOfficePriceUpgrade)
  const [mode, setMode] = useState<Mode>('menu')
  const [upgradeTileId, setUpgradeTileId] = useState<TileId | null>(null)

  if (!open || !state || !me) return null
  const cash = me.cash
  const back = () => {
    setUpgradeTileId(null)
    setMode('menu')
  }
  // Closing (X / backdrop) only hides the modal locally — the opportunity is
  // kept, so reset to the top menu for the next reopen. Skipping is a separate,
  // explicit action that relinquishes the opportunity on the server.
  const handleClose = () => {
    setUpgradeTileId(null)
    setMode('menu')
    onClose()
  }

  const titles: Record<Mode, string> = {
    menu: t('lawOffice.title'),
    buy: t('lawOffice.buy.title'),
    transfer: t('lawOffice.transfer.title'),
    jail: t('lawOffice.jail.title'),
    freepass: t('lawOffice.freepass.title'),
    upgrade: t('lawOffice.upgrade.title'),
  }
  const passLabel: Record<PassType, string> = {
    rent_free: t('lawOffice.pass.rent_free'),
    tax_free: t('lawOffice.pass.tax_free'),
    jail_free: t('lawOffice.pass.jail_free'),
  }

  const unowned = BOARD.filter(
    (d) =>
      (d.type === 'property' || d.type === 'transport' || d.type === 'buildable_land') &&
      state.tiles[d.id]?.ownerId == null,
  )
  const rivalTiles = BOARD.filter((d) => {
    if (d.type !== 'property' && d.type !== 'transport') return false
    const ownerId = state.tiles[d.id]?.ownerId
    if (!ownerId || ownerId === me.id) return false
    return !state.players.find((p) => p.id === ownerId)?.isEliminated
  })
  const jailTargets = state.players.filter((p) => !p.isEliminated && p.id !== me.id && !p.inJail)

  const buyItems: Choice[] = unowned.map((d) => {
    const price = buyCost(d.id)
    return {
      key: d.id,
      label: tileName(t, d.id),
      sub: formatRupiah(price),
      disabled: cash < price,
      onClick: () => lawOfficeBuy(d.id),
    }
  })
  const transferItems: Choice[] = rivalTiles.map((d) => {
    const price = Math.round(investedValue(state.tiles[d.id]!) * LAW_OFFICE_TRANSFER_RATE)
    const owner = state.players.find((p) => p.id === state.tiles[d.id]?.ownerId)
    return {
      key: d.id,
      label: tileName(t, d.id),
      sub: t('lawOffice.transfer.cost', { price: formatRupiah(price), owner: owner?.name ?? '' }),
      disabled: cash < price,
      onClick: () => lawOfficeTransfer(d.id),
    }
  })
  const jailItems: Choice[] = jailTargets.map((p) => ({
    key: p.id,
    label: p.name,
    sub: '',
    disabled: cash < LAW_OFFICE_JAIL_FEE,
    onClick: () => lawOfficeJail(p.id),
  }))
  const freepassItems: Choice[] = PASSES.map((pass) => ({
    key: pass,
    label: passLabel[pass],
    sub: formatRupiah(LAW_OFFICE_FREEPASS_PRICE),
    disabled: cash < LAW_OFFICE_FREEPASS_PRICE,
    onClick: () => lawOfficeFreepass(pass),
  }))

  const myTiles = BOARD.filter((d) => {
    if (d.type !== 'property' && d.type !== 'transport' && d.type !== 'buildable_land') return false
    return state.tiles[d.id]?.ownerId === me.id
  })
  const upgradeItems: Choice[] = myTiles.map((d) => {
    const tile = state.tiles[d.id]!
    return {
      key: d.id,
      label: tileName(t, d.id),
      sub: t('lawOffice.upgrade.tileSub', {
        value: formatRupiah(investedValue(tile)),
        mult: tile.priceMultiplier,
      }),
      disabled: false,
      onClick: () => setUpgradeTileId(d.id),
    }
  })

  return (
    <Modal open={open} onClose={handleClose} title={titles[mode]} size="sm">
      {mode === 'menu' ? (
        <div className="space-y-2">
          <div className="text-xs text-ink-muted">{t('lawOffice.intro')}</div>
          <Button block onClick={() => setMode('buy')} disabled={unowned.length === 0}>
            {t('lawOffice.buy.label')}
          </Button>
          <Button block onClick={() => setMode('transfer')} disabled={rivalTiles.length === 0}>
            {t('lawOffice.transfer.label')}
          </Button>
          <Button block onClick={() => setMode('jail')} disabled={jailTargets.length === 0}>
            {t('lawOffice.jail.label', { fee: formatRupiah(LAW_OFFICE_JAIL_FEE) })}
          </Button>
          <Button block onClick={() => setMode('freepass')}>
            {t('lawOffice.freepass.label', { price: formatRupiah(LAW_OFFICE_FREEPASS_PRICE) })}
          </Button>
          <Button block onClick={() => setMode('upgrade')} disabled={myTiles.length === 0}>
            {t('lawOffice.upgrade.label')}
          </Button>
          <Button block variant="ghost" size="sm" onClick={onSkip}>
            {t('lawOffice.skip')}
          </Button>
          <Card flat tone="sunken" className="mt-2 p-2 text-xs text-ink-muted">
            {t('lawOffice.cash', { amount: formatRupiah(cash) })}
          </Card>
        </div>
      ) : mode === 'upgrade' && upgradeTileId != null ? (
        <UpgradePanel
          tile={state.tiles[upgradeTileId]!}
          cash={cash}
          onBack={() => setUpgradeTileId(null)}
          onConfirm={(multiplier) => {
            lawOfficePriceUpgrade(upgradeTileId, multiplier)
            handleClose()
          }}
        />
      ) : (
        <Selection
          back={back}
          items={
            mode === 'buy'
              ? buyItems
              : mode === 'transfer'
                ? transferItems
                : mode === 'jail'
                  ? jailItems
                  : mode === 'upgrade'
                    ? upgradeItems
                    : freepassItems
          }
        />
      )}
    </Modal>
  )
}

function UpgradePanel({
  tile,
  cash,
  onBack,
  onConfirm,
}: {
  tile: TileState
  cash: number
  onBack: () => void
  onConfirm: (multiplier: number) => void
}) {
  const { t } = useTranslation()
  const [multiplier, setMultiplier] = useState(LAW_OFFICE_PRICE_MULT_MIN)
  const value = investedValue(tile)
  const cost = Math.round(value * multiplier)
  const canAfford = cash >= cost

  return (
    <div className="space-y-3">
      <div className="text-xs text-ink-muted">
        {t('lawOffice.upgrade.desc', { tile: tileName(t, tile.id) })}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {MULTIPLIERS.map((m) => (
          <button
            key={m}
            onClick={() => setMultiplier(m)}
            className={`rounded-lg border-2 border-ink py-2 font-display text-lg font-bold transition ${
              multiplier === m ? 'bg-accent text-ink shadow-brutal-sm' : 'bg-surface text-ink'
            }`}
          >
            ×{m}
          </button>
        ))}
      </div>
      <Card flat tone="sunken" className="space-y-1 p-2 text-xs">
        <div className="flex justify-between">
          <span className="text-ink-muted">{t('lawOffice.upgrade.newMult')}</span>
          <span className="font-semibold text-ink">×{tile.priceMultiplier * multiplier}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">{t('lawOffice.upgrade.cost')}</span>
          <span className="font-semibold text-ink">{formatRupiah(cost)}</span>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" size="sm" block onClick={onBack}>
          {t('lawOffice.back')}
        </Button>
        <Button size="sm" block disabled={!canAfford} onClick={() => onConfirm(multiplier)}>
          {t('lawOffice.upgrade.confirm')}
        </Button>
      </div>
    </div>
  )
}

function Selection({ items, back }: { items: Choice[]; back: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <button
            key={it.key}
            disabled={it.disabled}
            onClick={it.onClick}
            className="flex w-full items-center justify-between gap-2 rounded-lg border-2 border-ink bg-surface px-3 py-2 text-left text-sm transition hover:shadow-brutal-sm disabled:opacity-40"
          >
            <span className="font-semibold text-ink">{it.label}</span>
            {it.sub && <span className="shrink-0 text-xs text-ink-muted">{it.sub}</span>}
          </button>
        ))}
      </div>
      <Button block variant="ghost" size="sm" onClick={back}>
        {t('lawOffice.back')}
      </Button>
    </div>
  )
}
