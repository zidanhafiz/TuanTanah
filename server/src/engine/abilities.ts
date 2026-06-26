// Player-triggered, once-per-game role abilities (Influencer, Pejabat).
// Pure engine logic — throws EngineError on invalid input.
import { INFLUENCER_BOOST_MULTIPLIER, INFLUENCER_BOOST_ROUNDS } from '@tuan-tanah/shared'
import type { AbilityType, GameState } from '@tuan-tanah/shared'
import { EngineError, requireTurn } from './index.js'
import { logKey, uid } from './util.js'

/** Use the current player's once-per-game role ability. Mutates state in place. */
export function useAbility(state: GameState, playerId: string, ability: AbilityType): void {
  const player = requireTurn(state, playerId)
  if (player.usedAbility) throw new EngineError('abilities.alreadyUsed')

  switch (ability) {
    case 'viral_boost': {
      if (player.role !== 'influencer') throw new EngineError('abilities.onlyInfluencer')
      state.activeEffects.push({
        id: uid(),
        type: 'passive_multiplier',
        targetPlayerId: player.id,
        multiplier: INFLUENCER_BOOST_MULTIPLIER,
        roundsRemaining: INFLUENCER_BOOST_ROUNDS,
        sourceCard: 'ability_viral_boost',
      })
      player.usedAbility = true
      logKey(
        state,
        'abilities.viralBoost',
        {
          name: player.name,
          multiplier: INFLUENCER_BOOST_MULTIPLIER,
          rounds: INFLUENCER_BOOST_ROUNDS,
        },
        player.id,
      )
      return
    }

    case 'block_kejadian': {
      if (player.role !== 'pejabat') throw new EngineError('abilities.onlyPejabat')
      state.pendingKejadianBlock = true
      player.usedAbility = true
      logKey(state, 'abilities.blockKejadian', { name: player.name }, player.id)
      return
    }

    default: {
      const _never: never = ability
      throw new EngineError('abilities.unknownAbility', { name: String(_never) })
    }
  }
}
