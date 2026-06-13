import {
  ALL_ROLES,
  ROLES,
  STARTING_CASH_MAX,
  STARTING_CASH_MIN,
  TARGET_WEALTH_MAX,
  TARGET_WEALTH_MIN,
  TARGET_WEALTH_STEP,
  TIME_LIMIT_OPTIONS,
  type Role,
  type WinCondition,
} from '@tuan-tanah/shared'
import { formatRupiah, useGame } from '../store/gameStore.js'

export function Lobby() {
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const pickRole = useGame((s) => s.pickRole)
  const updateSettings = useGame((s) => s.updateSettings)
  const startGame = useGame((s) => s.startGame)

  if (!state) return <Centered>Loading lobby…</Centered>

  const isMaster = !!me?.isRoomMaster
  const roleOwner = (role: Role) => state.players.find((p) => p.role === role)
  const everyoneReady = state.players.every((p) => p.role !== null)
  const canStart = isMaster && state.players.length >= 2 && everyoneReady
  const { winCondition } = state.settings
  const showTime = winCondition === 'time' || winCondition === 'both'
  const showWealth = winCondition === 'wealth' || winCondition === 'both'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-amber-400">Lobby</h1>
          <p className="text-slate-400">Pick a role and wait for the room master to start.</p>
        </div>
        <div className="rounded-xl bg-slate-800 px-5 py-3 text-center">
          <div className="text-xs uppercase text-slate-400">Room code</div>
          <div className="font-mono text-2xl font-bold tracking-[0.3em] text-amber-300">
            {state.roomId}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
        {/* Roles grid */}
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase text-slate-400">Roles</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_ROLES.map((role) => {
              const def = ROLES[role]
              const owner = roleOwner(role)
              const enabled = state.settings.enabledRoles.includes(role)
              const mine = owner?.id === me?.id
              const takenByOther = owner && !mine
              return (
                <button
                  key={role}
                  disabled={!enabled || !!takenByOther}
                  onClick={() => pickRole(mine ? null : role)}
                  className={`rounded-xl border p-3 text-left transition ${
                    mine
                      ? 'border-amber-400 bg-amber-500/20'
                      : takenByOther || !enabled
                        ? 'border-slate-700 bg-slate-800/40 opacity-50'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                  }`}
                >
                  <div className="font-semibold">{def.name}</div>
                  <div className="text-[11px] text-slate-400">Gaji {formatRupiah(def.salary)}</div>
                  <div className="mt-1 text-[11px] leading-tight text-slate-500">{def.ability}</div>
                  {owner && (
                    <div className="mt-2 text-[11px] font-medium" style={{ color: owner.color }}>
                      {mine ? 'You' : owner.name}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Players + settings */}
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase text-slate-400">
              Players ({state.players.length})
            </h2>
            <ul className="space-y-1">
              {state.players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm"
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                  <span className="font-medium">{p.name}</span>
                  {p.isRoomMaster && <span className="text-[10px] text-amber-400">★ host</span>}
                  {!p.isConnected && <span className="text-[10px] text-red-400">offline</span>}
                  <span className="ml-auto text-xs text-slate-400">
                    {p.role ? ROLES[p.role].name : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase text-slate-400">Starting cash</h2>
            <div className="text-lg font-bold text-amber-300">
              {formatRupiah(state.settings.startingCash)}
            </div>
            {isMaster && (
              <input
                type="range"
                min={STARTING_CASH_MIN}
                max={STARTING_CASH_MAX}
                step={1_000_000}
                value={state.settings.startingCash}
                onChange={(e) => updateSettings({ startingCash: Number(e.target.value) })}
                className="mt-2 w-full accent-amber-400"
              />
            )}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase text-slate-400">Win condition</h2>
            <div className="grid grid-cols-3 gap-1">
              {(['time', 'wealth', 'both'] as WinCondition[]).map((wc) => {
                const active = state.settings.winCondition === wc
                return (
                  <button
                    key={wc}
                    disabled={!isMaster}
                    onClick={() => updateSettings({ winCondition: wc })}
                    className={`rounded-lg py-1.5 text-xs font-semibold capitalize transition ${
                      active
                        ? 'bg-amber-500 text-slate-900'
                        : 'bg-slate-800 text-slate-300 enabled:hover:bg-slate-700 disabled:opacity-60'
                    }`}
                  >
                    {wc}
                  </button>
                )
              })}
            </div>
          </div>

          {showTime && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase text-slate-400">Time limit</h2>
              <div className="grid grid-cols-4 gap-1">
                {TIME_LIMIT_OPTIONS.map((min) => {
                  const active = state.settings.timeLimitMinutes === min
                  return (
                    <button
                      key={min}
                      disabled={!isMaster}
                      onClick={() => updateSettings({ timeLimitMinutes: min })}
                      className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-slate-800 text-slate-300 enabled:hover:bg-slate-700 disabled:opacity-60'
                      }`}
                    >
                      {min}m
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {showWealth && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase text-slate-400">Target wealth</h2>
              <div className="text-lg font-bold text-amber-300">
                {formatRupiah(state.settings.targetWealth ?? TARGET_WEALTH_MIN)}
              </div>
              {isMaster && (
                <input
                  type="range"
                  min={TARGET_WEALTH_MIN}
                  max={TARGET_WEALTH_MAX}
                  step={TARGET_WEALTH_STEP}
                  value={state.settings.targetWealth ?? TARGET_WEALTH_MIN}
                  onChange={(e) => updateSettings({ targetWealth: Number(e.target.value) })}
                  className="mt-2 w-full accent-amber-400"
                />
              )}
            </div>
          )}

          {isMaster ? (
            <button
              disabled={!canStart}
              onClick={startGame}
              className="w-full rounded-lg bg-amber-500 py-3 font-bold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {everyoneReady ? 'Start game' : 'Waiting for roles…'}
            </button>
          ) : (
            <p className="rounded-lg bg-slate-800 p-3 text-center text-sm text-slate-400">
              Waiting for the host to start…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-400">{children}</div>
  )
}
