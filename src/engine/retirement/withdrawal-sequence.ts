import Decimal from 'decimal.js'
import type { Account, AccountType, Province } from '@/types'
import { estimateCppBenefit } from './cpp-benefit'
import { estimateOasBenefit } from './oas-benefit'
import { calculateRrifMinimum } from './rrif-rules'
import { CapitalGainsTracker } from './capital-gains-tracker'
import { calculateTotalTax } from '../tax/calculate-tax'
import { OAS_2026 } from '../constants/oas'
import { FEDERAL_TAX_2026 } from '../constants/tax-brackets-2026'

export interface WithdrawalProfileInput {
  currentAge: number
  province: Province
  yearsContributedCPP: number
  cppStartAge: number
  oasStartAge: number
}

export interface WithdrawalSequenceInput {
  accounts: Account[]
  selfProfile: WithdrawalProfileInput
  partnerProfile?: WithdrawalProfileInput
  retirementAge: number
  lifeExpectancy: number
  annualExpenses: Decimal
  inflationRate: Decimal
  expectedReturnRate: Decimal
}

export interface AccountWithdrawal {
  accountId: string
  accountType: AccountType
  amount: Decimal
  taxableAmount: Decimal
  reason: 'rrif-minimum' | 'meltdown' | 'spending-need' | 'oas-avoidance'
}

export interface WithdrawalYear {
  age: number
  partnerAge?: number
  incomeStreams: { source: string; amount: Decimal }[]
  withdrawals: AccountWithdrawal[]
  taxableIncome: Decimal
  totalTax: Decimal
  oasClawback: Decimal
  afterTaxIncome: Decimal
  accountBalances: Record<string, Decimal>
}

export interface WithdrawalPlan {
  years: WithdrawalYear[]
  lifetimeTaxPaid: Decimal
  totalOasClawback: Decimal
  accountDepletionAges: Record<string, number>
}

// First federal bracket ceiling (2026)
const FIRST_BRACKET_CEILING = new Decimal(FEDERAL_TAX_2026.brackets[0].max)
const OAS_CLAWBACK_THRESHOLD = new Decimal(OAS_2026.clawbackThreshold)
const OAS_CLAWBACK_RATE = new Decimal(OAS_2026.clawbackRate)

/**
 * Calculate a tax-optimal withdrawal plan for retirement.
 *
 * Strategy (greedy, year-by-year):
 * 1. Enforce RRIF mandatory minimums (age >= 72)
 * 2. Layer in CPP and OAS government income
 * 3. Fill spending gap in tax-optimal order: TFSA -> Non-Reg -> RRSP/RRIF
 * 5. Optionally melt down RRSP in low-income years before 65
 * 6. Grow remaining balances by expected return rate
 */
