import type { AbilityType, Player } from '@tuan-tanah/shared'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/index.js'

interface AbilityDef {
  ability: AbilityType
  role: Player['role']
  labelKey: string
  hintKey: string
}

// Once-per-game, player-triggered role abilities (separate from meta actions).
const ABILITIES: AbilityDef[] = [
  {
    ability: 'viral_boost',
    role: 'influencer',
    labelKey: 'ability.viralBoost',
    hintKey: 'ability.viralBoostHint',
  },
  {
    ability: 'block_kejadian',
    role: 'pejabat',
    labelKey: 'ability.blockKejadian',
    hintKey: 'ability.blockKejadianHint',
  },
]

interface Props {
  me: Player
  onUse: (ability: AbilityType) => void
}

export function AbilityBar({ me, onUse }: Props) {
  const { t } = useTranslation()
  const def = ABILITIES.find((a) => a.role === me.role)
  if (!def || me.usedAbility) return null

  return (
    <div className="space-y-1.5 rounded-lg border-2 border-ink bg-surface-sunken p-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
        {t('ability.title')}
      </div>
      <Button
        block
        size="sm"
        variant="info"
        onClick={() => onUse(def.ability)}
        title={t(def.hintKey)}
      >
        {t(def.labelKey)}
      </Button>
    </div>
  )
}
