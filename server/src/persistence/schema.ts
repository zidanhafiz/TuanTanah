// Kysely table types for the self-hosted Postgres game-history archive. These
// mirror the migration in ./migrations. Money columns are bigint in Postgres
// (rupiah can exceed int4) but are insert-only here, so a plain `number` suffices.
import type { Generated } from 'kysely'

export interface GamesTable {
  id: Generated<number>
  room_id: string
  winner_id: string
  win_condition: string | null
  duration_seconds: number | null
  player_count: number
  created_at: Generated<Date>
}

export interface GamePlayersTable {
  id: Generated<number>
  game_id: number
  player_id: string
  role: string
  final_cash: number
  final_wealth: number
  eliminated: boolean
}

export interface Database {
  games: GamesTable
  game_players: GamePlayersTable
}
