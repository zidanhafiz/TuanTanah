// Environment configuration with sensible local-dev defaults.
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL?.trim() || '',
  supabaseUrl: process.env.SUPABASE_URL?.trim() || '',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY?.trim() || '',
  roomTtlHours: Number(process.env.ROOM_TTL_HOURS ?? 24),
  maxPlayers: Number(process.env.MAX_PLAYERS_PER_ROOM ?? 8),
  // Allowed CORS origins for the dev client.
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
}

export const isDev = env.nodeEnv !== 'production'
