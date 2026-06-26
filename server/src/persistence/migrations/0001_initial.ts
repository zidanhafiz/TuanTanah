// Initial schema: the game-history archive (`games` + `game_players`). Encodes the
// tables that were previously Supabase-only and un-versioned.
import { type Kysely, sql } from 'kysely'

// DDL is schema-agnostic, so the migration takes an untyped Kysely handle.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('games')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('room_id', 'text', (c) => c.notNull())
    .addColumn('winner_id', 'text', (c) => c.notNull())
    .addColumn('win_condition', 'text')
    .addColumn('duration_seconds', 'integer')
    .addColumn('player_count', 'integer', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createTable('game_players')
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('game_id', 'integer', (c) => c.notNull().references('games.id').onDelete('cascade'))
    .addColumn('player_id', 'text', (c) => c.notNull())
    .addColumn('role', 'text', (c) => c.notNull())
    .addColumn('final_cash', 'bigint', (c) => c.notNull())
    .addColumn('final_wealth', 'bigint', (c) => c.notNull())
    .addColumn('eliminated', 'boolean', (c) => c.notNull())
    .execute()

  await db.schema
    .createIndex('game_players_game_id_idx')
    .on('game_players')
    .column('game_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('game_players').ifExists().execute()
  await db.schema.dropTable('games').ifExists().execute()
}
