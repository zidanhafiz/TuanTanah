import type { MetaActionType, TurnState } from '@tuan-tanah/shared'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/index.js'

export type MetaTarget = 'none' | 'player' | 'tile'

export interface MetaActionDef {
  action: MetaActionType
  target: MetaTarget
  needsUnrolled?: boolean // Work must be chosen before rolling
}

// Turn structure step 5 — one optional meta action per turn. Labels are looked
// up at render time via `meta.<action>` so they localize per player.
export const META_ACTIONS: MetaActionDef[] = [
  { action: 'invest', target: 'tile' },
  { action: 'work', target: 'none', needsUnrolled: true },
  { action: 'hustle', target: 'none' },
  { action: 'lobby', target: 'player' },
  { action: 'sabotage', target: 'tile' },
  { action: 'korupsi', target: 'none' },
  { action: 'negotiate', target: 'player' },
]

interface Props {
  turn: TurnState
  pendingAction: MetaActionType | null
  onPick: (def: MetaActionDef) => void
}

export function MetaActionBar({ turn, pendingAction, onPick }: Props) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5 rounded-lg border-2 border-ink bg-surface-sunken p-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
        {t('meta.title')}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {META_ACTIONS.map((def) => {
          const disabled = Boolean(def.needsUnrolled && turn.hasRolled)
          const active = pendingAction === def.action
          return (
            <Button
              key={def.action}
              size="sm"
              variant={active ? 'info' : 'secondary'}
              disabled={disabled}
              onClick={() => onPick(def)}
              title={def.needsUnrolled ? t('meta.chooseBeforeRolling') : undefined}
            >
              {t(`meta.${def.action}`)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
