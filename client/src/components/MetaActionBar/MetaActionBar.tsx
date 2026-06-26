import { META_ACTIONS_PER_LAP, type MetaActionType, type TurnState } from '@tuan-tanah/shared'
import { useTranslation } from 'react-i18next'
import { Button, Tooltip } from '@/components/ui/index.js'

export type MetaTarget = 'none' | 'player' | 'tile'

export interface MetaActionDef {
  action: MetaActionType
  target: MetaTarget
  needsUnrolled?: boolean // Work must be chosen before rolling
}

// Turn structure step 5 — one optional meta action per turn. Labels are looked
// up at render time via `meta.<action>` so they localize per player.
export const META_ACTIONS: MetaActionDef[] = [
  // Judol opens a deposit modal (handled in Game.tsx) rather than emitting on pick.
  { action: 'judol', target: 'none' },
  { action: 'work', target: 'none', needsUnrolled: true },
  { action: 'hustle', target: 'none' },
  { action: 'lobby', target: 'player' },
  { action: 'sabotage', target: 'tile' },
  { action: 'korupsi', target: 'none' },
  // Note: negotiation is offered as a dedicated button (opens the deal modal),
  // not as a meta action — the engine's `negotiate` meta only signals intent.
]

interface Props {
  turn: TurnState
  // Meta actions already used this lap (resets when the player passes GO).
  used: MetaActionType[]
  pendingAction: MetaActionType | null
  onPick: (def: MetaActionDef) => void
}

export function MetaActionBar({ turn, used, pendingAction, onPick }: Props) {
  const { t } = useTranslation()
  const remaining = META_ACTIONS_PER_LAP - used.length
  return (
    <div className="space-y-1.5 rounded-lg border-2 border-ink bg-surface-sunken p-2">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-ink-muted">
        <span>{t('meta.title')}</span>
        <span>{t('meta.remaining', { count: remaining })}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {META_ACTIONS.map((def) => {
          const alreadyUsed = used.includes(def.action)
          const disabled = Boolean(def.needsUnrolled && turn.hasRolled) || alreadyUsed
          const active = pendingAction === def.action
          return (
            <Tooltip
              key={def.action}
              content={alreadyUsed ? t('meta.alreadyUsed') : t(`meta.descriptions.${def.action}`)}
              className="w-full"
            >
              <Button
                size="sm"
                block
                variant={active ? 'info' : 'secondary'}
                disabled={disabled}
                onClick={() => onPick(def)}
              >
                {t(`meta.${def.action}`)}
              </Button>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
