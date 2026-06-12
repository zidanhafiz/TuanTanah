import type { MetaActionType, TurnState } from '@tuan-tanah/shared'

export type MetaTarget = 'none' | 'player' | 'tile'

export interface MetaActionDef {
  action: MetaActionType
  label: string
  target: MetaTarget
  needsUnrolled?: boolean // Work must be chosen before rolling
}

// Turn structure step 5 — one optional meta action per turn.
export const META_ACTIONS: MetaActionDef[] = [
  { action: 'invest', label: '💰 Invest', target: 'tile' },
  { action: 'work', label: '💼 Work', target: 'none', needsUnrolled: true },
  { action: 'hustle', label: '🎴 Hustle', target: 'none' },
  { action: 'lobby', label: '🗣️ Lobby', target: 'player' },
  { action: 'sabotage', label: '💣 Sabotage', target: 'tile' },
  { action: 'korupsi', label: '🕵️ Korupsi', target: 'none' },
  { action: 'negotiate', label: '🤝 Negotiate', target: 'player' },
]

interface Props {
  turn: TurnState
  pendingAction: MetaActionType | null
  onPick: (def: MetaActionDef) => void
}

export function MetaActionBar({ turn, pendingAction, onPick }: Props) {
  return (
    <div className="space-y-1.5 rounded-lg bg-slate-900/60 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Meta action (1 per turn)
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {META_ACTIONS.map((def) => {
          const disabled = Boolean(def.needsUnrolled && turn.hasRolled)
          const active = pendingAction === def.action
          return (
            <button
              key={def.action}
              disabled={disabled}
              onClick={() => onPick(def)}
              title={def.needsUnrolled ? 'Choose before rolling — skips your move' : undefined}
              className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? 'bg-sky-500 text-white' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {def.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
