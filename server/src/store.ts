// GameState persistence. Uses Redis when REDIS_URL is reachable, otherwise
// falls back to an in-memory Map so local dev needs no Docker.
import { Redis } from 'ioredis'
import type { GameState } from '@tuan-tanah/shared'
import { env } from './env.js'

export interface GameStore {
  readonly backend: 'redis' | 'memory'
  get(roomId: string): Promise<GameState | null>
  set(roomId: string, state: GameState): Promise<void>
  del(roomId: string): Promise<void>
  has(roomId: string): Promise<boolean>
}

const keyFor = (roomId: string) => `room:${roomId}`
const ttlSeconds = () => Math.max(1, env.roomTtlHours) * 3600

class MemoryStore implements GameStore {
  readonly backend = 'memory' as const
  private map = new Map<string, string>()

  async get(roomId: string): Promise<GameState | null> {
    const raw = this.map.get(keyFor(roomId))
    return raw ? (JSON.parse(raw) as GameState) : null
  }
  async set(roomId: string, state: GameState): Promise<void> {
    this.map.set(keyFor(roomId), JSON.stringify(state))
  }
  async del(roomId: string): Promise<void> {
    this.map.delete(keyFor(roomId))
  }
  async has(roomId: string): Promise<boolean> {
    return this.map.has(keyFor(roomId))
  }
}

class RedisStore implements GameStore {
  readonly backend = 'redis' as const
  constructor(private redis: Redis) {}

  async get(roomId: string): Promise<GameState | null> {
    const raw = await this.redis.get(keyFor(roomId))
    return raw ? (JSON.parse(raw) as GameState) : null
  }
  async set(roomId: string, state: GameState): Promise<void> {
    await this.redis.set(keyFor(roomId), JSON.stringify(state), 'EX', ttlSeconds())
  }
  async del(roomId: string): Promise<void> {
    await this.redis.del(keyFor(roomId))
  }
  async has(roomId: string): Promise<boolean> {
    return (await this.redis.exists(keyFor(roomId))) === 1
  }
}

export async function createStore(): Promise<GameStore> {
  if (!env.redisUrl) {
    console.log('[store] REDIS_URL not set — using in-memory store')
    return new MemoryStore()
  }
  try {
    const redis = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    })
    await redis.connect()
    await redis.ping()
    console.log('[store] connected to Redis')
    return new RedisStore(redis)
  } catch (err) {
    console.warn(
      '[store] Redis unavailable, falling back to in-memory store:',
      (err as Error).message,
    )
    return new MemoryStore()
  }
}
