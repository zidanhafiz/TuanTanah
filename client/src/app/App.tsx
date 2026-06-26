import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuctionModal } from '@/features/game/AuctionModal/AuctionModal.js'
import { CardModal } from '@/features/game/CardModal/CardModal.js'
import { ErrorToast } from '@/components/ErrorToast.js'
import { IncomingDealModal } from '@/features/game/NegotiationModal/IncomingDealModal.js'
import { TurnBanner } from '@/features/game/TurnBanner/TurnBanner.js'
import { VotingModal } from '@/features/game/VotingModal/VotingModal.js'
import { DevMultiplayer } from '@/app/DevMultiplayer.js'
import { Home } from '@/features/home/Home.js'
import { RoomGate } from '@/features/game/RoomGate.js'
import { StyleGuide } from '@/app/StyleGuide.js'
import { useGame } from '@/store/gameStore.js'

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
        <Route path="/design" element={<StyleGuide />} />
        {/* DEV-only: run several isolated clients (one per iframe) in one tab. */}
        {import.meta.env.DEV && <Route path="/dev" element={<DevMultiplayer />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ErrorToast />
      <TurnBanner />
      <CardModal />
      <VotingModal />
      <AuctionModal />
      <IncomingDealModal />
    </div>
  )
}
