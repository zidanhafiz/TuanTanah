import { BOARD, type TileId } from '@tuan-tanah/shared'
import { useEffect, useState } from 'react'
import { useGame } from '@/store/gameStore.js'
import { Badge, Button, Card } from '@/components/ui/index.js'
import { Game } from './Game.js'
import { Lobby } from './Lobby.js'

/**
 * DEV-only hotseat (pass-and-play) harness. The socket/store are singletons, so
 * instead of faking multiple players we open one real connection per player from
 * this single tab (see `hotseatAddPlayer` in the store) and render the actual
 * production <Lobby/> / <Game/> off the shared broadcast state.
 *
 * A "control identity" decides which seat our clicks act as. It auto-follows the
 * current player when a turn ends (`autoFollowTurn`), and the seat switcher lets
 * you manually take over any player — needed to cast Pemilu votes or respond to
 * a negotiation deal aimed at someone other than the current player. Reachable
 * only at `/dev` in dev builds.
 */

const MAX_PLAYERS = 8

export function DevMultiplayer() {
  const enableHotseat = useGame((s) => s.enableHotseat)
  const hotseatAddPlayer = useGame((s) => s.hotseatAddPlayer)
  const selectSeat = useGame((s) => s.selectSeat)
  const devTeleport = useGame((s) => s.devTeleport)
  const hotseatReset = useGame((s) => s.hotseatReset)
  const seats = useGame((s) => s.seats)
  const activeSeatId = useGame((s) => s.activeSeatId)
  const autoFollowTurn = useGame((s) => s.autoFollowTurn)
  const state = useGame((s) => s.state)
  const roomId = useGame((s) => s.roomId)
  const connected = useGame((s) => s.connected)
  const joining = useGame((s) => s.joining)

  const [name, setName] = useState('')
  const [teleportTile, setTeleportTile] = useState(0)

  useEffect(() => {
    enableHotseat()
  }, [enableHotseat])

  const playing = state?.phase === 'playing'
  const currentId = playing ? (state?.players[state.currentPlayerIndex]?.id ?? null) : null
  // `joining` covers the seat-1 create; extra seats join near-instantly.
  const canAdd = connected && !joining && seats.length < MAX_PLAYERS

  const addPlayer = () => {
    const trimmed = name.trim()
    if (!trimmed || !canAdd) return
    hotseatAddPlayer(trimmed)
    setName('')
  }

  // Teleport always applies to the current player (the server requires it), so
  // take over their seat first, then send the jump.
  const goToTile = () => {
    if (!playing || currentId == null) return
    selectSeat(currentId)
    devTeleport(teleportTile as TileId)
  }

  const setAutoFollow = (on: boolean) => {
    useGame.setState({ autoFollowTurn: on })
    // Snap to the current player immediately when re-enabling, rather than
    // waiting for the next turn change.
    if (on && currentId) selectSeat(currentId)
  }

  const displayName = (playerId: string, fallback: string) =>
    state?.players.find((p) => p.id === playerId)?.name ?? fallback

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 border-b-2 border-ink bg-surface-sunken/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <span className="font-display text-lg uppercase tracking-tight text-ink">
            Dev Hotseat
          </span>

          <div className="flex items-center gap-2">
            <input
              value={name}
              maxLength={20}
              placeholder={`Player ${seats.length + 1}`}
              disabled={!canAdd}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
              className="w-32 rounded-lg border-2 border-ink bg-surface px-2 py-1 text-sm font-medium outline-none focus:shadow-brutal-sm disabled:opacity-50"
            />
            <Button size="sm" onClick={addPlayer} disabled={!canAdd || name.trim().length === 0}>
              Add player
            </Button>
          </div>

          {seats.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold uppercase text-ink-faint">Control</span>
              {seats.map((seat) => {
                const active = seat.playerId === activeSeatId
                return (
                  <button
                    key={seat.playerId}
                    onClick={() => selectSeat(seat.playerId)}
                    className={`flex items-center gap-1.5 rounded-lg border-2 border-ink px-2 py-1 text-sm font-bold transition ${
                      active ? 'bg-accent text-ink shadow-brutal-sm' : 'bg-surface text-ink-muted'
                    }`}
                  >
                    {seat.playerId === currentId && (
                      <span className="h-2 w-2 rounded-full border border-ink bg-success" />
                    )}
                    {displayName(seat.playerId, seat.name)}
                  </button>
                )
              })}
            </div>
          )}

          <label className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <input
              type="checkbox"
              checked={autoFollowTurn}
              onChange={(e) => setAutoFollow(e.target.checked)}
            />
            Auto-follow turn
          </label>

          {playing && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase text-ink-faint">Teleport</span>
              <select
                value={teleportTile}
                onChange={(e) => setTeleportTile(Number(e.target.value))}
                className="max-w-[12rem] rounded-lg border-2 border-ink bg-surface px-2 py-1 text-sm font-medium outline-none focus:shadow-brutal-sm"
              >
                {BOARD.map((def, id) => (
                  <option key={id} value={id}>
                    {id} · {def.name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="info" onClick={goToTile} disabled={currentId == null}>
                Go
              </Button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            {roomId && (
              <span className="text-sm font-bold text-ink">
                Room <span className="font-mono tracking-[0.2em]">{roomId}</span>
              </span>
            )}
            <Button size="sm" variant="danger" onClick={hotseatReset} disabled={seats.length === 0}>
              Reset
            </Button>
          </div>
        </div>
      </div>

      {seats.length === 0 ? (
        <Card tone="sunken" flat className="m-4 p-8 text-center font-semibold text-ink-muted">
          Add 2–8 players to begin. The first player creates the room and is the{' '}
          <span className="font-bold text-ink">room master</span> — pick each player&apos;s role by
          selecting their control button, then start the game while controlling player&nbsp;1.
        </Card>
      ) : (
        <div className="relative">
          {seats.length > 0 && (
            <Badge className="absolute right-3 top-3 z-20">
              Controlling: {displayName(activeSeatId ?? '', '—')}
            </Badge>
          )}
          {playing ? <Game /> : <Lobby />}
        </div>
      )}
    </div>
  )
}
