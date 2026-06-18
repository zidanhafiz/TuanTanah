// Socket.io client singleton. In dev, the Vite proxy forwards /socket.io to the
// backend; in prod, Caddy does. Set VITE_SERVER_URL to point elsewhere.
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@tuan-tanah/shared'

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const url = import.meta.env.VITE_SERVER_URL || undefined

const opts = { path: '/socket.io', transports: ['websocket', 'polling'] }

export const socket: ClientSocket = io(url, { ...opts, autoConnect: true })

/**
 * Open an additional, fully independent connection — its own server-side session
 * (socket.id → player). Used by the dev hotseat page to control several players
 * from one tab. `forceNew` is essential: without it socket.io reuses the cached
 * Manager and hands back the same underlying connection, so the server would see
 * a single session and per-player identity would collapse.
 */
export function createSocket(): ClientSocket {
  return io(url, { ...opts, autoConnect: true, forceNew: true })
}

// Which connection in-game actions emit through. Defaults to the singleton, so
// production (one player per tab) is unaffected; the hotseat page repoints this
// as it switches the controlled seat.
let active: ClientSocket = socket
export const getActiveSocket = (): ClientSocket => active
export const setActiveSocket = (s: ClientSocket): void => {
  active = s
}
