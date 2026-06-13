import type { AbilityType, Player } from '@tuan-tanah/shared'

interface AbilityDef {
  ability: AbilityType
  role: Player['role']
  label: string
  hint: string
}

// Once-per-game, player-triggered role abilities (separate from meta actions).
const ABILITIES: AbilityDef[] = [
  {
    ability: 'viral_boost',
    role: 'influencer',
    label: '✨ Viral Boost',
    hint: '3× passive income for 3 rounds — once per game',
  },
  {
    ability: 'block_kejadian',
    role: 'pejabat',
    label: '🛡️ Block Kejadian',
    hint: 'Nullify the next Kejadian card — once per game',
  },
]

interface Props {
  me: Player
  onUse: (ability: AbilityType) => void
}

export function AbilityBar({ me, onUse }: Props) {
  const def = ABILITIES.find((a) => a.role === me.role)
  if (!def || me.usedAbility) return null

  return (
    <div className="space-y-1.5 rounded-lg bg-slate-900/60 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Role ability (once per game)
      </div>
      <button
        onClick={() => onUse(def.ability)}
        title={def.hint}
        className="w-full rounded-md bg-fuchsia-600 px-2 py-1.5 text-[11px] font-semibold transition-colors hover:bg-fuchsia-500"
      >
        {def.label}
      </button>
    </div>
  )
}
