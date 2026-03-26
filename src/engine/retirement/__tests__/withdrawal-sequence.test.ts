import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import {
  calculateWithdrawalPlan,
  type WithdrawalSequenceInput,
  type WithdrawalProfileInput,
} from '../withdrawal-sequence'
import type { Account } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<Account> & { id: string; type: Account['type']; balance: string }): Account {
  return {
    name: 'Test Account',
    currency: 'CAD',
    institution: 'Test Bank',
    expectedReturnRate: '5.0',
    contributionRoom: null,
    interestRate: null,
    monthlyPayment: null,
    notes: '',
    owner: 'self',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

const selfProfile: WithdrawalProfileInput = {
  currentAge: 60,
  province: 'ON',
  yearsContributedCPP: 35,
  cppStartAge: 65,
  oasStartAge: 65,
}

const baseInput = (overrides: Partial<WithdrawalSequenceInput> = {}): WithdrawalSequenceInput => ({
  accounts: [],
  selfProfile,
  retirementAge: 60,
  lifeExpectancy: 65, // short projection for speed
  annualExpenses: new Decimal(40000),
  inflationRate: new Decimal(0.02),
  expectedReturnRate: new Decimal(0.05),
  ...overrides,
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('calculateWithdrawalPlan', () => {
  // Test 1: Simple single-account TFSA withdrawal covers expenses
  it('draws from TFSA to cover expenses, producing no taxable income', () => {
    const tfsa = makeAccount({ id: 'tfsa1', type: 'tfsa', balance: '500000' })
    const input = baseInput({ accounts: [tfsa] })
    const plan = calculateWithdrawalPlan(input)

    expect(plan.years.length).toBeGreaterThan(0)

    const firstYear = plan.years[0]
    // TFSA withdrawal should be present
    const tfsaWithdrawal = firstYear.withdrawals.find(
      (w) => w.accountId === 'tfsa1' && w.reason === 'spending-need'
    )
    expect(tfsaWithdrawal).toBeDefined()
    // TFSA withdrawal is not taxable
    expect(tfsaWithdrawal!.taxableAmount.toNumber()).toBe(0)
    // Taxable income from TFSA-only year should be zero (no gov benefits yet, no other income)
    expect(firstYear.taxableIncome.toNumber()).toBe(0)
    // Total tax should be zero
    expect(firstYear.totalTax.toNumber()).toBe(0)
  })

  // Test 2: RRSP meltdown triggers in low-income years before 65
  it('triggers RRSP meltdown in low-income years before age 65', () => {
    const rrsp = makeAccount({ id: 'rrsp1', type: 'rrsp', balance: '300000' })
    const tfsa = makeAccount({ id: 'tfsa1', type: 'tfsa', balance: '500000' })
    // Large TFSA so spending gap is fully covered by TFSA — meltdown fills the bracket
    const input = baseInput({
      accounts: [tfsa, rrsp],
      annualExpenses: new Decimal(20000), // low enough that TFSA covers it all
    })
    const plan = calculateWithdrawalPlan(input)

    // At age 60 (< 65), meltdown should kick in for the RRSP
    const age60Year = plan.years.find((y) => y.age === 60)
    expect(age60Year).toBeDefined()
    const meltdownWithdrawal = age60Year!.withdrawals.find(
      (w) => w.reason === 'meltdown' && w.accountType === 'rrsp'
    )
    expect(meltdownWithdrawal).toBeDefined()
    // Meltdown amount should fill up toward the first bracket ceiling
    expect(meltdownWithdrawal!.amount.gt(0)).toBe(true)
    // Taxable income should be close to (but not exceed) the first bracket ceiling
    expect(age60Year!.taxableIncome.lte(57375)).toBe(true)
  })

  // Test 3: RRIF mandatory minimums kick in at age 72
  it('calculates RRIF mandatory minimums at age 72+', () => {
    const rrsp = makeAccount({ id: 'rrsp1', type: 'rrsp', balance: '300000' })
    const input = baseInput({
      accounts: [rrsp],
      retirementAge: 72,
      lifeExpectancy: 74,
      selfProfile: { ...selfProfile, currentAge: 72, cppStartAge: 72, oasStartAge: 72 },
    })
    const plan = calculateWithdrawalPlan(input)

    const age72Year = plan.years.find((y) => y.age === 72)
    expect(age72Year).toBeDefined()

    const rrifWithdrawal = age72Year!.withdrawals.find(
      (w) => w.reason === 'rrif-minimum'
    )
    expect(rrifWithdrawal).toBeDefined()
    // At age 72, rate is 5.28% of balance = 300000 * 0.0528 = 15840
    expect(rrifWithdrawal!.amount.toNumber()).toBeCloseTo(15840, 0)
    // RRIF withdrawal is fully taxable
    expect(rrifWithdrawal!.taxableAmount.toNumber()).toBeCloseTo(15840, 0)
  })

  // Test 4: OAS clawback when income exceeds threshold
  it('calculates OAS clawback when taxable income exceeds threshold', () => {
    // Large RRSP that generates RRIF minimums > $90,997 at age 72.
    // At age 72 with $2M: RRIF rate = 5.28% => $105,600, plus CPP ~$12k + OAS ~$9k => well above threshold.
    const rrsp = makeAccount({ id: 'rrsp1', type: 'rrsp', balance: '2000000' })
    const input = baseInput({
      accounts: [rrsp],
      retirementAge: 72,
      lifeExpectancy: 74,
      selfProfile: { ...selfProfile, currentAge: 72, cppStartAge: 65, oasStartAge: 65 },
      annualExpenses: new Decimal(50000),
    })
    const plan = calculateWithdrawalPlan(input)

    // Find a year where clawback is triggered
    const clawbackYear = plan.years.find((y) => y.oasClawback.gt(0))
    expect(clawbackYear).toBeDefined()
    expect(clawbackYear!.taxableIncome.gt(90997)).toBe(true)
    // Clawback = 15% of income above threshold, capped at gross OAS
    expect(clawbackYear!.oasClawback.gt(0)).toBe(true)
    expect(plan.totalOasClawback.gt(0)).toBe(true)
  })

  // Test 5: Tax-optimal ordering — TFSA drawn before RRSP
  it('prefers TFSA over RRSP for spending needs', () => {
    const tfsa = makeAccount({ id: 'tfsa1', type: 'tfsa', balance: '200000' })
    const rrsp = makeAccount({ id: 'rrsp1', type: 'rrsp', balance: '200000' })
    const input = baseInput({
      accounts: [tfsa, rrsp],
      annualExpenses: new Decimal(30000),
      retirementAge: 60,
      lifeExpectancy: 63,
    })
    const plan = calculateWithdrawalPlan(input)

    // In early years, TFSA should be used before RRSP for spending-need
    const firstYear = plan.years[0]
    const tfsaSpend = firstYear.withdrawals.find(
      (w) => w.accountId === 'tfsa1' && w.reason === 'spending-need'
    )
    const rrspSpend = firstYear.withdrawals.find(
      (w) => w.accountId === 'rrsp1' && w.reason === 'spending-need'
    )

    if (tfsaSpend && rrspSpend) {
      // If both are used, TFSA should be drawn first (higher amount or RRSP fills remainder)
      expect(tfsaSpend.amount.gte(rrspSpend.amount)).toBe(true)
    } else {
      // TFSA alone should cover expenses (no RRSP spending-need)
      expect(tfsaSpend).toBeDefined()
      expect(rrspSpend).toBeUndefined()
    }
  })

  // Test 6: Account depletion ages tracked correctly
  it('records the age at which an account balance first hits zero', () => {
    // Small TFSA that will be depleted in a few years
    const tfsa = makeAccount({
      id: 'tfsa-small',
      type: 'tfsa',
      balance: '50000',
      expectedReturnRate: '0', // no growth to make math predictable
    })
    const rrsp = makeAccount({ id: 'rrsp1', type: 'rrsp', balance: '500000' })
    const input = baseInput({
      accounts: [tfsa, rrsp],
      annualExpenses: new Decimal(40000),
      retirementAge: 60,
      lifeExpectancy: 70,
      expectedReturnRate: new Decimal(0), // no growth
    })
    const plan = calculateWithdrawalPlan(input)

    // TFSA of 50k at 40k/yr with no growth should deplete within a couple of years
    const depletionAge = plan.accountDepletionAges['tfsa-small']
    expect(depletionAge).toBeDefined()
    expect(depletionAge).toBeGreaterThanOrEqual(60)
    expect(depletionAge).toBeLessThanOrEqual(63) // should deplete quickly
  })

  // Test 7: CPP and OAS income reduces withdrawal needs
  it('reduces required withdrawals when CPP and OAS income is present', () => {
    const tfsa = makeAccount({ id: 'tfsa1', type: 'tfsa', balance: '500000' })

    // Scenario A: age < cppStartAge — no government income
    const inputNoBenefits = baseInput({
      accounts: [tfsa],
      selfProfile: { ...selfProfile, cppStartAge: 70, oasStartAge: 70 },
      retirementAge: 60,
      lifeExpectancy: 62,
      annualExpenses: new Decimal(40000),
    })
    const planNoBenefits = calculateWithdrawalPlan(inputNoBenefits)
    const withdrawalNoBenefits = planNoBenefits.years[0].withdrawals.reduce(
      (s, w) => s.plus(w.amount),
      new Decimal(0)
    )

    // Scenario B: CPP and OAS active from start
    const inputWithBenefits = baseInput({
      accounts: [tfsa],
      selfProfile: { ...selfProfile, cppStartAge: 65, oasStartAge: 65 },
      retirementAge: 65,
      lifeExpectancy: 67,
      annualExpenses: new Decimal(40000),
    })
    const planWithBenefits = calculateWithdrawalPlan(inputWithBenefits)
    const withdrawalWithBenefits = planWithBenefits.years[0].withdrawals.reduce(
      (s, w) => s.plus(w.amount),
      new Decimal(0)
    )

    // Plan with CPP+OAS should require less account withdrawal
    expect(withdrawalWithBenefits.lt(withdrawalNoBenefits)).toBe(true)
  })

  // Additional: lifetime tax paid aggregation
  it('aggregates lifetime tax paid across all years', () => {
    const rrsp = makeAccount({ id: 'rrsp1', type: 'rrsp', balance: '500000' })
    const input = baseInput({
      accounts: [rrsp],
      retirementAge: 65,
      lifeExpectancy: 70,
      selfProfile: { ...selfProfile, currentAge: 65, cppStartAge: 65, oasStartAge: 65 },
    })
    const plan = calculateWithdrawalPlan(input)

    const summedTax = plan.years.reduce(
      (sum, y) => sum.plus(y.totalTax),
      new Decimal(0)
    )
    expect(plan.lifetimeTaxPaid.toNumber()).toBeCloseTo(summedTax.toNumber(), 2)
    expect(plan.lifetimeTaxPaid.gt(0)).toBe(true)
  })

  // Additional: only 'self' accounts are processed
  it('ignores partner-owned accounts in withdrawal plan', () => {
    const selfTfsa = makeAccount({ id: 'self-tfsa', type: 'tfsa', balance: '100000', owner: 'self' })
    const partnerTfsa = makeAccount({ id: 'partner-tfsa', type: 'tfsa', balance: '200000', owner: 'partner' })
    const input = baseInput({
      accounts: [selfTfsa, partnerTfsa],
      annualExpenses: new Decimal(30000),
    })
    const plan = calculateWithdrawalPlan(input)

    // Partner TFSA should never appear in withdrawals or balances
    for (const year of plan.years) {
      const partnerWithdrawal = year.withdrawals.find((w) => w.accountId === 'partner-tfsa')
      expect(partnerWithdrawal).toBeUndefined()
      expect('partner-tfsa' in year.accountBalances).toBe(false)
    }
  })
})
