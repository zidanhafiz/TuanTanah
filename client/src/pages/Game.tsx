import {
  BOARD,
  REGIONS,
  ROLES,
  TRANSPORT_BUY_PRICE,
  type FinalStanding,
  type MetaActionType,
  type TileId,
} from '@tuan-tanah/shared'
import { useEffect, useState } from 'react'
import { AbilityBar } from '../components/AbilityBar/AbilityBar.js'
import { Board } from '../components/Board/Board.js'
import { DebtPanel } from '../components/DebtPanel/DebtPanel.js'
import { EventLog } from '../components/EventLog/EventLog.js'
import { MetaActionBar, type MetaActionDef } from '../components/MetaActionBar/MetaActionBar.js'
import { NegotiationModal } from '../components/NegotiationModal/NegotiationModal.js'
import { PinjolModal } from '../components/PinjolModal/PinjolModal.js'
import { PlayerPanel } from '../components/PlayerPanel/PlayerPanel.js'
import { PropertyModal } from '../components/PropertyModal/PropertyModal.js'
import { LeaveButton } from '../components/RoomActions.js'
import { Badge, Button, Card } from '../components/ui/index.js'
import { formatRupiah, useGame } from '../store/gameStore.js'

function basePrice(tileId: TileId): number {
  const def = BOARD[tileId]!
  if (def.type === 'transport') return TRANSPORT_BUY_PRICE
  return def.region ? REGIONS[def.region].buyPrice : 0
}

export function Game() {
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const isMyTurn = useGame((s) => s.isMyTurn)()
  const roll = useGame((s) => s.roll)
  const buy = useGame((s) => s.buy)
  const metaAction = useGame((s) => s.metaAction)
  const useAbility = useGame((s) => s.useAbility)
  const payJail = useGame((s) => s.payJail)
  const endTurn = useGame((s) => s.endTurn)
  const finalStandings = useGame((s) => s.finalStandings)

  const [pendingMeta, setPendingMeta] = useState<{
    action: MetaActionType
    target: 'player' | 'tile'
  } | null>(null)
  const [showPinjol, setShowPinjol] = useState(false)
  const [selectedTile, setSelectedTile] = useState<TileId | null>(null)
  const [showNegotiate, setShowNegotiate] = useState(false)

  const usedMetaAction = state?.turn.usedMetaAction ?? false
  // Clear any in-progress target selection when it's no longer actionable.
  useEffect(() => {
    if (!isMyTurn || usedMetaAction) setPendingMeta(null)
  }, [isMyTurn, usedMetaAction])

  if (!state) return null

  const { turn, phase } = state
  const pending = turn.pendingBuyTileId
  const current = state.players[state.currentPlayerIndex]
  const myDebt = me ? state.pendingDebts.find((d) => d.debtorId === me.id) : undefined
  // While any debt is unresolved the game is paused for everyone else.
  const debtor =
    state.pendingDebts.length > 0
      ? state.players.find((p) => p.id === state.pendingDebts[0]!.debtorId)
      : undefined

  const handlePickMeta = (def: MetaActionDef) => {
    if (def.target === 'none') {
      metaAction(def.action)
      setPendingMeta(null)
      return
    }
    const target = def.target
    setPendingMeta((cur) => (cur?.action === def.action ? null : { action: def.action, target }))
  }
  const handleSelectPlayer = (id: string) => {
    if (!pendingMeta) return
    metaAction(pendingMeta.action, id)
    setPendingMeta(null)
  }
  const handleSelectTile = (tileId: TileId) => {
    if (!pendingMeta) return
    metaAction(pendingMeta.action, undefined, tileId)
    setPendingMeta(null)
  }
  // Clicking a tile (when not selecting a meta-action target) opens its property modal.
  const handleTileClick =
    pendingMeta?.target === 'tile' ? handleSelectTile : (tileId: TileId) => setSelectedTile(tileId)

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 lg:flex-row">
      {/* Board */}
      <div className="flex flex-1 justify-center">
        <Board state={state} onSelectTile={handleTileClick} />
      </div>

      {/* Sidebar */}
      <aside className="flex w-full flex-col gap-4 lg:w-80">
        <Card className="p-3">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Room {state.roomId}</span>
            <span>Round {state.round}</span>
          </div>
          <div className="mt-2 flex justify-end">
            {phase === 'ended' ? (
              <LeaveButton label="Back home" />
            ) : (
              <LeaveButton
                confirm="Leave the game? You'll forfeit your properties and can't rejoin."
                label="Leave game"
              />
            )}
          </div>

          {phase === 'ended' ? (
            <Card tone="accent" flat className="mt-3 p-3 text-center">
              <div className="text-sm text-ink-muted">Winner</div>
              <div className="text-xl font-bold text-ink">
                {state.players.find((p) => p.id === state.winner)?.name ?? '—'}
              </div>
            </Card>
          ) : myDebt ? (
            <div className="mt-3">
              <DebtPanel debt={myDebt} onTakePinjol={() => setShowPinjol(true)} />
            </div>
          ) : debtor ? (
            <Card tone="danger" flat className="mt-3 py-3 text-center text-sm text-ink">
              Paused — waiting for{' '}
              <span className="font-semibold" style={{ color: debtor.color }}>
                {debtor.name}
              </span>{' '}
              to settle a debt…
            </Card>
          ) : (
            <div className="mt-3 space-y-2">
              {isMyTurn ? (
                <>
                  {me?.inJail && !turn.hasRolled && (
                    <Button variant="secondary" size="sm" block onClick={payJail}>
                      Pay bail (Rp 1 juta)
                    </Button>
                  )}
                  {!turn.hasRolled && (
                    <Button block onClick={roll}>
                      🎲 {me?.inJail ? 'Roll for doubles' : 'Roll dice'}
                    </Button>
                  )}
                  {turn.hasRolled && pending !== null && (
                    <Button variant="success" block onClick={() => buy(pending)}>
                      Buy {BOARD[pending]!.name} — {formatRupiah(basePrice(pending))}
                    </Button>
                  )}
                  {turn.hasRolled && (
                    <Button variant="secondary" size="sm" block onClick={endTurn}>
                      {pending !== null ? 'Skip & end turn' : 'End turn'}
                    </Button>
                  )}
                  {!turn.usedMetaAction && (
                    <MetaActionBar
                      turn={turn}
                      pendingAction={pendingMeta?.action ?? null}
                      onPick={handlePickMeta}
                    />
                  )}
                  {me && <AbilityBar me={me} onUse={useAbility} />}
                  <Button variant="secondary" size="sm" block onClick={() => setShowPinjol(true)}>
                    🏦 Pinjol
                  </Button>
                  {pendingMeta && (
                    <Card
                      tone="info"
                      flat
                      className="flex items-center justify-between px-3 py-2 text-xs text-ink"
                    >
                      <span>
                        Select a {pendingMeta.target} on the{' '}
                        {pendingMeta.target === 'tile' ? 'board' : 'players list'}…
                      </span>
                      <button
                        onClick={() => setPendingMeta(null)}
                        className="font-bold text-ink hover:text-info-strong"
                      >
                        Cancel
                      </button>
                    </Card>
                  )}
                </>
              ) : (
                <Card tone="sunken" flat className="py-3 text-center text-sm text-ink-muted">
                  Waiting for{' '}
                  <span className="font-semibold" style={{ color: current?.color }}>
                    {current?.name}
                  </span>
                  …
                </Card>
              )}
              {me && !me.isEliminated && (
                <Button variant="secondary" size="sm" block onClick={() => setShowNegotiate(true)}>
                  🤝 Negotiate
                </Button>
              )}
            </div>
          )}
        </Card>

        <PlayerPanel
          state={state}
          myId={me?.id ?? null}
          onSelect={pendingMeta?.target === 'player' ? handleSelectPlayer : undefined}
        />

        <Card className="h-56 p-3">
          <EventLog state={state} />
        </Card>
      </aside>

      <PinjolModal open={showPinjol} onClose={() => setShowPinjol(false)} />
      <NegotiationModal open={showNegotiate} onClose={() => setShowNegotiate(false)} />

      {selectedTile !== null && (
        <PropertyModal
          key={selectedTile}
          tileId={selectedTile}
          open={selectedTile !== null}
          onClose={() => setSelectedTile(null)}
        />
      )}

      {phase === 'ended' && (
        <GameOverScreen
          standings={finalStandings ?? fallbackStandings(state)}
          winnerId={state.winner ?? null}
          myId={me?.id ?? null}
        />
      )}
    </div>
  )
}

