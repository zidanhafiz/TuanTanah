import { BOARD, type GameState, type NegotiationDeal } from '@tuan-tanah/shared'
import { Button, Card, Modal } from '../ui/index.js'
import { formatRupiah, useGame } from '../../store/gameStore.js'

function playerName(state: GameState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? 'Someone'
}

const tileName = (id: number) => BOARD[id]?.name ?? `tile ${id}`

/** Plain-language summary of a deal from the target (responder)'s point of view. */
function describeDeal(state: GameState, deal: NegotiationDeal): string {
  const from = playerName(state, deal.fromPlayerId)
  switch (deal.type) {
    case 'property_swap':
      return `${from} offers their ${tileName(deal.offerTileId!)} in exchange for your ${tileName(
        deal.requestTileId!,
      )}.`
    case 'cash_for_property':
      return `${from} offers ${formatRupiah(deal.cashAmount ?? 0)} to buy your ${tileName(
        deal.requestTileId!,
      )}.`
    case 'rent_immunity':
      return `${from} pays you ${formatRupiah(deal.cashAmount ?? 0)} for ${deal.rounds}-round rent immunity on your ${tileName(
        deal.requestTileId!,
      )}.`
    case 'revenue_share':
      return deal.shareFrom === 'proposer'
        ? `${from} will share ${deal.sharePercent}% of their passive income with you for ${deal.rounds} rounds.`
        : `You would share ${deal.sharePercent}% of your passive income with ${from} for ${deal.rounds} rounds.`
  }
}

export function IncomingDealModal() {
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
      title={`🤝 ${playerName(state, deal.fromPlayerId)} proposes`}
      size="sm"
      dismissable={false}
    >
      <Card flat tone="sunken" className="p-3 text-sm text-ink">
        {describeDeal(state, deal)}
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" block onClick={() => respond(false)}>
          Reject
        </Button>
        <Button variant="success" size="sm" block onClick={() => respond(true)}>
          Accept
        </Button>
      </div>
    </Modal>
  )
}
