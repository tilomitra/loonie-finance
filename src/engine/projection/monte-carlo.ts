import type { Account, ScenarioAssumptions } from '@/types'
import { isDebtType } from '@/types'

export interface MonteCarloInput {
  accounts: Account[]
  assumptions: ScenarioAssumptions
  currentAge: number
  startYear: number
  iterations: number
  seed?: number
}

export interface MonteCarloPoint {
  year: number
  age: number
  netWorth: number
}

export interface MonteCarloResult {
  percentiles: {
    p5: MonteCarloPoint[]
    p25: MonteCarloPoint[]
    p50: MonteCarloPoint[]
    p75: MonteCarloPoint[]
    p95: MonteCarloPoint[]
  }
  successRate: number
  iterations: number
  median: MonteCarloPoint[]
}

// Simple seeded PRNG (mulberry32)
function createRng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Box-Muller transform for normal distribution
function normalRandom(rng: () => number, mean: number, stdDev: number): number {
  const u1 = rng()
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return z * stdDev + mean
}

// Standard deviations for asset classes (annual)
const ASSET_STD_DEVS = {
  stocks: 0.16,
  bonds: 0.06,
  cash: 0.01,
}

function getAccountReturnParams(
  account: Account,
  assumptions: ScenarioAssumptions
): { mean: number; stdDev: number } {
  if (isDebtType(account.type)) {
    const rate = parseFloat(account.interestRate || '0') / 100
    return { mean: -rate, stdDev: 0 }
  }

  const alloc = account.assetAllocation
  const stockW = alloc.stocks / 100
  const bondW = alloc.bonds / 100
  const cashW = alloc.cash / 100

  const mean =
    stockW * parseFloat(assumptions.stockReturn) +
    bondW * parseFloat(assumptions.bondReturn) +
    cashW * parseFloat(assumptions.cashReturn)

  // Portfolio std dev (simplified - assumes no correlation)
  const variance =
    stockW ** 2 * ASSET_STD_DEVS.stocks ** 2 +
    bondW ** 2 * ASSET_STD_DEVS.bonds ** 2 +
    cashW ** 2 * ASSET_STD_DEVS.cash ** 2

  return { mean, stdDev: Math.sqrt(variance) }
}

export function runMonteCarloSimulation(input: MonteCarloInput): MonteCarloResult {
  const { accounts, assumptions, currentAge, startYear, iterations, seed = 42 } = input
  const yearsToProject = assumptions.lifeExpectancy - currentAge

  if (yearsToProject <= 0) {
    return {
      percentiles: { p5: [], p25: [], p50: [], p75: [], p95: [] },
      successRate: 1,
      iterations,
      median: [],
    }
  }

  const rng = createRng(seed)

  // Build contribution map
  const contributionMap: Record<string, number> = {}
  for (const contrib of assumptions.monthlyContributions) {
    contributionMap[contrib.accountId] = parseFloat(contrib.amount) * 12
  }

  // Get return parameters for each account
  const returnParams = accounts.map(a => ({
    id: a.id,
    ...getAccountReturnParams(a, assumptions),
    isDebt: isDebtType(a.type),
    initialBalance: parseFloat(a.balance || '0'),
  }))

  // Store all simulation results: [iteration][yearOffset] = netWorth
  const allResults: number[][] = []
  let successCount = 0

  for (let iter = 0; iter < iterations; iter++) {
    const balances: Record<string, number> = {}
    for (const param of returnParams) {
      balances[param.id] = param.initialBalance
    }

    const yearlyNetWorth: number[] = []

    // Record starting net worth
    let netWorth = 0
    for (const param of returnParams) {
      netWorth += param.isDebt ? -balances[param.id] : balances[param.id]
    }
    yearlyNetWorth.push(netWorth)

    let neverNegative = true

    for (let year = 1; year <= yearsToProject; year++) {
      for (const param of returnParams) {
        const annualReturn = normalRandom(rng, param.mean, param.stdDev)
        balances[param.id] *= (1 + annualReturn)

        // Add contributions
        const contrib = contributionMap[param.id] || 0
        if (contrib > 0) {
          if (param.isDebt) {
            balances[param.id] = Math.max(balances[param.id] - contrib * 2, 0)
          } else {
            balances[param.id] += contrib
          }
        }

        // Prevent negative asset balances
        if (!param.isDebt && balances[param.id] < 0) {
          balances[param.id] = 0
        }
      }

      netWorth = 0
      for (const param of returnParams) {
        netWorth += param.isDebt ? -balances[param.id] : balances[param.id]
      }
      yearlyNetWorth.push(netWorth)

      if (netWorth < 0) neverNegative = false
    }

    allResults.push(yearlyNetWorth)
    if (neverNegative) successCount++
  }

  // Calculate percentiles
  const percentilePoints = (pct: number): MonteCarloPoint[] => {
    const points: MonteCarloPoint[] = []
    for (let yearOffset = 0; yearOffset <= yearsToProject; yearOffset++) {
      const values = allResults.map(r => r[yearOffset]).sort((a, b) => a - b)
      const idx = Math.floor(values.length * pct)
      points.push({
        year: startYear + yearOffset,
        age: currentAge + yearOffset,
        netWorth: values[idx],
      })
    }
    return points
  }

  return {
    percentiles: {
      p5: percentilePoints(0.05),
      p25: percentilePoints(0.25),
      p50: percentilePoints(0.50),
      p75: percentilePoints(0.75),
      p95: percentilePoints(0.95),
    },
    successRate: successCount / iterations,
    iterations,
    median: percentilePoints(0.50),
  }
}
