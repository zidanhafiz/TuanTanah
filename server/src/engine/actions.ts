// Meta actions validator + executor (turn structure step 5).
// One optional meta action per turn: invest, work, hustle, lobby, sabotage,
// korupsi, negotiate. Pure engine logic — throws EngineError on invalid input.
import {
  KORUPSI_FINE,
  KORUPSI_STEAL_AMOUNT,
  KORUPSI_SUCCESS_RATE,
  META_ACTION_COSTS,
  SABOTAGE_DURATION_ROUNDS,
  SABOTAGE_RENT_MULTIPLIER,
} from '@tuan-tanah/shared'
import type { GameState, MetaActionType, Player } from '@tuan-tanah/shared'
import { getTileDef } from './board.js'
import { drawHustle } from './cards.js'
import { EngineError, buyTile, requireTurn, rupiah, sendToJail } from './index.js'
import { salaryFor } from './roles.js'
import { defaultRng, pushLog, uid, type Rng } from './util.js'

export interface MetaActionRequest {
  action: MetaActionType
  playerId: string
  targetId?: string
  tileId?: number
}

export interface MetaActionResult {
  card?: { cardId: string; name: string }
}

/** Resolve a target player that must be another, non-eliminated player. */
function requireTargetPlayer(state: GameState, selfId: string, targetId?: string): Player {
  if (!targetId) throw new EngineError('Select a target player')
  if (targetId === selfId) throw new EngineError('You cannot target yourself')
  const target = state.players.find((p) => p.id === targetId)
  if (!target) throw new EngineError('Target player not found')
  if (target.isEliminated) throw new EngineError('Target player is eliminated')
  return target
}

/** Deduct a cost from a player into the bank, or throw if they cannot afford it. */
function payToBank(state: GameState, player: Player, amount: number): void {
  if (player.cash < amount) throw new EngineError('Not enough cash')
  player.cash -= amount
  state.bank += amount
}

/**
 * Validate and execute one meta action. Mutates state in place.
 * Throws EngineError on invalid input. Returns a result the handler may relay
 * (e.g. the drawn Hustle card so it can emit `card_drawn`).
 */
export function performMetaAction(
  state: GameState,
  req: MetaActionRequest,
  rng: Rng = defaultRng,
): MetaActionResult {
  const player = requireTurn(state, req.playerId)
  if (state.turn.usedMetaAction) {
    throw new EngineError('Already used a meta action this turn')
  }

  switch (req.action) {
    case 'invest': {
      // Buy-only for now; upgrading your own tile is deferred to TTG-18.
      if (req.tileId == null) throw new EngineError('Select a tile to buy')
      buyTile(state, player, req.tileId)
      state.turn.usedMetaAction = true
      return {}
    }

    case 'work': {
      if (state.turn.hasRolled) {
        throw new EngineError('Work must be chosen before rolling (it skips your move)')
      }
      const salary = salaryFor(player)
      player.cash += salary
      state.bank -= salary
      state.turn.hasRolled = true // forgoes movement; lets the player end their turn
      pushLog(state, `${player.name} worked instead of moving (+${rupiah(salary)})`, player.id)
      state.turn.usedMetaAction = true
      return {}
    }

    case 'hustle': {
      const card = drawHustle(state, player)
      state.turn.usedMetaAction = true
      return card ? { card } : {}
    }

    case 'lobby': {
      const target = requireTargetPlayer(state, player.id, req.targetId)
      let cost: number = META_ACTION_COSTS.lobby
      if (player.role === 'politisi') cost = Math.round(cost * 0.5) // Politisi: lobby 50% off
      payToBank(state, player, cost)
      state.activeEffects.push({
        id: uid(),
        type: 'turn_skip',
        targetPlayerId: target.id,
        roundsRemaining: 2,
        sourceCard: 'meta_lobby',
      })
      pushLog(
        state,
        `${player.name} lobbied against ${target.name} (${rupiah(cost)}) — their next turn is skipped`,
        player.id,
      )
      state.turn.usedMetaAction = true
      return {}
    }

    case 'sabotage': {
      if (req.tileId == null) throw new EngineError('Select a tile to sabotage')
      const tile = state.tiles[req.tileId]
      if (!tile || tile.ownerId === null) throw new EngineError('That tile is not owned')
      if (tile.ownerId === player.id) throw new EngineError('You cannot sabotage your own tile')
      payToBank(state, player, META_ACTION_COSTS.sabotage)
      state.activeEffects.push({
        id: uid(),
        type: 'rent_multiplier',
        targetTileIds: [req.tileId],
        multiplier: SABOTAGE_RENT_MULTIPLIER,
        roundsRemaining: SABOTAGE_DURATION_ROUNDS,
        sourceCard: 'meta_sabotage',
      })
      pushLog(
        state,
        `${player.name} sabotaged ${getTileDef(req.tileId).name} (${rupiah(META_ACTION_COSTS.sabotage)})`,
        player.id,
      )
      state.turn.usedMetaAction = true
      return {}
    }

    case 'korupsi': {
      if (rng() < KORUPSI_SUCCESS_RATE) {
        player.cash += KORUPSI_STEAL_AMOUNT
        state.bank -= KORUPSI_STEAL_AMOUNT
        pushLog(state, `${player.name} pulled off korupsi (+${rupiah(KORUPSI_STEAL_AMOUNT)})`, player.id)
      } else {
        sendToJail(state, player)
        // Fine on top of jail. Can't-pay → elimination is handled later (TTG-16).
        player.cash -= KORUPSI_FINE
        state.bank += KORUPSI_FINE
        pushLog(
          state,
          `${player.name} was caught for korupsi — jailed and fined ${rupiah(KORUPSI_FINE)}`,
          player.id,
        )
      }
      state.turn.usedMetaAction = true
      return {}
    }

    case 'negotiate': {
      // Open-only: validate the target and signal intent. The structured deal
      // (propose/accept/reject/resolve) is TTG-8, so this does not consume the
      // per-turn meta action.
      const target = requireTargetPlayer(state, player.id, req.targetId)
      pushLog(state, `${player.name} wants to negotiate with ${target.name}`, player.id)
      return {}
    }

    default: {
      // Exhaustiveness guard.
      const _never: never = req.action
      throw new EngineError(`Unknown meta action "${String(_never)}"`)
    }
  }
}
