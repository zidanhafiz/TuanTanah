import { useState } from 'react'
import { useGame } from '../store/gameStore.js'

export function Home() {
  const join = useGame((s) => s.join)
  const joining = useGame((s) => s.joining)
  const connected = useGame((s) => s.connected)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const canSubmit = name.trim().length > 0 && connected && !joining

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-5xl font-black tracking-tight text-amber-400">Tuan Tanah</h1>
      <p className="mt-2 text-slate-400">Monopoli rasa Indonesia 🇮🇩</p>

      <div className="mt-10 w-full max-w-sm space-y-4 rounded-2xl bg-slate-800/60 p-6 shadow-xl">
        <label className="block">
          <span className="text-sm text-slate-300">Your name</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 outline-none focus:border-amber-400"
            value={name}
            maxLength={20}
            placeholder="e.g. Budi"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <button
          disabled={!canSubmit}
          onClick={() => join(name)}
          className="w-full rounded-lg bg-amber-500 py-2.5 font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create new room
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-700" /> or join <span className="h-px flex-1 bg-slate-700" />
        </div>

        <div className="flex gap-2">
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 uppercase tracking-widest outline-none focus:border-amber-400"
            value={code}
            maxLength={6}
            placeholder="ROOM CODE"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            disabled={!canSubmit || code.trim().length < 4}
            onClick={() => join(name, code.trim())}
            className="shrink-0 rounded-lg bg-slate-600 px-4 font-semibold transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        {connected ? 'Connected to server' : 'Connecting…'}
      </p>
    </div>
  )
}
