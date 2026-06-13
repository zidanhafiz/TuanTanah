import {
  ALL_ROLES,
  ROLES,
  STARTING_CASH_MAX,
  STARTING_CASH_MIN,
  TARGET_WEALTH_MAX,
  TARGET_WEALTH_MIN,
  TARGET_WEALTH_STEP,
  TIME_LIMIT_OPTIONS,
  WIN_CONDITIONS,
  type Role,
} from '@tuan-tanah/shared'
import { useTranslation } from 'react-i18next'
import { roleAbility, roleName } from '../i18n/gameData.js'
import { LanguageSwitcher } from '../components/LanguageSwitcher.js'
import { LeaveButton, ShareLinkButton } from '../components/RoomActions.js'
import { Badge, Button, Card } from '../components/ui/index.js'
import { formatRupiah, useGame } from '../store/gameStore.js'

export function Lobby() {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const pickRole = useGame((s) => s.pickRole)
  const updateSettings = useGame((s) => s.updateSettings)
  const startGame = useGame((s) => s.startGame)

  if (!state) return <Centered>{t('lobby.loading')}</Centered>

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
          <div className="-rotate-1">
            <h1 className="inline-block rounded-xl border-2 border-ink bg-accent px-4 py-1 font-display text-3xl uppercase tracking-tight text-ink shadow-brutal">
              {t('lobby.title')}
            </h1>
          </div>
          <p className="mt-3 font-semibold text-ink-muted">{t('lobby.subtitle')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LanguageSwitcher />
          <Card tone="sunken" className="px-5 py-3 text-center">
            <div className="text-xs font-bold uppercase text-ink-faint">{t('lobby.roomCode')}</div>
            <div className="font-mono text-2xl font-bold tracking-[0.3em] text-ink">
              {state.roomId}
            </div>
          </Card>
          <div className="flex gap-2">
            <ShareLinkButton code={state.roomId} />
            <LeaveButton label={t('lobby.leaveRoom')} />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
        {/* Roles grid */}
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase text-ink-muted">{t('lobby.roles')}</h2>
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
                  className={`rounded-xl border-2 border-ink p-3 text-left transition ${
                    mine
                      ? 'bg-accent-soft shadow-brutal'
                      : takenByOther || !enabled
                        ? 'bg-surface-sunken opacity-50'
                        : 'bg-surface shadow-brutal-sm brutal-press'
                  }`}
                >
                  <div className="font-bold text-ink">{roleName(t, role)}</div>
                  <div className="text-[11px] text-ink-muted">
                    {t('lobby.salary', { amount: formatRupiah(def.salary) })}
                  </div>
                  <div className="mt-1 text-[11px] leading-tight text-ink-faint">
                    {roleAbility(t, role)}
                  </div>
                  {owner && (
                    <div className="mt-2">
                      <Badge color={owner.color}>{mine ? t('common.you') : owner.name}</Badge>
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
            <h2 className="mb-2 text-sm font-bold uppercase text-ink-muted">
              {t('lobby.players', { count: state.players.length })}
            </h2>
            <ul className="space-y-1">
              {state.players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border-2 border-ink bg-surface px-3 py-2 text-sm shadow-brutal-sm"
                >
                  <span
                    className="h-3 w-3 rounded-full border-2 border-ink"
                    style={{ background: p.color }}
                  />
                  <span className="font-bold text-ink">{p.name}</span>
                  {p.isRoomMaster && (
                    <Badge tone="accent" className="text-[10px]">
                      ★ {t('common.host')}
                    </Badge>
                  )}
                  {!p.isConnected && (
                    <Badge tone="danger" className="text-[10px]">
                      {t('common.offline')}
                    </Badge>
                  )}
                  <span className="ml-auto text-xs font-medium text-ink-muted">
                    {p.role ? roleName(t, p.role) : t('common.dash')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-bold uppercase text-ink-muted">
              {t('lobby.startingCash')}
            </h2>
            <div className="text-lg font-bold text-ink">
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
                className="mt-2 w-full accent-accent-strong"
              />
            )}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-bold uppercase text-ink-muted">
              {t('lobby.winCondition')}
            </h2>
            <div className="grid grid-cols-3 gap-1">
              {WIN_CONDITIONS.map((wc) => {
                const active = state.settings.winCondition === wc
                return (
                  <button
                    key={wc}
                    disabled={!isMaster}
                    onClick={() => updateSettings({ winCondition: wc })}
                    className={`rounded-lg border-2 border-ink py-1.5 text-xs font-bold transition ${
                      active
                        ? 'bg-accent text-ink shadow-brutal-sm'
                        : 'bg-surface-sunken text-ink-muted enabled:hover:bg-surface disabled:opacity-60'
                    }`}
                  >
                    {t(`lobby.winConditions.${wc}`)}
                  </button>
                )
              })}
            </div>
          </div>

          {showTime && (
            <div>
              <h2 className="mb-2 text-sm font-bold uppercase text-ink-muted">
                {t('lobby.timeLimit')}
              </h2>
              <div className="grid grid-cols-4 gap-1">
                {TIME_LIMIT_OPTIONS.map((min) => {
                  const active = state.settings.timeLimitMinutes === min
                  return (
                    <button
                      key={min}
                      disabled={!isMaster}
                      onClick={() => updateSettings({ timeLimitMinutes: min })}
                      className={`rounded-lg border-2 border-ink py-1.5 text-xs font-bold transition ${
                        active
                          ? 'bg-accent text-ink shadow-brutal-sm'
                          : 'bg-surface-sunken text-ink-muted enabled:hover:bg-surface disabled:opacity-60'
                      }`}
                    >
                      {t('lobby.timeLimitValue', { count: min })}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {showWealth && (
            <div>
              <h2 className="mb-2 text-sm font-bold uppercase text-ink-muted">
                {t('lobby.targetWealth')}
              </h2>
              <div className="text-lg font-bold text-ink">
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
                  className="mt-2 w-full accent-accent-strong"
                />
              )}
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-bold uppercase text-ink-muted">
              {t('lobby.enabledRoles')}
            </h2>
            <ul className="space-y-1">
              {ALL_ROLES.map((role) => {
                const enabled = state.settings.enabledRoles.includes(role)
                return (
                  <li key={role}>
                    <label
                      className={`flex items-center gap-2 rounded-lg border-2 border-ink bg-surface px-3 py-1.5 text-sm shadow-brutal-sm ${
                        isMaster ? 'cursor-pointer' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={!isMaster}
                        onChange={() =>
                          updateSettings({
                            enabledRoles: enabled
                              ? state.settings.enabledRoles.filter((r) => r !== role)
                              : [...state.settings.enabledRoles, role],
                          })
                        }
                        className="accent-accent-strong"
                      />
                      <span
                        className={enabled ? 'font-medium text-ink' : 'text-ink-faint line-through'}
                      >
                        {roleName(t, role)}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>

          {isMaster ? (
            <Button block size="lg" disabled={!canStart} onClick={startGame}>
              {everyoneReady ? t('lobby.startGame') : t('lobby.waitingForRoles')}
            </Button>
          ) : (
            <Card tone="sunken" flat className="p-3 text-center text-sm font-medium text-ink-muted">
              {t('lobby.waitingForHost')}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center font-semibold text-ink-muted">
      {children}
    </div>
  )
}
