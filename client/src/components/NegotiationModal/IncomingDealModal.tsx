import { type GameState, type NegotiationDeal } from '@tuan-tanah/shared'
import { useTranslation } from 'react-i18next'
import { tileName } from '../../i18n/gameData.js'
import { Button, Card, Modal } from '../ui/index.js'
import { formatRupiah, useGame } from '../../store/gameStore.js'

type TFunc = ReturnType<typeof useTranslation>['t']

function playerName(state: GameState, id: string, t: TFunc): string {
  return state.players.find((p) => p.id === id)?.name ?? t('negotiation.someone')
}

/** Plain-language summary of a deal from the target (responder)'s point of view. */
function describeDeal(state: GameState, deal: NegotiationDeal, t: TFunc): string {
  const from = playerName(state, deal.fromPlayerId, t)
  switch (deal.type) {
    case 'property_swap': {
      const base = t('negotiation.desc.property_swap', {
        from,
        offer: tileName(t, deal.offerTileId!),
        request: tileName(t, deal.requestTileId!),
      })
      if (!deal.cashAmount) return base
      const cash = formatRupiah(deal.cashAmount)
      // cashFrom = who pays. 'proposer' = they add cash; 'target' = you add cash.
      return `${base} ${
        deal.cashFrom === 'proposer'
          ? t('negotiation.desc.swap_cash_they', { from, cash })
          : t('negotiation.desc.swap_cash_you', { from, cash })
      }`
    }
    case 'cash_for_property':
      return t('negotiation.desc.cash_for_property', {
        from,
        cash: formatRupiah(deal.cashAmount ?? 0),
        request: tileName(t, deal.requestTileId!),
      })
    case 'rent_immunity': {
      const cash = formatRupiah(deal.cashAmount ?? 0)
      // immuneFor = who is immune. 'proposer' = they're immune on your properties (they pay you);
      // 'target' = you're immune on their properties (you pay them).
      return deal.immuneFor === 'proposer'
        ? t('negotiation.desc.rent_immunity_get', { from, cash, laps: deal.laps })
        : t('negotiation.desc.rent_immunity_give', { from, cash, laps: deal.laps })
    }
    case 'revenue_share':
      return deal.shareFrom === 'proposer'
        ? t('negotiation.desc.revenue_share_proposer', {
            from,
            percent: deal.sharePercent,
            laps: deal.laps,
          })
        : t('negotiation.desc.revenue_share_target', {
            from,
            percent: deal.sharePercent,
            laps: deal.laps,
          })
    case 'player_loan': {
      const cash = formatRupiah(deal.cashAmount ?? 0)
      const rate = Math.round((deal.interestRate ?? 0) * 100)
      // cashFrom = lender. 'proposer' = they lend to you; 'target' = they borrow from you.
      return deal.cashFrom === 'proposer'
        ? t('negotiation.desc.loan_lend', { from, cash, rate })
        : t('negotiation.desc.loan_borrow', { from, cash, rate })
    }
    case 'cash_gift': {
      const cash = formatRupiah(deal.cashAmount ?? 0)
      // cashFrom = giver. 'proposer' = they give you; 'target' = they ask you for.
      return deal.cashFrom === 'proposer'
        ? t('negotiation.desc.gift_give', { from, cash })
        : t('negotiation.desc.gift_ask', { from, cash })
    }
  }
}

export function IncomingDealModal() {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const deal = useGame((s) => s.incomingDeal)
  const respondDeal = useGame((s) => s.respondDeal)
  const dismiss = useGame((s) => s.dismissIncomingDeal)

  if (!state || !deal) return null

  const respond = (accept: boolean) => {
    respondDeal(deal.id, accept)
    dismiss()
  }

  return (
    <Modal
      open
      onClose={() => respond(false)}
      title={t('negotiation.proposes', { name: playerName(state, deal.fromPlayerId, t) })}
      size="sm"
      dismissable={false}
    >
      <Card flat tone="sunken" className="p-3 text-sm text-ink">
        {describeDeal(state, deal, t)}
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" block onClick={() => respond(false)}>
          {t('negotiation.reject')}
        </Button>
        <Button variant="success" size="sm" block onClick={() => respond(true)}>
          {t('negotiation.accept')}
        </Button>
      </div>
    </Modal>
  )
}
