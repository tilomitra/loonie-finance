import Decimal from 'decimal.js'
import type { Account, ScenarioAssumptions, LifeEvent } from '@/types'
import { isDebtType } from '@/types'
import { buildAnnualCashFlows } from './cash-flow-builder'
import { calculateRrifMinimum } from '../retirement/rrif-rules'

export interface ProjectionInput {
  accounts: Account[]
  assumptions: ScenarioAssumptions
  currentAge: number
  startYear: number
}

export interface ProjectionPoint {
  year: number
  age: number
  netWorth: Decimal
  totalAssets: Decimal
  totalDebts: Decimal
  accountBreakdown: Record<string, Decimal>
}

/**
 * Get expected annual return rate for an account (assets only)
 */
function getAccountReturnRate(account: Account): Decimal {
  return new Decimal(account.expectedReturnRate || '0').div(100)
}

/**
 * Get annual interest rate for a debt account
 */
function getDebtInterestRate(account: Account): Decimal {
  return new Decimal(account.interestRate || '0').div(100)
}

/**
 * Project net worth year by year
 */
export function projectNetWorth(input: ProjectionInput): ProjectionPoint[] {
  const { accounts, assumptions, currentAge, startYear } = input
  const yearsToProject = assumptions.lifeExpectancy - currentAge

  if (yearsToProject <= 0) return []

  // Initialize account balances
  const balances: Record<string, Decimal> = {}
  for (const account of accounts) {
    balances[account.id] = new Decimal(account.balance || '0')
  }

  // Build contribution map
  const contributionMap: Record<string, Decimal> = {}
  for (const contrib of assumptions.monthlyContributions) {
    contributionMap[contrib.accountId] = new Decimal(contrib.amount).times(12) // Convert monthly to annual
  }

  const points: ProjectionPoint[] = []

  // Record starting point
  points.push(buildPoint(0, currentAge, startYear, accounts, balances))

  for (let yearOffset = 1; yearOffset <= yearsToProject; yearOffset++) {
    const age = currentAge + yearOffset

    for (const account of accounts) {
      const balance = balances[account.id]
      const annualContrib = contributionMap[account.id] || new Decimal(0)

      if (isDebtType(account.type)) {
        // Debts: interest accrues, payments reduce balance, floor at 0
        const interest = balance.times(getDebtInterestRate(account))
        const payment = annualContrib.gt(0) ? annualContrib : new Decimal(0)
        balances[account.id] = Decimal.max(balance.plus(interest).minus(payment), new Decimal(0))
      } else {
        // Assets: compound growth + contributions
        const returnRate = getAccountReturnRate(account)
        balances[account.id] = balance.times(returnRate.plus(1)).plus(annualContrib)
      }
    }

    points.push(buildPoint(yearOffset, age, startYear + yearOffset, accounts, balances))
  }

  return points
}

function buildPoint(
  _yearOffset: number,
  age: number,
  year: number,
  accounts: Account[],
  balances: Record<string, Decimal>
): ProjectionPoint {
  let totalAssets = new Decimal(0)
  let totalDebts = new Decimal(0)
  const accountBreakdown: Record<string, Decimal> = {}

  for (const account of accounts) {
    const bal = balances[account.id] || new Decimal(0)
    accountBreakdown[account.id] = bal
    if (isDebtType(account.type)) {
      totalDebts = totalDebts.plus(bal)
    } else {
      totalAssets = totalAssets.plus(bal)
    }
  }

  return {
    year,
    age,
    netWorth: totalAssets.minus(totalDebts),
    totalAssets,
    totalDebts,
    accountBreakdown,
  }
}

// ---------------------------------------------------------------------------
// V2: Projection with life events
// ---------------------------------------------------------------------------

export interface ProjectionInputV2 extends ProjectionInput {
  lifeEvents?: LifeEvent[]
  partnerAge?: number
}

/**
 * Project net worth year by year, incorporating life events and RRIF rules.
 *
 * If no life events are provided, delegates to the existing projectNetWorth()
 * for full backward compatibility.
 *
 * Life event integration strategy (V1 approximation):
 *  - Each year the net cash flow from life events is computed by buildAnnualCashFlows().
 *  - Positive net cash flow is distributed proportionally across non-debt investment
 *    accounts (by current balance weight); if no investment accounts exist it is added
 *    to the first non-debt account.
 *  - Negative net cash flow (expenses exceed income) is withdrawn proportionally from
 *    the same non-debt accounts, flooring each balance at zero.
 *  - RRSP accounts are subject to mandatory RRIF minimum withdrawals starting at age 72.
 *    The withdrawal is subtracted from the RRSP balance each year and does NOT flow back
 *    into other accounts (it is consumed as income/spending outside the portfolio).
 */
