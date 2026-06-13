import { BOARD, type GameState, type NegotiationDeal } from '@tuan-tanah/shared'
import { AnimatePresence, motion } from 'framer-motion'
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
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="w-80 rounded-2xl bg-slate-800 p-5 text-white shadow-2xl"
        >
          <div className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400">
            🤝 Deal offer
          </div>
          <div className="mt-1 text-lg font-bold">
            {playerName(state, deal.fromPlayerId)} proposes
          </div>
          <p className="mt-3 rounded-lg bg-slate-900/60 p-3 text-sm text-slate-200">
            {describeDeal(state, deal)}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={() => respond(false)}
              className="rounded-lg bg-slate-700 py-2.5 text-sm font-bold transition-colors hover:bg-slate-600"
            >
              Reject
            </button>
            <button
              onClick={() => respond(true)}
              className="rounded-lg bg-emerald-600 py-2.5 text-sm font-bold transition-colors hover:bg-emerald-500"
            >
              Accept
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