/** Derive a minimal standings list (no wealth) when the game_over event was missed. */
function fallbackStandings(state: ReturnType<typeof useGame.getState>['state']): FinalStanding[] {
  if (!state) return []
  return state.players
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      role: p.role,
      wealth: p.cash,
      eliminated: p.isEliminated,
    }))
    .sort((a, b) => {
      if (a.playerId === state.winner) return -1
      if (b.playerId === state.winner) return 1
      return b.wealth - a.wealth
    })
}

function GameOverScreen({
  standings,
  winnerId,
  myId,
}: {
  standings: FinalStanding[]
  winnerId: string | null
  myId: string | null
}) {
  const winner = standings.find((s) => s.playerId === winnerId) ?? standings[0]
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-xl border-2 border-ink bg-surface p-6 shadow-brutal-xl">
        <div className="text-center">
          <div className="text-5xl">🏆</div>
          <div className="mt-1 text-sm uppercase tracking-wide text-ink-muted">Game over</div>
          <div className="mt-1 text-2xl font-black text-ink">{winner?.name ?? '—'} wins!</div>
        </div>

        <ol className="mt-5 space-y-2">
          {standings.map((s, i) => (
            <li
              key={s.playerId}
              className={`flex items-center gap-3 rounded-lg border-2 border-ink px-3 py-2 text-sm ${
                s.playerId === winnerId ? 'bg-accent-soft' : 'bg-surface-sunken'
              }`}
            >
              <span className="w-5 text-center font-bold text-ink-muted">{i + 1}</span>
              <span className="flex-1 truncate">
                <span className="font-semibold text-ink">{s.name}</span>
                {s.playerId === myId && (
                  <Badge tone="info" className="ml-1">
                    you
                  </Badge>
                )}
                <span className="ml-1 text-[11px] text-ink-faint">
                  {s.role ? ROLES[s.role].name : '—'}
                </span>
                {s.eliminated && (
                  <Badge tone="danger" className="ml-1">
                    eliminated
                  </Badge>
                )}
              </span>
              <span className="font-mono text-ink">{formatRupiah(s.wealth)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
