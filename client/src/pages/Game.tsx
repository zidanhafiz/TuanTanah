import {
  BOARD,
  LAHAN_LAND_PRICE,
  META_ACTIONS_PER_LAP,
  REGIONS,
  TRANSPORT_BUY_PRICE,
  type FinalStanding,
  type MetaActionType,
  type TileId,
} from '@tuan-tanah/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { roleName, tileName } from '../i18n/gameData.js'
import { AbilityBar } from '../components/AbilityBar/AbilityBar.js'
import { AfkCountdown } from '../components/AfkCountdown/AfkCountdown.js'
import { Board } from '../components/Board/Board.js'
import { DebtPanel } from '../components/DebtPanel/DebtPanel.js'
import { EventLog } from '../components/EventLog/EventLog.js'
import { GameHeader } from '../components/GameHeader/GameHeader.js'
import { MetaActionBar, type MetaActionDef } from '../components/MetaActionBar/MetaActionBar.js'
import { JudolModal } from '../components/JudolModal/JudolModal.js'
import { KantorHukumModal } from '../components/KantorHukumModal/KantorHukumModal.js'
import { NegotiationModal } from '../components/NegotiationModal/NegotiationModal.js'
import { PinjolModal } from '../components/PinjolModal/PinjolModal.js'
import { PlayerPanel } from '../components/PlayerPanel/PlayerPanel.js'
import { PlayerStatus } from '../components/PlayerStatus/PlayerStatus.js'
import { PropertyModal } from '../components/PropertyModal/PropertyModal.js'
import { LeaveButton } from '../components/RoomActions.js'
import { Badge, Button, Card, Tabs, Tooltip } from '../components/ui/index.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
import { formatRupiah, useGame } from '../store/gameStore.js'
import { isRollAnimating, useRollAnim } from '../store/rollAnimation.js'

function basePrice(tileId: TileId): number {
  const def = BOARD[tileId]!
  if (def.type === 'transport') return TRANSPORT_BUY_PRICE
  if (def.type === 'buildable_land') return LAHAN_LAND_PRICE
  return def.region ? REGIONS[def.region].buyPrice : 0
}

