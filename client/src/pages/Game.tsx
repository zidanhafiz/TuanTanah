import {
  BOARD,
  REGIONS,
  TRANSPORT_BUY_PRICE,
  type MetaActionType,
  type TileId,
} from '@tuan-tanah/shared'
import { useEffect, useState } from 'react'
import { AbilityBar } from '../components/AbilityBar/AbilityBar.js'
import { Board } from '../components/Board/Board.js'
import { EventLog } from '../components/EventLog/EventLog.js'
import { MetaActionBar, type MetaActionDef } from '../components/MetaActionBar/MetaActionBar.js'
import { PinjolModal } from '../components/PinjolModal/PinjolModal.js'
import { PlayerPanel } from '../components/PlayerPanel/PlayerPanel.js'
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

  const [pendingMeta, setPendingMeta] = useState<{
    action: MetaActionType
    target: 'player' | 'tile'
  } | null>(null)
  const [showPinjol, setShowPinjol] = useState(false)

  const usedMetaAction = state?.turn.usedMetaAction ?? false
  // Clear any in-progress target selection when it's no longer actionable.
  useEffect(() => {
    if (!isMyTurn || usedMetaAction) setPendingMeta(null)
  }, [isMyTurn, usedMetaAction])

  if (!state) return null

  const { turn, phase } = state
  const pending = turn.pendingBuyTileId
  const current = state.players[state.currentPlayerIndex]

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

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 lg:flex-row">
      {/* Board */}
      <div className="flex flex-1 justify-center">
        <Board
          state={state}
          onSelectTile={pendingMeta?.target === 'tile' ? handleSelectTile : undefined}
        />
      </div>

      {/* Sidebar */}
      <aside className="flex w-full flex-col gap-4 lg:w-80">
        <div className="rounded-xl bg-slate-800/60 p-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Room {state.roomId}</span>
            <span>Round {state.round}</span>
          </div>

          {phase === 'ended' ? (
            <div className="mt-3 rounded-lg bg-amber-500/20 p-3 text-center">
              <div className="text-sm text-slate-300">Winner</div>
              <div className="text-xl font-bold text-amber-300">
                {state.players.find((p) => p.id === state.winner)?.name ?? '—'}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {isMyTurn ? (
                <>
                  {me?.inJail && !turn.hasRolled && (
                    <button
                      onClick={payJail}
                      className="w-full rounded-lg bg-slate-600 py-2 text-sm font-semibold hover:bg-slate-500"
                    >
                      Pay bail (Rp 1 juta)
                    </button>
                  )}
                  {!turn.hasRolled && (
                    <button
                      onClick={roll}
                      className="w-full rounded-lg bg-amber-500 py-2.5 font-bold text-slate-900 hover:bg-amber-400"
                    >
                      🎲 {me?.inJail ? 'Roll for doubles' : 'Roll dice'}
                    </button>
                  )}
                  {turn.hasRolled && pending !== null && (
                    <button
                      onClick={() => buy(pending)}
                      className="w-full rounded-lg bg-emerald-600 py-2.5 font-bold hover:bg-emerald-500"
                    >
                      Buy {BOARD[pending]!.name} — {formatRupiah(basePrice(pending))}
                    </button>
                  )}
                  {turn.hasRolled && (
                    <button
                      onClick={endTurn}
                      className="w-full rounded-lg bg-slate-700 py-2 text-sm font-semibold hover:bg-slate-600"
                    >
                      {pending !== null ? 'Skip & end turn' : 'End turn'}
                    </button>
                  )}
                  {!turn.usedMetaAction && (
                    <MetaActionBar
                      turn={turn}
                      pendingAction={pendingMeta?.action ?? null}
                      onPick={handlePickMeta}
                    />
                  )}
                  {me && <AbilityBar me={me} onUse={useAbility} />}
                  <button
                    onClick={() => setShowPinjol(true)}
                    className="w-full rounded-lg bg-slate-700 py-2 text-sm font-semibold hover:bg-slate-600"
                  >
                    🏦 Pinjol
                  </button>
                  {pendingMeta && (
                    <div className="flex items-center justify-between rounded-lg bg-sky-500/15 px-3 py-2 text-xs text-sky-200">
                      <span>
                        Select a {pendingMeta.target} on the{' '}
                        {pendingMeta.target === 'tile' ? 'board' : 'players list'}…
                      </span>
                      <button
                        onClick={() => setPendingMeta(null)}
                        className="font-semibold text-sky-300 hover:text-sky-100"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg bg-slate-900 py-3 text-center text-sm text-slate-400">
                  Waiting for{' '}
                  <span className="font-semibold" style={{ color: current?.color }}>
                    {current?.name}
                  </span>
                  …
                </div>
              )}
            </div>
          )}
        </div>

        <PlayerPanel
          state={state}
          myId={me?.id ?? null}
          onSelect={pendingMeta?.target === 'player' ? handleSelectPlayer : undefined}
        />

        <div className="h-56 rounded-xl bg-slate-800/60 p-3">
          <EventLog state={state} />
        </div>
      </aside>

      <PinjolModal open={showPinjol} onClose={() => setShowPinjol(false)} />
    </div>
  )
}