export function projectNetWorthWithEvents(input: ProjectionInputV2): ProjectionPoint[] {
  const { accounts, assumptions, currentAge, startYear, lifeEvents, partnerAge } = input

  // Delegate to existing function when there are no life events
  if (!lifeEvents || lifeEvents.length === 0) {
    return projectNetWorth(input)
  }

  const yearsToProject = assumptions.lifeExpectancy - currentAge
  if (yearsToProject <= 0) return []

  // Build life-event cash flows for every year offset
  const cashFlows = buildAnnualCashFlows(lifeEvents, currentAge, partnerAge, yearsToProject)

  // Initialize account balances
  const balances: Record<string, Decimal> = {}
  for (const account of accounts) {
    balances[account.id] = new Decimal(account.balance || '0')
  }

  // Build contribution map (annual amounts)
  const contributionMap: Record<string, Decimal> = {}
  for (const contrib of assumptions.monthlyContributions) {
    contributionMap[contrib.accountId] = new Decimal(contrib.amount).times(12)
  }

  // Identify non-debt accounts available for cash-flow distribution
  const investmentAccounts = accounts.filter((a) => !isDebtType(a.type))

  const points: ProjectionPoint[] = []
  points.push(buildPoint(0, currentAge, startYear, accounts, balances))

  for (let yearOffset = 1; yearOffset <= yearsToProject; yearOffset++) {
    const age = currentAge + yearOffset

    // -----------------------------------------------------------------------
    // Step 1: Grow each account and apply deliberate contributions
    // -----------------------------------------------------------------------
    for (const account of accounts) {
      const balance = balances[account.id]
      const annualContrib = contributionMap[account.id] || new Decimal(0)

      if (isDebtType(account.type)) {
        // Debts: interest accrues, payments reduce balance, floor at 0
        const interest = balance.times(getDebtInterestRate(account))
        const payment = annualContrib.gt(0) ? annualContrib : new Decimal(0)
        balances[account.id] = Decimal.max(balance.plus(interest).minus(payment), new Decimal(0))
      } else {
        // Assets: compound growth + contributions
        const returnRate = getAccountReturnRate(account)
        balances[account.id] = balance.times(returnRate.plus(1)).plus(annualContrib)
      }
    }

    // -----------------------------------------------------------------------
    // Step 2: RRIF mandatory minimum withdrawals (age >= 72)
    // -----------------------------------------------------------------------
    for (const account of accounts) {
      if (account.type === 'rrsp') {
        const rrifMin = calculateRrifMinimum(age, balances[account.id])
        if (rrifMin.gt(0)) {
          balances[account.id] = Decimal.max(balances[account.id].minus(rrifMin), 0)
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 3: Apply life-event net cash flow
    // -----------------------------------------------------------------------
    const cashFlow = cashFlows.get(yearOffset)
    const netCashFlow = cashFlow ? cashFlow.netCashFlow : new Decimal(0)

    if (!netCashFlow.isZero()) {
      // Compute total non-debt balance for proportional weighting
      let totalInvestmentBalance = new Decimal(0)
      for (const account of investmentAccounts) {
        totalInvestmentBalance = totalInvestmentBalance.plus(balances[account.id])
      }

      if (netCashFlow.gt(0)) {
        // Distribute positive cash flow proportionally by balance weight
        if (totalInvestmentBalance.gt(0)) {
          for (const account of investmentAccounts) {
            const weight = balances[account.id].div(totalInvestmentBalance)
            balances[account.id] = balances[account.id].plus(netCashFlow.times(weight))
          }
        } else if (investmentAccounts.length > 0) {
          // All accounts are at zero — put it all in the first one
          balances[investmentAccounts[0].id] = balances[investmentAccounts[0].id].plus(netCashFlow)
        }
      } else {
        // Withdraw proportionally from non-debt accounts, floor at zero
        const withdrawal = netCashFlow.abs()
        if (totalInvestmentBalance.gt(0)) {
          for (const account of investmentAccounts) {
            const weight = balances[account.id].div(totalInvestmentBalance)
            const accountWithdrawal = withdrawal.times(weight)
            balances[account.id] = Decimal.max(balances[account.id].minus(accountWithdrawal), 0)
          }
        }
        // If no investment balance, nothing to withdraw from — balances stay at zero
      }
    }

    points.push(buildPoint(yearOffset, age, startYear + yearOffset, accounts, balances))
  }

  return points
}
