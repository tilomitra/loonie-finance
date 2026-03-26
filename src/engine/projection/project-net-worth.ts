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
        // Use scenario contribution if set, otherwise fall back to account's monthlyPayment
        const payment = annualContrib.gt(0)
          ? annualContrib
          : new Decimal(account.monthlyPayment || '0').times(12)
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