export function calculateWithdrawalPlan(input: WithdrawalSequenceInput): WithdrawalPlan {
  const {
    accounts,
    selfProfile,
    partnerProfile,
    retirementAge,
    lifeExpectancy,
    annualExpenses,
    inflationRate,
    expectedReturnRate,
  } = input

  // Only process accounts owned by 'self' (v1 does not handle couple sequencing)
  const selfAccounts = accounts.filter(
    (a) => a.owner === 'self' || a.owner === undefined || a.owner === null
  )

  // Determine partner age at retirement if present
  const partnerAgeAtRetirement =
    partnerProfile !== undefined
      ? partnerProfile.currentAge + (retirementAge - selfProfile.currentAge)
      : undefined

  const yearsToProject = lifeExpectancy - retirementAge

  // Initialize mutable account balances
  const balances: Record<string, Decimal> = {}
  for (const account of selfAccounts) {
    balances[account.id] = new Decimal(account.balance)
  }

  // Initialize CapitalGainsTrackers for non-registered accounts
  const capitalGainsTrackers: Record<string, CapitalGainsTracker> = {}
  for (const account of selfAccounts) {
    if (account.type === 'non-registered' || account.type === 'crypto') {
      capitalGainsTrackers[account.id] = new CapitalGainsTracker(
        new Decimal(account.balance)
      )
    }
  }

  const years: WithdrawalYear[] = []
  const accountDepletionAges: Record<string, number> = {}

  // Pre-calculate CPP annual benefit (fixed at claim age)
  // CPP can only be claimed between 60-70; clamp to valid range
  const clampedCppStartAge = Math.max(60, Math.min(70, selfProfile.cppStartAge))
  const cppResult = estimateCppBenefit(
    clampedCppStartAge,
    selfProfile.yearsContributedCPP
  )
  const cppAnnual = cppResult.annualBenefit

  for (let yearOffset = 0; yearOffset <= yearsToProject; yearOffset++) {
    const age = retirementAge + yearOffset
    const partnerAge =
      partnerAgeAtRetirement !== undefined ? partnerAgeAtRetirement + yearOffset : undefined

    const incomeStreams: { source: string; amount: Decimal }[] = []
    const withdrawals: AccountWithdrawal[] = []
    let taxableIncome = new Decimal(0)

    // -- Step 1: RRIF mandatory minimums --
    if (age >= 72) {
      for (const account of selfAccounts) {
        if (account.type === 'rrsp') {
          const balance = balances[account.id]
          if (balance.gt(0)) {
            const minimum = calculateRrifMinimum(age, balance)
            if (minimum.gt(0)) {
              const actualWithdrawal = Decimal.min(minimum, balance)
              withdrawals.push({
                accountId: account.id,
                accountType: account.type,
                amount: actualWithdrawal,
                taxableAmount: actualWithdrawal,
                reason: 'rrif-minimum',
              })
              balances[account.id] = balance.minus(actualWithdrawal)
              taxableIncome = taxableIncome.plus(actualWithdrawal)
            }
          }
        }
      }
    }

    // -- Step 2: Government income --
    if (age >= selfProfile.cppStartAge && selfProfile.cppStartAge <= 70) {
      incomeStreams.push({ source: 'cpp', amount: cppAnnual })
      taxableIncome = taxableIncome.plus(cppAnnual)
    }

    let grossOasAnnual = new Decimal(0)
    // OAS can only be claimed between 65-70; clamp to valid range
    const clampedOasStartAge = Math.max(65, Math.min(70, selfProfile.oasStartAge))
    if (age >= selfProfile.oasStartAge) {
      const oasResult = estimateOasBenefit(
        clampedOasStartAge,
        0,
        40,
        age
      )
      grossOasAnnual = oasResult.grossMonthlyBenefit.times(12)
      incomeStreams.push({ source: 'oas', amount: grossOasAnnual })
      taxableIncome = taxableIncome.plus(grossOasAnnual)
    }

    // -- Step 3: Calculate spending need --
    const inflatedExpenses = annualExpenses.times(
      inflationRate.plus(1).pow(yearOffset)
    )
    const totalExpenses = inflatedExpenses

    const rrifMinimumTotal = withdrawals.reduce(
      (sum, w) => (w.reason === 'rrif-minimum' ? sum.plus(w.amount) : sum),
      new Decimal(0)
    )
    const incomeStreamTotal = incomeStreams.reduce(
      (sum, s) => sum.plus(s.amount),
      new Decimal(0)
    )
    const totalAvailableIncome = incomeStreamTotal.plus(rrifMinimumTotal)
    let spendingGap = totalExpenses.minus(totalAvailableIncome)

    // -- Step 4: Fill spending gap in tax-optimal order --
    if (spendingGap.gt(0)) {
      // 5a. TFSA first (tax-free)
      for (const account of selfAccounts) {
        if (spendingGap.lte(0)) break
        if (account.type !== 'tfsa') continue
        const balance = balances[account.id]
        if (balance.lte(0)) continue
        const withdrawal = Decimal.min(spendingGap, balance)
        withdrawals.push({
          accountId: account.id,
          accountType: account.type,
          amount: withdrawal,
          taxableAmount: new Decimal(0),
          reason: 'spending-need',
        })
        balances[account.id] = balance.minus(withdrawal)
        spendingGap = spendingGap.minus(withdrawal)
      }

      // 5b. Non-registered (partial capital gains inclusion)
      for (const account of selfAccounts) {
        if (spendingGap.lte(0)) break
        if (account.type !== 'non-registered' && account.type !== 'crypto') continue
        const balance = balances[account.id]
        if (balance.lte(0)) continue
        const withdrawal = Decimal.min(spendingGap, balance)
        const tracker = capitalGainsTrackers[account.id]
        const { taxableAmount } = tracker
          ? tracker.withdraw(withdrawal)
          : { taxableAmount: new Decimal(0) }
        balances[account.id] = tracker
          ? tracker.getMarketValue()
          : balance.minus(withdrawal)
        withdrawals.push({
          accountId: account.id,
          accountType: account.type,
          amount: withdrawal,
          taxableAmount,
          reason: 'spending-need',
        })
        taxableIncome = taxableIncome.plus(taxableAmount)
        spendingGap = spendingGap.minus(withdrawal)
      }

      // 5c. RRSP/RRIF last (fully taxable)
      for (const account of selfAccounts) {
        if (spendingGap.lte(0)) break
        if (account.type !== 'rrsp') continue
        const balance = balances[account.id]
        if (balance.lte(0)) continue
        const withdrawal = Decimal.min(spendingGap, balance)
        withdrawals.push({
          accountId: account.id,
          accountType: account.type,
          amount: withdrawal,
          taxableAmount: withdrawal,
          reason: 'spending-need',
        })
        balances[account.id] = balance.minus(withdrawal)
        taxableIncome = taxableIncome.plus(withdrawal)
        spendingGap = spendingGap.minus(withdrawal)
      }
    }

    // -- Step 5: RRSP meltdown --
    if (age < 65 && taxableIncome.lt(FIRST_BRACKET_CEILING)) {
      const headroom = FIRST_BRACKET_CEILING.minus(taxableIncome)
      for (const account of selfAccounts) {
        if (headroom.lte(0)) break
        if (account.type !== 'rrsp') continue
        const balance = balances[account.id]
        if (balance.lte(0)) continue
        const meltdownAmount = Decimal.min(headroom, balance)
        if (meltdownAmount.lte(0)) continue
        withdrawals.push({
          accountId: account.id,
          accountType: account.type,
          amount: meltdownAmount,
          taxableAmount: meltdownAmount,
          reason: 'meltdown',
        })
        balances[account.id] = balance.minus(meltdownAmount)
        taxableIncome = taxableIncome.plus(meltdownAmount)
        break
      }
    }

    // -- Step 6: OAS clawback calculation --
    let oasClawback = new Decimal(0)
    if (age >= selfProfile.oasStartAge && taxableIncome.gt(OAS_CLAWBACK_THRESHOLD)) {
      oasClawback = taxableIncome
        .minus(OAS_CLAWBACK_THRESHOLD)
        .times(OAS_CLAWBACK_RATE)
      oasClawback = Decimal.min(oasClawback, grossOasAnnual)
    }

    // -- Step 7: Tax calculation --
    const taxResult = calculateTotalTax(taxableIncome, selfProfile.province)
    const totalTax = taxResult.totalTax

    // -- Step 8: After-tax income --
    const allWithdrawals = withdrawals.reduce((sum, w) => sum.plus(w.amount), new Decimal(0))
    const afterTaxIncome = incomeStreamTotal
      .plus(allWithdrawals)
      .minus(totalTax)
      .minus(oasClawback)

    // -- Step 9: Grow remaining balances --
    for (const account of selfAccounts) {
      const balance = balances[account.id]
      if (balance.gt(0)) {
        const accountRate = account.expectedReturnRate
          ? new Decimal(account.expectedReturnRate).div(100)
          : expectedReturnRate
        const grown = balance.times(accountRate.plus(1))
        balances[account.id] = grown

        if (capitalGainsTrackers[account.id]) {
          capitalGainsTrackers[account.id].applyGrowth(accountRate)
        }
      }

      if (balance.lte(0) && !(account.id in accountDepletionAges)) {
        accountDepletionAges[account.id] = age
      }
    }

    // -- Step 10: Record year --
    const accountBalancesSnapshot: Record<string, Decimal> = {}
    for (const account of selfAccounts) {
      accountBalancesSnapshot[account.id] = balances[account.id]
    }

    years.push({
      age,
      partnerAge,
      incomeStreams,
      withdrawals,
      taxableIncome,
      totalTax,
      oasClawback,
      afterTaxIncome,
      accountBalances: accountBalancesSnapshot,
    })
  }

  const lifetimeTaxPaid = years.reduce(
    (sum, y) => sum.plus(y.totalTax),
    new Decimal(0)
  )
  const totalOasClawback = years.reduce(
    (sum, y) => sum.plus(y.oasClawback),
    new Decimal(0)
  )

  return {
    years,
    lifetimeTaxPaid,
    totalOasClawback,
    accountDepletionAges,
  }
}
