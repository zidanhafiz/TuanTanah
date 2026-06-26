import { useTranslation } from 'react-i18next'
import { describeDeal, playerName } from '@/i18n/dealText.js'
import { Button, Card, Modal } from '../ui/index.js'
import { useGame } from '@/store/gameStore.js'

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
