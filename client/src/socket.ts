// Socket.io client singleton. In dev, the Vite proxy forwards /socket.io to the
// backend; in prod, nginx does. Set VITE_SERVER_URL to point elsewhere.
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@tuan-tanah/shared'

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const url = import.meta.env.VITE_SERVER_URL || undefined

export const socket: ClientSocket = io(url, {
  path: '/socket.io',
  autoConnect: true,
  transports: ['websocket', 'polling'],
})
