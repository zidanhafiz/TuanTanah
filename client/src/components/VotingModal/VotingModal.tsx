import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../../store/gameStore.js'

/**
 * Pemilu (election) vote prompt. Driven entirely by `state.pendingVote`: shows
 * for every connected, non-eliminated player until they cast a vote, then shows
 * a live tally while waiting for the rest. Clears when the server resolves.
 */
export function VotingModal() {
  const state = useGame((s) => s.state)
  const me = useGame((s) => s.me)()
  const castVote = useGame((s) => s.castVote)

  const pendingVote = state?.pendingVote
  if (!pendingVote || !state || !me || me.isEliminated) return null

  const candidates = state.players.filter((p) => !p.isEliminated && p.id !== me.id)
  const eligibleCount = state.players.filter((p) => !p.isEliminated && p.isConnected).length
  const votesCast = Object.keys(pendingVote.votes).length
  const myVoteTargetId = pendingVote.votes[me.id]
  const hasVoted = myVoteTargetId != null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="w-80 rounded-2xl bg-slate-800 p-5 text-white shadow-2xl"
        >
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
            🗳️ Pemilu
          </div>
          <div className="mt-1 text-lg font-bold">Vote to skip a turn</div>
          <div className="mt-1 text-xs text-slate-400">
            The most-voted player skips their next turn. {votesCast}/{eligibleCount} voted.
          </div>

          {hasVoted ? (
            <div className="mt-4 rounded-lg bg-indigo-500/15 p-3 text-center text-sm text-indigo-200">
              You voted for{' '}
              <span className="font-semibold">
                {state.players.find((p) => p.id === myVoteTargetId)?.name ?? '—'}
              </span>
              . Waiting for the others…
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {candidates.map((p) => (
                <button
                  key={p.id}
                  onClick={() => castVote(p.id)}
                  className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold transition-colors hover:bg-slate-600"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
