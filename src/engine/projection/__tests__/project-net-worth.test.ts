import { describe, it, expect } from 'vitest'
import { projectNetWorth } from '../project-net-worth'
import type { Account, ScenarioAssumptions } from '@/types'

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'test-1',
  name: 'Test Account',
  type: 'non-registered',
  balance: '100000',
  currency: 'CAD',
  institution: '',
  assetAllocation: { stocks: 100, bonds: 0, cash: 0, other: 0 },
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
  lifeExpectancy: 40, // Only project to age 40 for test
  cppStartAge: 65,
  oasStartAge: 65,
  province: 'ON',
  annualIncome: '80000',
  annualExpenses: '50000',
  annualSavingsRate: '0.20',
  monthlyContributions: [],
}

describe('Project Net Worth', () => {
  it('should return empty array when life expectancy is reached', () => {
    const result = projectNetWorth({
      accounts: [makeAccount()],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 30 },
      currentAge: 35,
      startYear: 2026,
    })
    expect(result).toHaveLength(0)
  })

  it('should grow a 100% stock account at the stock return rate', () => {
    const result = projectNetWorth({
      accounts: [makeAccount()],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 31 },
      currentAge: 30,
      startYear: 2026,
    })

    expect(result).toHaveLength(2) // year 0 and year 1
    expect(result[0].netWorth.toNumber()).toBe(100000)
    // After 1 year at 7%: 107000
    expect(result[1].netWorth.toNumber()).toBeCloseTo(107000, 0)
  })

  it('should project multiple years correctly', () => {
    const result = projectNetWorth({
      accounts: [makeAccount()],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 40 },
      currentAge: 30,
      startYear: 2026,
    })

    expect(result).toHaveLength(11) // years 0-10
    // After 10 years at 7%: ~196,715
    expect(result[10].netWorth.toNumber()).toBeCloseTo(196715, -2)
  })

  it('should start with current balances at year 0', () => {
    const result = projectNetWorth({
      accounts: [makeAccount({ balance: '50000' })],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 31 },
      currentAge: 30,
      startYear: 2026,
    })

    expect(result[0].netWorth.toNumber()).toBe(50000)
  })
})
