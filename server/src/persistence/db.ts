// Kysely Postgres client. Lazily constructed and returns null when DATABASE_URL
// is unset, so game-history persistence silently no-ops (same opt-in behaviour the
// Supabase client had). Live game state lives in Redis/memory — this is durable
// archival only.
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { env } from '../bootstrap/env.js'
import type { Database } from './schema.js'

let db: Kysely<Database> | null = null

export function getDb(): Kysely<Database> | null {
  if (!env.databaseUrl) return null
  if (!db) {
    const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 4 })
    db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  }
  return db
}

/** Close the pool (used by the migration CLI; the long-lived server leaves it open). */
export async function closeDb(): Promise<void> {
  if (db) {
    await db.destroy()
    db = null
  }
}
