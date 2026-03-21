import { describe, it, expect } from 'vitest'
import { runMonteCarloSimulation } from '../monte-carlo'
import type { Account, ScenarioAssumptions } from '@/types'

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'test-1',
  name: 'Test Account',
  type: 'non-registered',
  balance: '100000',
  currency: 'CAD',
  institution: '',
  assetAllocation: { stocks: 60, bonds: 30, cash: 10, other: 0 },
  contributionRoom: null,
  interestRate: null,
  notes: '',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

const defaultAssumptions: ScenarioAssumptions = {
  inflationRate: '0.02',
  stockReturn: '0.07',
  bondReturn: '0.035',
  cashReturn: '0.02',
  salaryGrowthRate: '0.03',
  retirementAge: 65,
  lifeExpectancy: 40,
  cppStartAge: 65,
  oasStartAge: 65,
  province: 'ON',
  annualIncome: '80000',
  annualExpenses: '50000',
  annualSavingsRate: '0.20',
  monthlyContributions: [],
}

describe('Monte Carlo Simulation', () => {
  it('should return correct number of points', () => {
    const result = runMonteCarloSimulation({
      accounts: [makeAccount()],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 40 },
      currentAge: 30,
      startYear: 2026,
      iterations: 100,
    })

    // 10 years + starting point = 11 points
    expect(result.percentiles.p50).toHaveLength(11)
    expect(result.percentiles.p5).toHaveLength(11)
    expect(result.percentiles.p95).toHaveLength(11)
  })

  it('should have P5 < P50 < P95', () => {
    const result = runMonteCarloSimulation({
      accounts: [makeAccount()],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 40 },
      currentAge: 30,
      startYear: 2026,
      iterations: 1000,
    })

    // Check at year 10
    const lastIdx = result.percentiles.p50.length - 1
    expect(result.percentiles.p5[lastIdx].netWorth).toBeLessThan(
      result.percentiles.p50[lastIdx].netWorth
    )
    expect(result.percentiles.p50[lastIdx].netWorth).toBeLessThan(
      result.percentiles.p95[lastIdx].netWorth
    )
  })

  it('should start all percentiles at same value', () => {
    const result = runMonteCarloSimulation({
      accounts: [makeAccount({ balance: '100000' })],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 31 },
      currentAge: 30,
      startYear: 2026,
      iterations: 100,
    })

    // At year 0, all percentiles should be 100000
    expect(result.percentiles.p5[0].netWorth).toBe(100000)
    expect(result.percentiles.p50[0].netWorth).toBe(100000)
    expect(result.percentiles.p95[0].netWorth).toBe(100000)
  })

  it('should be reproducible with same seed', () => {
    const input = {
      accounts: [makeAccount()],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 40 },
      currentAge: 30,
      startYear: 2026,
      iterations: 100,
      seed: 12345,
    }

    const result1 = runMonteCarloSimulation(input)
    const result2 = runMonteCarloSimulation(input)

    expect(result1.percentiles.p50[5].netWorth).toBe(result2.percentiles.p50[5].netWorth)
  })

  it('should return success rate between 0 and 1', () => {
    const result = runMonteCarloSimulation({
      accounts: [makeAccount()],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 40 },
      currentAge: 30,
      startYear: 2026,
      iterations: 100,
    })

    expect(result.successRate).toBeGreaterThanOrEqual(0)
    expect(result.successRate).toBeLessThanOrEqual(1)
  })

  it('should handle empty result when life expectancy reached', () => {
    const result = runMonteCarloSimulation({
      accounts: [makeAccount()],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 30 },
      currentAge: 35,
      startYear: 2026,
      iterations: 100,
    })

    expect(result.percentiles.p50).toHaveLength(0)
    expect(result.successRate).toBe(1)
  })
})