export function Game() {
  const { t } = useTranslation()
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const isMyTurn = useGame((s) => s.isMyTurn)()
  const roll = useGame((s) => s.roll)
  const buy = useGame((s) => s.buy)
  const metaAction = useGame((s) => s.metaAction)
  const useAbility = useGame((s) => s.useAbility)
  const payJail = useGame((s) => s.payJail)
  const endTurn = useGame((s) => s.endTurn)
  const lawOfficeSkip = useGame((s) => s.lawOfficeSkip)
  const finalStandings = useGame((s) => s.finalStandings)

  const [pendingMeta, setPendingMeta] = useState<{
    action: MetaActionType
    target: 'player' | 'tile'
  } | null>(null)
  const [showPinjol, setShowPinjol] = useState(false)
  const [showJudol, setShowJudol] = useState(false)
  const [selectedTile, setSelectedTile] = useState<TileId | null>(null)
  const [showNegotiate, setShowNegotiate] = useState(false)
  // Whether the player has closed the Kantor Hukum modal without acting. Closing
  // only hides it locally (the opportunity stays live on the server) so they can
  // reopen it for as long as they're on the tile; only an explicit Skip forfeits.
  const [lawOfficeDismissed, setLawOfficeDismissed] = useState(false)
  // Sidebar tab selection. Phones get an extra "Actions" tab (their turn
  // controls live in the sidebar, not on the board); tablet/desktop don't.
  const [sidebarTab, setSidebarTab] = useState<'actions' | 'status' | 'log'>('actions')
  // While the dice/token cinematic is playing, hold back post-roll actions so
  // the buy button only appears once the token has arrived on its tile.
  const rolling = useRollAnim((s) => isRollAnimating(s.phase))
  // On tablet/desktop the turn actions live on the board itself, next to the
  // dice where attention already is, leaving a lighter sidebar. On phones the
  // board center is too cramped, so they stay in the sidebar (previous layout).
  const actionsOnBoard = useMediaQuery('(min-width: 768px)')

  const metaActionsLeft = META_ACTIONS_PER_LAP - (me?.metaActionsUsed.length ?? 0)
  // Clear any in-progress target selection when it's no longer actionable.
  useEffect(() => {
    if (!isMyTurn || metaActionsLeft <= 0) setPendingMeta(null)
  }, [isMyTurn, metaActionsLeft])
  // Reset the Kantor Hukum dismissal when the opportunity ends, so the modal
  // opens fresh the next time the player lands on the tile.
  useEffect(() => {
    if (!state?.turn.pendingLawOffice) setLawOfficeDismissed(false)
  }, [state?.turn.pendingLawOffice])

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
    if (def.action === 'judol') {
      setShowJudol(true)
      setPendingMeta(null)
      return
    }
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

  // Active player's per-turn controls — only while play isn't paused for a
  // debt or game-over. Rendered identically whether on the board or in the
  // sidebar; only their container differs by breakpoint.
  const turnActive = phase === 'playing' && !myDebt && !debtor && isMyTurn
  const turnControls = turnActive ? (
    <>
      {me?.inJail && !turn.hasRolled && (
        <Button variant="secondary" size="sm" block onClick={payJail}>
          {t('game.payBail')}
        </Button>
      )}
      {(!turn.hasRolled || turn.rolledDoubles) && (
        <Button block onClick={roll} disabled={rolling}>
          🎲{' '}
          {me?.inJail
            ? t('game.rollForDoubles')
            : turn.rolledDoubles
              ? t('game.rollAgain')
              : t('game.rollDice')}
        </Button>
      )}
      {turn.hasRolled && !rolling && pending !== null && (
        <Button variant="success" block onClick={() => buy(pending)}>
          {t('game.buy', {
            name: tileName(t, pending),
            price: formatRupiah(basePrice(pending)),
          })}
        </Button>
      )}
      {turn.pendingLawOffice && !rolling && lawOfficeDismissed && (
        <Button block onClick={() => setLawOfficeDismissed(false)}>
          {t('lawOffice.reopen')}
        </Button>
      )}
      {turn.hasRolled && !rolling && (
        <Button variant="secondary" size="sm" block onClick={endTurn}>
          {t('game.endTurn')}
        </Button>
      )}
      {metaActionsLeft > 0 && !rolling && me && (
        <MetaActionBar
          turn={turn}
          used={me.metaActionsUsed}
          pendingAction={pendingMeta?.action ?? null}
          onPick={handlePickMeta}
        />
      )}
      {me && !rolling && <AbilityBar me={me} onUse={useAbility} />}
      {!rolling && (
        <Tooltip content={t('game.pinjolDesc')} className="w-full">
          <Button variant="secondary" size="sm" block onClick={() => setShowPinjol(true)}>
            {t('game.pinjol')}
          </Button>
        </Tooltip>
      )}
    </>
  ) : null

  // Meta-action targeting hint + cancel. Pinned above the tab strip (not inside
  // the Actions tab) so it stays visible while the player taps a target on the
  // board or in the Status tab's player list.
  const targetHint =
    turnActive && pendingMeta ? (
      <Card
        tone="info"
        flat
        className="flex items-center justify-between px-3 py-2 text-xs text-ink"
      >
        <span>
          {t('game.selectTarget', {
            target: pendingMeta.target === 'tile' ? t('game.targetTile') : t('game.targetPlayer'),
            location:
              pendingMeta.target === 'tile' ? t('game.locationBoard') : t('game.locationPlayers'),
          })}
        </span>
        <button
          onClick={() => setPendingMeta(null)}
          className="font-bold text-ink hover:text-info-strong"
        >
          {t('common.cancel')}
        </button>
      </Card>
    ) : null

  // Negotiation is offered even off-turn (you can propose deals any time).
  const canNegotiate =
    phase === 'playing' && !myDebt && !debtor && Boolean(me && !me.isEliminated) && !rolling
  const negotiateButton = canNegotiate ? (
    <Tooltip content={t('game.negotiateDesc')} className="w-full">
      <Button variant="secondary" size="sm" block onClick={() => setShowNegotiate(true)}>
        {t('game.negotiate')}
      </Button>
    </Tooltip>
  ) : null

  // "Waiting for X" hint — sidebar-only; on the board the center turn indicator
  // already conveys whose turn it is.
  const waitingHint =
    phase === 'playing' && !myDebt && !debtor && !isMyTurn ? (
      <Card tone="sunken" flat className="py-3 text-center text-sm text-ink-muted">
        {t('game.waitingFor')}{' '}
        <span className="font-semibold" style={{ color: current?.color }}>
          {current?.name}
        </span>
        …
      </Card>
    ) : null

  // What goes inside the board center on tablet/desktop.
  const boardActions =
    actionsOnBoard && (turnControls || negotiateButton) ? (
      <>
        {turnControls}
        {negotiateButton}
      </>
    ) : null

  const showStatusPanel = Boolean(me && !me.isEliminated && phase === 'playing')

  // Sidebar tabs. Phones expose an "Actions" tab (turn controls live in the
  // sidebar there); on tablet/desktop the controls are on the board, so the
  // tab strip is just Status + Log. Derive the effective tab so a selection
  // that doesn't exist at the current breakpoint falls back gracefully.
  const sidebarTabs = actionsOnBoard
    ? [
        { id: 'status', label: t('sidebar.tabStatus') },
        { id: 'log', label: t('sidebar.tabLog') },
      ]
    : [
        { id: 'actions', label: t('sidebar.tabActions') },
        { id: 'status', label: t('sidebar.tabStatus') },
        { id: 'log', label: t('sidebar.tabLog') },
      ]
  // When targeting a player for a meta-action, force the Status tab so the
  // player list is on screen to tap. Otherwise honour the selection, falling
  // back when it doesn't exist at this breakpoint.
  // Game-paused banner, pinned at the top of the sidebar above the tabs so it's
  // visible whichever tab is active: winner on game-over, your own debt panel,
  // or a notice that play is waiting on someone else's debt.
  const pauseBanner =
    phase === 'ended' ? (
      <Card tone="accent" flat className="p-3 text-center">
        <div className="text-sm text-ink-muted">{t('game.winner')}</div>
        <div className="text-xl font-bold text-ink">
          {state.players.find((p) => p.id === state.winner)?.name ?? t('common.dash')}
        </div>
      </Card>
    ) : myDebt ? (
      <DebtPanel debt={myDebt} onTakePinjol={() => setShowPinjol(true)} />
    ) : debtor ? (
      <Card tone="danger" flat className="py-3 text-center text-sm text-ink">
        {t('game.pausedWaitingPre')}{' '}
        <span className="font-semibold" style={{ color: debtor.color }}>
          {debtor.name}
        </span>{' '}
        {t('game.pausedWaitingPost')}
      </Card>
    ) : null

  const activeTab =
    pendingMeta?.target === 'player'
      ? 'status'
      : sidebarTabs.some((tab) => tab.id === sidebarTab)
        ? sidebarTab
        : actionsOnBoard
          ? 'status'
          : 'actions'

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
      {/* Full-width page header */}
      <GameHeader />

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Board */}
        <div className="flex flex-1 items-start justify-center">
          <Board state={state} onSelectTile={handleTileClick} centerSlot={boardActions} />
        </div>

        {/* Sidebar */}
        <aside className="flex w-full flex-col gap-4 lg:w-80">
          <AfkCountdown />

          {pauseBanner}

          {targetHint}

          {/* Tabbed sidebar body. The tab strip and panels below it swap by
            selection; the room/pause card above stays pinned. */}
          <Tabs
            tabs={sidebarTabs}
            active={activeTab}
            onChange={(id) => setSidebarTab(id as 'actions' | 'status' | 'log')}
          />

          {/* Actions (phones only): turn controls live in the sidebar here, since
            the board center is too cramped for them on small screens. */}
          {activeTab === 'actions' && (
            <div className="space-y-2">
              {turnControls ?? waitingHint}
              {negotiateButton}
            </div>
          )}

          {/* Status: the player's own panel (cash, properties, loans) plus the
            full player list. */}
          {activeTab === 'status' && (
            <>
              {showStatusPanel && (
                <PlayerStatus onOpenProperty={(tileId) => setSelectedTile(tileId)} />
              )}
              <PlayerPanel
                state={state}
                myId={me?.id ?? null}
                onSelect={pendingMeta?.target === 'player' ? handleSelectPlayer : undefined}
              />
            </>
          )}

          {/* Log */}
          {activeTab === 'log' && (
            <Card className="h-[28rem] p-3">
              <EventLog state={state} />
            </Card>
          )}
        </aside>
      </div>

      <PinjolModal open={showPinjol} onClose={() => setShowPinjol(false)} />
      <JudolModal open={showJudol} onClose={() => setShowJudol(false)} />
      <KantorHukumModal
        open={isMyTurn && turn.pendingLawOffice && !rolling && !lawOfficeDismissed}
        onClose={() => setLawOfficeDismissed(true)}
        onSkip={lawOfficeSkip}
      />

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
  const { t } = useTranslation()
  const winner = standings.find((s) => s.playerId === winnerId) ?? standings[0]
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-xl border-2 border-ink bg-surface p-6 shadow-brutal-xl">
        <div className="text-center">
          <div className="text-5xl">🏆</div>
          <div className="mt-1 text-sm uppercase tracking-wide text-ink-muted">
            {t('game.gameOver.title')}
          </div>
          <div className="mt-1 text-2xl font-black text-ink">
            {t('game.gameOver.wins', { name: winner?.name ?? t('common.dash') })}
          </div>
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
                    {t('game.gameOver.you')}
                  </Badge>
                )}
                <span className="ml-1 text-[11px] text-ink-faint">
                  {s.role ? roleName(t, s.role) : t('common.dash')}
                </span>
                {s.eliminated && (
                  <Badge tone="danger" className="ml-1">
                    {t('game.gameOver.eliminated')}
                  </Badge>
                )}
              </span>
              <span className="font-mono text-ink">{formatRupiah(s.wealth)}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex justify-center">
          <LeaveButton label={t('common.backHomeIcon')} />
        </div>
      </div>
    </div>
  )
}
