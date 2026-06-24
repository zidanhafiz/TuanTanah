import { INVESTOR_RENT_CUT_RATE, ROLES } from '@tuan-tanah/shared'
import { describe, expect, it } from 'vitest'
import { buyPriceMultiplier, investorCut, salaryFor, taxMultiplier } from '../src/engine/roles.js'
import { makeGame } from './helpers.js'

describe('salaryFor', () => {
  it('returns the role base salary', () => {
    const { players } = makeGame(1, { roles: ['politisi'] })
    expect(salaryFor(players[0]!)).toBe(ROLES.politisi.salary)
  })

  it('gives the Freelancer 1.5× salary', () => {
    const { players } = makeGame(1, { roles: ['freelancer'] })
    expect(salaryFor(players[0]!)).toBe(Math.round(ROLES.freelancer.salary * 1.5))
  })

  it('returns 0 when no role is picked', () => {
    const { players } = makeGame(1)
    expect(salaryFor(players[0]!)).toBe(0)
  })
})

describe('buyPriceMultiplier', () => {
  it('discounts the Sales role by 25%', () => {
    const { players } = makeGame(1, { roles: ['sales'] })
    expect(buyPriceMultiplier(players[0]!)).toBe(0.75)
  })

  it('is full price for other roles', () => {
    const { players } = makeGame(1, { roles: ['investor'] })
    expect(buyPriceMultiplier(players[0]!)).toBe(1)
  })
})

describe('investorCut', () => {
  it('skims the investor rate', () => {
    expect(investorCut(2_000_000)).toBe(Math.round(2_000_000 * INVESTOR_RENT_CUT_RATE))
  })
})

describe('taxMultiplier', () => {
  it('halves tax for the Ojol Driver and is full for others', () => {
    const { players } = makeGame(2, { roles: ['ojol_driver', 'pengusaha'] })
    expect(taxMultiplier(players[0]!)).toBe(0.5)
    expect(taxMultiplier(players[1]!)).toBe(1)
  })
})
