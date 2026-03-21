import Decimal from 'decimal.js'
import type { Account, ScenarioAssumptions } from '@/types'
import { isDebtType } from '@/types'

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
 * Get expected annual return rate for an account based on its asset allocation
 */
function getAccountReturnRate(
  account: Account,
  assumptions: ScenarioAssumptions
): Decimal {
  if (isDebtType(account.type)) {
    return new Decimal(account.interestRate || '0').div(100).neg()
  }

  const alloc = account.assetAllocation
  const weightedReturn = new Decimal(alloc.stocks).div(100).times(assumptions.stockReturn)
    .plus(new Decimal(alloc.bonds).div(100).times(assumptions.bondReturn))
    .plus(new Decimal(alloc.cash).div(100).times(assumptions.cashReturn))

  return weightedReturn
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
      const returnRate = getAccountReturnRate(account, assumptions)

      // Grow the account
      const growth = balance.times(returnRate)
      balances[account.id] = balance.plus(growth)

      // Add annual contributions
      const annualContrib = contributionMap[account.id] || new Decimal(0)
      if (annualContrib.gt(0)) {
        balances[account.id] = balances[account.id].plus(annualContrib)
      }

      // For debts, apply payments (contributions reduce debt)
      if (isDebtType(account.type) && annualContrib.gt(0)) {
        balances[account.id] = Decimal.max(balances[account.id].minus(annualContrib.times(2)), 0)
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
