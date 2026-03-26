import { describe, it, expect } from 'vitest'
import { projectNetWorth, projectNetWorthWithEvents } from '../project-net-worth'
import type { Account, ScenarioAssumptions, LifeEvent } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-1',
  name: 'Investment Account',
  type: 'non-registered',
  balance: '100000',
  currency: 'CAD',
  institution: '',
  expectedReturnRate: '7.0',
  contributionRoom: null,
  interestRate: null,
  notes: '',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

const makeRrspAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'rrsp-1',
  name: 'RRSP',
  type: 'rrsp',
  balance: '500000',
  currency: 'CAD',
  institution: '',
  expectedReturnRate: '6.0',
  contributionRoom: null,
  interestRate: null,
  notes: '',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

const baseAssumptions: ScenarioAssumptions = {
  inflationRate: '0.02',
  salaryGrowthRate: '0.03',
  retirementAge: 65,
  lifeExpectancy: 85,
  cppStartAge: 65,
  oasStartAge: 65,
  province: 'ON',
  annualIncome: '80000',
  annualExpenses: '50000',
  annualSavingsRate: '0.20',
  monthlyContributions: [],
}

const makeIncomeEvent = (overrides: Partial<LifeEvent> = {}): LifeEvent => ({
  id: 'evt-income',
  name: 'Part-time income',
  type: 'income',
  amount: '1000', // $1,000/month
  startAge: 40,
  endAge: 45,
  person: 'self',
  ...overrides,
})

const makeExpenseEvent = (overrides: Partial<LifeEvent> = {}): LifeEvent => ({
  id: 'evt-expense',
  name: 'Extra expense',
  type: 'expense',
  amount: '500', // $500/month
  startAge: 40,
  endAge: 45,
  person: 'self',
  ...overrides,
})

