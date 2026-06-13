import { useEffect } from 'react'
import { CardModal } from './components/CardModal/CardModal.js'
import { ErrorToast } from './components/ErrorToast.js'
import { IncomingDealModal } from './components/NegotiationModal/IncomingDealModal.js'
import { VotingModal } from './components/VotingModal/VotingModal.js'
import { Game } from './pages/Game.js'
import { Home } from './pages/Home.js'
import { Lobby } from './pages/Lobby.js'
import { useGame } from './store/gameStore.js'

export function App() {
  const init = useGame((s) => s.init)
  const roomId = useGame((s) => s.roomId)
  const phase = useGame((s) => s.state?.phase)

  useEffect(() => {
    init()
  }, [init])

  let screen
  if (!roomId) screen = <Home />
  else if (phase === 'lobby' || phase === undefined) screen = <Lobby />
  else screen = <Game />

  return (
    <div className="min-h-screen">
      {screen}
      <ErrorToast />
      <CardModal />
      <VotingModal />
      <IncomingDealModal />
    </div>
  )
}
