// Negotiation deal state machine — STUB for a later milestone.
// Deal types: property_swap, cash_for_property, rent_immunity, revenue_share.
import type { GameState, NegotiationDeal } from '@tuan-tanah/shared'

export function validateDeal(_state: GameState, _deal: NegotiationDeal): string | null {
  // TODO: validate ownership, funds, target existence.
  return 'Negotiation not implemented yet'
}

export function applyDeal(_state: GameState, _deal: NegotiationDeal): void {
  // TODO: execute accepted deal atomically.
}
