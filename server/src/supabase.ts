// Supabase client — deferred for the MVP. Returns null when unconfigured so the
// rest of the app can no-op gracefully.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { GameState } from '@tuan-tanah/shared'
import { playerWealth } from './engine/index.js'
import { env } from './bootstrap/env.js'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseKey) return null
  if (!client) client = createClient(env.supabaseUrl, env.supabaseKey)
  return client
}

/**
 * Persist a finished game's stats to Supabase (tech doc §9: `games` +
 * `game_players`). Silently no-ops when Supabase is unconfigured, and never
 * throws — persistence failures must not disrupt the live game. `now` is the
 * game-over wall-clock (epoch ms), used to compute the play duration.
 */
export async function persistGameResult(state: GameState, now: number): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  if (!state.winner) return

  try {
    const { data, error } = await supabase
      .from('games')
      .insert({
        room_id: state.roomId,
        winner_id: state.winner,
        win_condition: state.winReason ?? null,
        duration_seconds: state.startedAt ? Math.round((now - state.startedAt) / 1000) : null,
        player_count: state.players.length,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.warn('[supabase] failed to insert game row:', error?.message ?? 'no row returned')
      return
    }

    const rows = state.players.map((p) => ({
      game_id: data.id,
      player_id: p.id,
      role: p.role ?? 'unknown',
      final_cash: p.cash,
      final_wealth: playerWealth(state, p),
      eliminated: p.isEliminated,
    }))

    const { error: playersError } = await supabase.from('game_players').insert(rows)
    if (playersError) {
      console.warn('[supabase] failed to insert game_players rows:', playersError.message)
    }
  } catch (err) {
    console.warn('[supabase] error persisting game result:', (err as Error).message)
  }
}