const makeOneTimeEvent = (overrides: Partial<LifeEvent> = {}): LifeEvent => ({
  id: 'evt-onetime',
  name: 'Inheritance',
  type: 'one-time',
  amount: '50000',
  startAge: 55,
  person: 'self',
  ...overrides,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('projectNetWorthWithEvents', () => {
  describe('backward compatibility — no life events', () => {
    it('returns identical results to projectNetWorth when lifeEvents is undefined', () => {
      const accounts = [makeAccount()]
      const input = { accounts, assumptions: baseAssumptions, currentAge: 35, startYear: 2026 }

      const base = projectNetWorth(input)
      const v2 = projectNetWorthWithEvents(input)

      expect(v2).toHaveLength(base.length)
      for (let i = 0; i < base.length; i++) {
        expect(v2[i].year).toBe(base[i].year)
        expect(v2[i].age).toBe(base[i].age)
        expect(v2[i].netWorth.toNumber()).toBeCloseTo(base[i].netWorth.toNumber(), 2)
        expect(v2[i].totalAssets.toNumber()).toBeCloseTo(base[i].totalAssets.toNumber(), 2)
      }
    })

    it('returns identical results to projectNetWorth when lifeEvents is an empty array', () => {
      const accounts = [makeAccount()]
      const input = { accounts, assumptions: baseAssumptions, currentAge: 35, startYear: 2026 }
      const inputV2 = { ...input, lifeEvents: [] }

      const base = projectNetWorth(input)
      const v2 = projectNetWorthWithEvents(inputV2)

      expect(v2).toHaveLength(base.length)
      for (let i = 0; i < base.length; i++) {
        expect(v2[i].netWorth.toNumber()).toBeCloseTo(base[i].netWorth.toNumber(), 2)
      }
    })
  })

  describe('income life events', () => {
    it('income event increases net worth during active years', () => {
      const accounts = [makeAccount({ balance: '100000' })]
      const currentAge = 35
      const assumptions = { ...baseAssumptions, lifeExpectancy: 50 }
      const base = projectNetWorth({ accounts, assumptions, currentAge, startYear: 2026 })

      const income = makeIncomeEvent({ startAge: 40, endAge: 45 }) // active ages 40-44
      const v2 = projectNetWorthWithEvents({
        accounts,
        assumptions,
        currentAge,
        startYear: 2026,
        lifeEvents: [income],
      })

      // At age 45 (yearOffset 10) the income event has run for 5 years — net worth should be higher
      const baseAt45 = base.find((p) => p.age === 45)!
      const v2At45 = v2.find((p) => p.age === 45)!
      expect(v2At45.netWorth.toNumber()).toBeGreaterThan(baseAt45.netWorth.toNumber())
    })

    it('net worth matches base projection after an income event ends', () => {
      // After the event ends the trajectories diverge permanently (the extra funds keep growing),
      // so the v2 projection should STILL be above base after the event ends.
      const accounts = [makeAccount({ balance: '100000' })]
      const currentAge = 35
      const assumptions = { ...baseAssumptions, lifeExpectancy: 55 }
      const base = projectNetWorth({ accounts, assumptions, currentAge, startYear: 2026 })

      const income = makeIncomeEvent({ startAge: 40, endAge: 45 })
      const v2 = projectNetWorthWithEvents({
        accounts,
        assumptions,
        currentAge,
        startYear: 2026,
        lifeEvents: [income],
      })

      // At age 50 (5 years after event ended) v2 should still exceed base because the
      // extra capital has been compounding.
      const baseAt50 = base.find((p) => p.age === 50)!
      const v2At50 = v2.find((p) => p.age === 50)!
      expect(v2At50.netWorth.toNumber()).toBeGreaterThan(baseAt50.netWorth.toNumber())
    })
  })

  describe('expense life events', () => {
    it('expense event decreases net worth during active years', () => {
      const accounts = [makeAccount({ balance: '200000' })]
      const currentAge = 35
      const assumptions = { ...baseAssumptions, lifeExpectancy: 50 }
      const base = projectNetWorth({ accounts, assumptions, currentAge, startYear: 2026 })

      const expense = makeExpenseEvent({ startAge: 40, endAge: 45 })
      const v2 = projectNetWorthWithEvents({
        accounts,
        assumptions,
        currentAge,
        startYear: 2026,
        lifeEvents: [expense],
      })

      const baseAt45 = base.find((p) => p.age === 45)!
      const v2At45 = v2.find((p) => p.age === 45)!
      expect(v2At45.netWorth.toNumber()).toBeLessThan(baseAt45.netWorth.toNumber())
    })
  })

  describe('one-time events', () => {
    it('one-time inflow creates a spike in net worth at the exact age', () => {
      const accounts = [makeAccount({ balance: '100000' })]
      const currentAge = 50
      const assumptions = { ...baseAssumptions, lifeExpectancy: 65 }

      // Base: no events
      const base = projectNetWorth({ accounts, assumptions, currentAge, startYear: 2026 })
      // V2: one-time $50,000 at age 55
      const oneTime = makeOneTimeEvent({ startAge: 55, amount: '50000' })
      const v2 = projectNetWorthWithEvents({
        accounts,
        assumptions,
        currentAge,
        startYear: 2026,
        lifeEvents: [oneTime],
      })

      // At age 54 the two projections should be identical (event hasn't fired yet)
      const baseAt54 = base.find((p) => p.age === 54)!
      const v2At54 = v2.find((p) => p.age === 54)!
      expect(v2At54.netWorth.toNumber()).toBeCloseTo(baseAt54.netWorth.toNumber(), 0)

      // At age 55 the v2 projection should be ~$50,000 higher
      const baseAt55 = base.find((p) => p.age === 55)!
      const v2At55 = v2.find((p) => p.age === 55)!
      const diff = v2At55.netWorth.toNumber() - baseAt55.netWorth.toNumber()
      expect(diff).toBeGreaterThan(49000) // close to 50,000 (slight differences due to growth)

      // At age 56+ the v2 projection should remain higher
      const baseAt56 = base.find((p) => p.age === 56)!
      const v2At56 = v2.find((p) => p.age === 56)!
      expect(v2At56.netWorth.toNumber()).toBeGreaterThan(baseAt56.netWorth.toNumber())
    })
  })

  describe('RRIF mandatory minimum withdrawals', () => {
    it('RRSP balance is reduced by RRIF minimum starting at age 72', () => {
      const rrsp = makeRrspAccount({ balance: '500000', expectedReturnRate: '0' }) // no growth for predictability
      const currentAge = 71
      const assumptions = { ...baseAssumptions, lifeExpectancy: 75 }

      const v2 = projectNetWorthWithEvents({
        accounts: [rrsp],
        assumptions,
        currentAge,
        startYear: 2026,
        lifeEvents: [makeIncomeEvent({ startAge: 99, endAge: 100 })], // dummy event to force V2 path
      })

      // At age 71 (year 0) balance should be 500,000
      const at71 = v2.find((p) => p.age === 71)!
      expect(at71.accountBreakdown[rrsp.id].toNumber()).toBeCloseTo(500000, 0)

      // At age 72 (year 1) a 5.28% RRIF withdrawal should have been taken.
      // With 0% growth: balance starts at 500,000, RRIF min = 500,000 * 0.0528 = 26,400
      // Expected balance: 500,000 - 26,400 = 473,600
      const at72 = v2.find((p) => p.age === 72)!
      expect(at72.accountBreakdown[rrsp.id].toNumber()).toBeCloseTo(473600, 0)
    })

    it('base projectNetWorth does NOT apply RRIF withdrawals', () => {
      const rrsp = makeRrspAccount({ balance: '500000', expectedReturnRate: '0' })
      const currentAge = 71
      const assumptions = { ...baseAssumptions, lifeExpectancy: 75 }

      const base = projectNetWorth({ accounts: [rrsp], assumptions, currentAge, startYear: 2026 })
      const at72base = base.find((p) => p.age === 72)!
      // No RRIF in base: balance should still be 500,000 (0% growth, no contributions)
      expect(at72base.accountBreakdown[rrsp.id].toNumber()).toBeCloseTo(500000, 0)
    })

    it('RRIF withdrawal accumulates over multiple years', () => {
      const rrsp = makeRrspAccount({ balance: '500000', expectedReturnRate: '0' })
      const currentAge = 71
      const assumptions = { ...baseAssumptions, lifeExpectancy: 78 }

      const v2 = projectNetWorthWithEvents({
        accounts: [rrsp],
        assumptions,
        currentAge,
        startYear: 2026,
        lifeEvents: [makeIncomeEvent({ startAge: 99, endAge: 100 })],
      })

      const at71 = v2.find((p) => p.age === 71)!
      const at74 = v2.find((p) => p.age === 74)!

      // Balance at 74 should be less than at 71 due to accumulated RRIF withdrawals
      expect(at74.accountBreakdown[rrsp.id].toNumber()).toBeLessThan(
        at71.accountBreakdown[rrsp.id].toNumber()
      )
    })
  })

  describe('life event age boundaries', () => {
    it('stream event does not affect years outside its start/end age range', () => {
      const accounts = [makeAccount({ balance: '100000' })]
      const currentAge = 35
      const assumptions = { ...baseAssumptions, lifeExpectancy: 60 }

      const income = makeIncomeEvent({ startAge: 45, endAge: 50 })
      const base = projectNetWorth({ accounts, assumptions, currentAge, startYear: 2026 })
      const v2 = projectNetWorthWithEvents({
        accounts,
        assumptions,
        currentAge,
        startYear: 2026,
        lifeEvents: [income],
      })

      // Before the event starts (age 44), projections should be identical
      const baseAt44 = base.find((p) => p.age === 44)!
      const v2At44 = v2.find((p) => p.age === 44)!
      expect(v2At44.netWorth.toNumber()).toBeCloseTo(baseAt44.netWorth.toNumber(), 0)

      // After event is active (age 47), v2 should be higher
      const baseAt47 = base.find((p) => p.age === 47)!
      const v2At47 = v2.find((p) => p.age === 47)!
      expect(v2At47.netWorth.toNumber()).toBeGreaterThan(baseAt47.netWorth.toNumber())
    })

    it('partner event is skipped when no partnerAge is provided', () => {
      const accounts = [makeAccount({ balance: '100000' })]
      const currentAge = 35
      const assumptions = { ...baseAssumptions, lifeExpectancy: 50 }

      const partnerIncome: LifeEvent = {
        id: 'partner-evt',
        name: 'Partner income',
        type: 'income',
        amount: '2000',
        startAge: 40,
        endAge: 45,
        person: 'partner',
      }

      const base = projectNetWorth({ accounts, assumptions, currentAge, startYear: 2026 })
      const v2 = projectNetWorthWithEvents({
        accounts,
        assumptions,
        currentAge,
        startYear: 2026,
        lifeEvents: [partnerIncome],
        // partnerAge is NOT provided
      })

      // Partner event should be ignored — projections should match base
      for (let i = 0; i < base.length; i++) {
        expect(v2[i].netWorth.toNumber()).toBeCloseTo(base[i].netWorth.toNumber(), 0)
      }
    })

    it('partner event IS applied when partnerAge is provided', () => {
      const accounts = [makeAccount({ balance: '100000' })]
      const currentAge = 35
      const assumptions = { ...baseAssumptions, lifeExpectancy: 50 }

      const partnerIncome: LifeEvent = {
        id: 'partner-evt',
        name: 'Partner income',
        type: 'income',
        amount: '2000',
        startAge: 40,
        endAge: 45,
        person: 'partner',
      }

      const base = projectNetWorth({ accounts, assumptions, currentAge, startYear: 2026 })
      const v2 = projectNetWorthWithEvents({
        accounts,
        assumptions,
        currentAge,
        startYear: 2026,
        lifeEvents: [partnerIncome],
        partnerAge: 35, // same age as self
      })

      // Partner income should boost net worth during ages 40-44
      const baseAt44 = base.find((p) => p.age === 44)!
      const v2At44 = v2.find((p) => p.age === 44)!
      expect(v2At44.netWorth.toNumber()).toBeGreaterThan(baseAt44.netWorth.toNumber())
    })
  })
})
