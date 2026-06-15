// Environment configuration with sensible local-dev defaults.
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL?.trim() || '',
  supabaseUrl: process.env.SUPABASE_URL?.trim() || '',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY?.trim() || '',
  roomTtlHours: Number(process.env.ROOM_TTL_HOURS ?? 24),
  // Allowed CORS origins for the client.
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
}

export const isDev = env.nodeEnv !== 'production'

/**
 * Fail fast on an unsafe CORS configuration in production. A wildcard or
 * localhost origin combined with credentialed realtime traffic would let any
 * site drive a player's session, so refuse to start rather than ship it.
 */
export function assertSafeCors(): void {
  if (isDev) return
  const origins = env.corsOrigins
  const unsafe =
    origins.length === 0 ||
    origins.some((o) => o === '*' || o.includes('localhost') || o.includes('127.0.0.1'))
  if (unsafe) {
    throw new Error(
      `Refusing to start: CORS_ORIGINS must be an explicit allowlist of your production origin(s) ` +
        `(got ${JSON.stringify(origins)}). Set CORS_ORIGINS, e.g. https://yourgame.example.`,
    )
  }
}
