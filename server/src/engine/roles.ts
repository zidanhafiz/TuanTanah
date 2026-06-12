// Role ability resolvers. Only salary + a couple of slice-relevant abilities are
// implemented; the rest are TODO for later milestones.
import { ROLES } from '@tuan-tanah/shared'
import type { Player, RupiahAmount } from '@tuan-tanah/shared'

/** GO salary for a player, applying role modifiers (Freelancer 1.5×). */
export function salaryFor(player: Player): RupiahAmount {
  if (!player.role) return 0
  const base = ROLES[player.role].salary
  if (player.role === 'freelancer') return Math.round(base * 1.5)
  return base
}

/** Property purchase discount multiplier (Sales buys 25% cheaper). */
export function buyPriceMultiplier(player: Player): number {
  return player.role === 'sales' ? 0.75 : 1
}

// TODO (later milestones): investor rent cut, politisi lobby discount,
// pengusaha double upgrade, kontraktor build-on-others, influencer/pejabat
// once-per-game abilities, rentenir forced loans.
