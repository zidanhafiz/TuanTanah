import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-amber-400" />
      <p>{connected ? 'Reconnecting to your game…' : 'Connecting to server…'}</p>
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
      <h1 className="text-4xl font-black tracking-tight text-amber-400">Tuan Tanah</h1>
      <p className="mt-2 text-slate-400">You&apos;ve been invited to a room</p>

      <div className="mt-8 w-full max-w-sm space-y-4 rounded-2xl bg-slate-800/60 p-6 shadow-xl">
        <div className="rounded-xl bg-slate-900 px-4 py-3 text-center">
          <div className="text-xs uppercase text-slate-500">Room code</div>
          <div className="font-mono text-2xl font-bold tracking-[0.3em] text-amber-300">{code}</div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-200">
            {error}
          </div>
        )}

        <label className="block">
          <span className="text-sm text-slate-300">Your name</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 outline-none focus:border-amber-400"
            value={name}
            maxLength={20}
            placeholder="e.g. Budi"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>

        <button
          disabled={!canSubmit}
          onClick={submit}
          className="w-full rounded-lg bg-amber-500 py-2.5 font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {joining ? 'Joining…' : 'Join room'}
        </button>

        <Link to="/" className="block text-center text-xs text-slate-500 hover:text-slate-300">
          ← Back home
        </Link>
      </div>
    </div>
  )
}
