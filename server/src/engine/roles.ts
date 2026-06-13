// Role ability resolvers. Centralizes the per-role rules so engine call sites
// stay generic.
import { INVESTOR_RENT_CUT_RATE, ROLES } from '@tuan-tanah/shared'
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

/** Investor's skim on a rent payment between two other players. */
export function investorCut(amount: RupiahAmount): RupiahAmount {
  return Math.round(amount * INVESTOR_RENT_CUT_RATE)
}

/** Ojol Driver never pays travel/movement tax (tax tiles + the BBM card). */
export function isTaxImmune(player: Player): boolean {
  return player.role === 'ojol_driver'
}

// TODO (other tasks): rentenir forced loans (pinjol system), sales 15% deal
// bonus (TTG-17 negotiation).
