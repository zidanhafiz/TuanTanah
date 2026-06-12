// Supabase client — deferred for the MVP. Returns null when unconfigured so the
// rest of the app can no-op gracefully.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env.js'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseKey) return null
  if (!client) client = createClient(env.supabaseUrl, env.supabaseKey)
  return client
}
