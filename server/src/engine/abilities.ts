// Player-triggered, once-per-game role abilities (Influencer, Pejabat).
// Pure engine logic — throws EngineError on invalid input.
import { INFLUENCER_BOOST_MULTIPLIER, INFLUENCER_BOOST_ROUNDS } from '@tuan-tanah/shared'
import type { AbilityType, GameState } from '@tuan-tanah/shared'
import { EngineError, requireTurn } from './index.js'
import { pushLog, uid } from './util.js'

/** Use the current player's once-per-game role ability. Mutates state in place. */
export function useAbility(state: GameState, playerId: string, ability: AbilityType): void {
  const player = requireTurn(state, playerId)
  if (player.usedAbility) throw new EngineError('You have already used your ability this game')

  switch (ability) {
    case 'viral_boost': {
      if (player.role !== 'influencer') throw new EngineError('Only the Influencer can do that')
      state.activeEffects.push({
        id: uid(),
        type: 'passive_multiplier',
        targetPlayerId: player.id,
        multiplier: INFLUENCER_BOOST_MULTIPLIER,
        roundsRemaining: INFLUENCER_BOOST_ROUNDS,
        sourceCard: 'ability_viral_boost',
      })
      player.usedAbility = true
      pushLog(
        state,
        `${player.name} went viral — ${INFLUENCER_BOOST_MULTIPLIER}× passive income for ${INFLUENCER_BOOST_ROUNDS} rounds`,
        player.id,
      )
      return
    }

    case 'block_kejadian': {
      if (player.role !== 'pejabat') throw new EngineError('Only the Pejabat can do that')
      state.pendingKejadianBlock = true
      player.usedAbility = true
      pushLog(state, `${player.name} armed a block on the next Kejadian card`, player.id)
      return
    }

    default: {
      const _never: never = ability
      throw new EngineError(`Unknown ability "${String(_never)}"`)
    }
  }
}
