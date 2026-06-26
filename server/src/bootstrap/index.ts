// Tuan Tanah backend — Fastify (HTTP) + Socket.io (realtime) bootstrap.
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@tuan-tanah/shared'
import { assertSafeCors, env, isDev } from './env.js'
import { registerGameHandlers } from '../realtime/game.js'
import { registerLobbyHandlers } from '../realtime/lobby.js'
import { connectionGate, trackConnection } from '../security.js'
import { createStore } from '../rooms/store.js'

async function main() {
  assertSafeCors()
  const store = await createStore()

  // Cap request bodies — this API has no large-upload routes, so 64 KB is ample
  // and blocks oversized-payload memory abuse.
  const app = Fastify({ logger: { level: isDev ? 'info' : 'warn' }, bodyLimit: 64 * 1024 })
  await app.register(cors, { origin: env.corsOrigins })
  // Defence-in-depth rate limit for HTTP routes (room creation runs over the
  // socket layer, which has its own limiter in security.ts).
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  app.get('/api/health', async () => ({
    status: 'ok',
    store: store.backend,
    uptime: process.uptime(),
  }))

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins },
    // Tiny turn-based payloads — keep the inbound buffer small to bound memory.
    maxHttpBufferSize: 16 * 1024,
    connectTimeout: 20_000,
  })

  // Reject connections over the per-IP / global caps before wiring handlers.
  io.use(connectionGate)
  io.on('connection', (socket) => {
    trackConnection(socket)
    registerLobbyHandlers(io, socket, store)
    registerGameHandlers(io, socket, store)
  })

  await app.listen({ port: env.port, host: '0.0.0.0' })
  app.log.info(`Tuan Tanah server ready (store: ${store.backend})`)
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
