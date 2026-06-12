// Maps a live socket connection to its room + player identity.
export interface Session {
  roomId: string
  playerId: string
}

const sessions = new Map<string, Session>()

export function setSession(socketId: string, session: Session): void {
  sessions.set(socketId, session)
}

export function getSession(socketId: string): Session | undefined {
  return sessions.get(socketId)
}

export function clearSession(socketId: string): void {
  sessions.delete(socketId)
}
