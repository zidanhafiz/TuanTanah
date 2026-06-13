import { describe, expect, it } from 'vitest'
import { checkWinCondition, resolveGameOver } from '../src/engine/elimination.js'
import { makeGame } from './helpers.js'

describe('checkWinCondition', () => {
  it('returns the last player standing', () => {
    const { state, players } = makeGame(3)
    players[0]!.isEliminated = true
    players[1]!.isEliminated = true
    expect(checkWinCondition(state, 0)).toEqual({
      winnerId: players[2]!.id,
      reason: 'last_standing',
    })
  })

  it('declares a wealth win for the richest once the target is reached', () => {
    const { state, players } = makeGame(2, {
      cash: 0,
      settings: { winCondition: 'wealth', targetWealth: 10_000_000 },
    })
    players[0]!.cash = 10_000_000
    players[1]!.cash = 1_000_000
    expect(checkWinCondition(state, 0)).toEqual({ winnerId: players[0]!.id, reason: 'wealth' })
  })

  it('does not declare a wealth win before the target is reached', () => {
    const { state, players } = makeGame(2, {
      cash: 0,
      settings: { winCondition: 'wealth', targetWealth: 500_000_000 },
    })
    players[0]!.cash = 10_000_000
    expect(checkWinCondition(state, 0)).toBeNull()
  })

  it('declares a time win for the richest once the clock runs out', () => {
    const { state, players } = makeGame(2, {
      cash: 0,
      settings: { winCondition: 'time', timeLimitMinutes: 60 },
    })
    players[0]!.cash = 5_000_000
    players[1]!.cash = 1_000_000
    // startedAt must be a real (truthy) timestamp — the engine guards on it.
    state.startedAt = 1_000_000
    const deadline = state.startedAt + 60 * 60_000
    expect(checkWinCondition(state, deadline - 1)).toBeNull()
    expect(checkWinCondition(state, deadline)).toEqual({ winnerId: players[0]!.id, reason: 'time' })
  })
})

describe('resolveGameOver', () => {
  it('ends the game and crowns the winner', () => {
    const { state, players } = makeGame(2)
    players[1]!.isEliminated = true
    expect(resolveGameOver(state, 0)).toBe(true)
    expect(state.phase).toBe('ended')
    expect(state.winner).toBe(players[0]!.id)
    expect(state.winReason).toBe('last_standing')
  })

  it('is a no-op when the game is not in progress', () => {
    const { state, players } = makeGame(2)
    players[1]!.isEliminated = true
    resolveGameOver(state, 0)
    expect(resolveGameOver(state, 0)).toBe(false) // already ended
  })
})
