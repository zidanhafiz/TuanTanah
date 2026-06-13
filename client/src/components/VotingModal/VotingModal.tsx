import { Badge, Button, Card, Modal } from '../ui/index.js'
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
    <Modal open onClose={() => {}} title="🗳️ Vote to skip a turn" size="sm" dismissable={false}>
      <div className="text-xs text-ink-muted">
        The most-voted player skips their next turn. {votesCast}/{eligibleCount} voted.
      </div>

      {hasVoted ? (
        <Card flat tone="info" className="mt-4 p-3 text-center text-sm text-ink">
          You voted for{' '}
          <span className="font-semibold">
            {state.players.find((p) => p.id === myVoteTargetId)?.name ?? '—'}
          </span>
          . Waiting for the others…
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {candidates.map((p) => (
            <Button
              key={p.id}
              variant="secondary"
              block
              onClick={() => castVote(p.id)}
              className="justify-start"
            >
              <Badge color={p.color} className="h-3 w-3 p-0" />
              {p.name}
            </Button>
          ))}
        </div>
      )}
    </Modal>
  )
}
