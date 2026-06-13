import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Card } from '../components/ui/index.js'
import { useGame } from '../store/gameStore.js'
import { Game } from './Game.js'
import { Lobby } from './Lobby.js'

/**
 * Resolves a `/room/:roomId` URL into the right view:
 *  - seated in this room → render Lobby/Game (chosen by server-owned phase),
 *  - an auto-rejoin is in flight → show a reconnecting state,
 *  - otherwise → a join form pre-filled with the room code.
 *
 * The URL only identifies *which* room; the lobby-vs-game choice stays driven by
 * `state.phase` so the authoritative server always decides what's happening.
 */
export function RoomGate() {
  const params = useParams()
  const urlRoomId = (params.roomId ?? '').toUpperCase()
  const storeRoomId = useGame((s) => s.roomId)
  const phase = useGame((s) => s.state?.phase)
  const rejoining = useGame((s) => s.rejoining)

  if (storeRoomId === urlRoomId) {
    if (phase === 'lobby' || phase === undefined) return <Lobby />
    return <Game />
  }

  if (rejoining) return <Reconnecting />

  return <JoinRoomForm code={urlRoomId} />
}

function Reconnecting() {
  const connected = useGame((s) => s.connected)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-ink-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink border-t-accent" />
      <p className="font-semibold">
        {connected ? 'Reconnecting to your game…' : 'Connecting to server…'}
      </p>
    </div>
  )
}

function JoinRoomForm({ code }: { code: string }) {
  const join = useGame((s) => s.join)
  const joining = useGame((s) => s.joining)
  const connected = useGame((s) => s.connected)
  const error = useGame((s) => s.error)
  const [name, setName] = useState('')

  const canSubmit = name.trim().length > 0 && connected && !joining
  const submit = () => {
    if (canSubmit) join(name, code)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="-rotate-1">
        <h1 className="rounded-xl border-2 border-ink bg-accent px-6 py-2 font-display text-4xl uppercase tracking-tight text-ink shadow-brutal-lg">
          Tuan Tanah
        </h1>
      </div>
      <p className="mt-4 font-semibold text-ink-muted">You&apos;ve been invited to a room</p>

      <Card className="mt-8 w-full max-w-sm space-y-4 p-6">
        <Card tone="sunken" flat className="px-4 py-3 text-center">
          <div className="text-xs font-bold uppercase text-ink-faint">Room code</div>
          <div className="font-mono text-2xl font-bold tracking-[0.3em] text-ink">{code}</div>
        </Card>

        {error && (
          <Card tone="danger" flat className="px-3 py-2 text-center text-sm font-semibold text-ink">
            {error}
          </Card>
        )}

        <label className="block">
          <span className="text-sm font-bold text-ink">Your name</span>
          <input
            className="mt-1 w-full rounded-lg border-2 border-ink bg-surface px-3 py-2 font-medium outline-none transition focus:shadow-brutal-sm"
            value={name}
            maxLength={20}
            placeholder="e.g. Budi"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>

        <Button block disabled={!canSubmit} onClick={submit}>
          {joining ? 'Joining…' : 'Join room'}
        </Button>

        <Link to="/" className="block text-center text-xs font-bold text-ink-muted hover:text-ink">
          ← Back home
        </Link>
      </Card>
    </div>
  )
}
