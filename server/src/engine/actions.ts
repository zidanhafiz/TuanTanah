// Meta actions validator + executor — STUB for a later milestone.
// Actions: invest, work, hustle, lobby, sabotage, korupsi, negotiate.
import type { MetaActionType } from '@tuan-tanah/shared'
import type { GameState } from '@tuan-tanah/shared'

export interface MetaActionRequest {
  action: MetaActionType
  playerId: string
  targetId?: string
  tileId?: number
}

export function performMetaAction(
  _state: GameState,
  req: MetaActionRequest,
): string | null {
  // Returns an error message, or null on success.
  // TODO: implement invest/work/hustle/lobby/sabotage/korupsi/negotiate.
  return `Meta action "${req.action}" not implemented yet`
}
