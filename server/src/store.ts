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
  // Mirror Redis `SET ... EX` semantics so abandoned rooms can't accumulate
  // forever (which would be an unbounded memory leak / DoS surface). TTL is
  // refreshed on every set, and entries expire lazily on read plus an hourly
  // sweep.
  private map = new Map<string, { raw: string; expires: number }>()

  constructor() {
    const sweeper = setInterval(() => this.sweep(), 60 * 60 * 1000)
    sweeper.unref?.()
  }

  private sweep(): void {
    const now = Date.now()
    for (const [key, entry] of this.map) {
      if (entry.expires <= now) this.map.delete(key)
    }
  }

  private live(roomId: string): { raw: string; expires: number } | null {
    const key = keyFor(roomId)
    const entry = this.map.get(key)
    if (!entry) return null
    if (entry.expires <= Date.now()) {
      this.map.delete(key)
      return null
    }
    return entry
  }

  async get(roomId: string): Promise<GameState | null> {
    const entry = this.live(roomId)
    return entry ? (JSON.parse(entry.raw) as GameState) : null
  }
  async set(roomId: string, state: GameState): Promise<void> {
    this.map.set(keyFor(roomId), {
      raw: JSON.stringify(state),
      expires: Date.now() + ttlSeconds() * 1000,
    })
  }
  async del(roomId: string): Promise<void> {
    this.map.delete(keyFor(roomId))
  }
  async has(roomId: string): Promise<boolean> {
    return this.live(roomId) !== null
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
