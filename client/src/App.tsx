import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CardModal } from './components/CardModal/CardModal.js'
import { ErrorToast } from './components/ErrorToast.js'
import { IncomingDealModal } from './components/NegotiationModal/IncomingDealModal.js'
import { VotingModal } from './components/VotingModal/VotingModal.js'
import { Home } from './pages/Home.js'
import { RoomGate } from './pages/RoomGate.js'
import { useGame } from './store/gameStore.js'

export function App() {
  const init = useGame((s) => s.init)
  const roomId = useGame((s) => s.roomId)

  useEffect(() => {
    init()
  }, [init])

  return (
    <div className="min-h-screen">
      <Routes>
        {/* If we're already seated in a room (e.g. an auto-rejoin succeeded),
            bounce the bare home URL into that room so returning resumes play. */}
        <Route path="/" element={roomId ? <Navigate to={`/room/${roomId}`} replace /> : <Home />} />
        <Route path="/room/:roomId" element={<RoomGate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ErrorToast />
      <CardModal />
      <VotingModal />
      <IncomingDealModal />
    </div>
  )
}
