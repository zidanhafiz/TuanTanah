// Migration CLI: `pnpm --filter server migrate` (latest) or `... migrate down`.
// Uses Kysely's Migrator + FileMigrationProvider against ./migrations. No-ops with
// a clear message when DATABASE_URL is unset.
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FileMigrationProvider, Migrator } from 'kysely/migration'
import { closeDb, getDb } from './db.js'

const db = getDb()
if (!db) {
  console.error('[migrate] DATABASE_URL is not set — nothing to migrate.')
  process.exit(1)
}

const migrationFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')
const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({ fs, path, migrationFolder }),
})

const direction = process.argv[2] === 'down' ? 'down' : 'latest'
const { error, results } =
  direction === 'down' ? await migrator.migrateDown() : await migrator.migrateToLatest()

for (const r of results ?? []) {
  const verb = r.status === 'Success' ? 'applied' : r.status === 'Error' ? 'FAILED' : 'skipped'
  console.log(`[migrate] ${verb}: ${r.migrationName} (${direction})`)
}

await closeDb()

if (error) {
  console.error('[migrate] failed:', error)
  process.exit(1)
}
console.log('[migrate] done.')
