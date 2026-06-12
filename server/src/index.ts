// Tuan Tanah backend — Fastify (HTTP) + Socket.io (realtime) bootstrap.
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@tuan-tanah/shared'
import { env, isDev } from './env.js'
import { registerGameHandlers } from './handlers/game.js'
import { registerLobbyHandlers } from './handlers/lobby.js'
import { createStore } from './store.js'

async function main() {
  const store = await createStore()

  const app = Fastify({ logger: { level: isDev ? 'info' : 'warn' } })
  await app.register(cors, { origin: env.corsOrigins })

  app.get('/api/health', async () => ({
    status: 'ok',
    store: store.backend,
    uptime: process.uptime(),
  }))

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins },
  })

  io.on('connection', (socket) => {
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
