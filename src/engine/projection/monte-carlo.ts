import type { Account, ScenarioAssumptions, AccountType } from '@/types'
import { isDebtType } from '@/types'
import { DEFAULT_VOLATILITIES } from './account-defaults'

export type Regime = 'bull' | 'normal' | 'bear'

/** Regime multipliers applied to per-account mean and volatility */
const REGIME_MULTIPLIERS: Record<Regime, { meanMul: number; volMul: number }> = {
  bull:   { meanMul: 1.5, volMul: 0.8 },
  normal: { meanMul: 1.0, volMul: 1.0 },
  bear:   { meanMul: -0.5, volMul: 1.5 },
}

// Transition matrix: TRANSITIONS[from][to] = probability
const TRANSITIONS: Record<Regime, Record<Regime, number>> = {
  bull:   { bull: 0.70, normal: 0.25, bear: 0.05 },
  normal: { bull: 0.20, normal: 0.65, bear: 0.15 },
  bear:   { bull: 0.10, normal: 0.40, bear: 0.50 },
}

export function sampleRegime(current: Regime, rng: () => number): Regime {
  const probs = TRANSITIONS[current]
  const r = rng()
  let cumulative = 0
  for (const [regime, prob] of Object.entries(probs) as [Regime, number][]) {
    cumulative += prob
    if (r < cumulative) return regime
  }
  return 'normal'
}

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

export function tDistRandom(rng: () => number, df: number, mean: number, stdDev: number): number {
  const z = normalRandom(rng, 0, 1)

  let chiSq = 0
  for (let i = 0; i < df; i++) {
    const n = normalRandom(rng, 0, 1)
    chiSq += n * n
  }

  const t = z / Math.sqrt(chiSq / df)
  const tStdDev = Math.sqrt(df / (df - 2))
  return mean + (t / tStdDev) * stdDev
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
  const T_DF = 5

  // Build contribution map
  const contributionMap: Record<string, number> = {}
  for (const contrib of assumptions.monthlyContributions) {
    contributionMap[contrib.accountId] = parseFloat(contrib.amount) * 12
  }

  // Pre-compute account parameters
  const accountParams = accounts.map(a => ({
    id: a.id,
    type: a.type as AccountType,
    isDebt: isDebtType(a.type),
    initialBalance: parseFloat(a.balance || '0'),
    debtRate: isDebtType(a.type) ? parseFloat(a.interestRate || '0') / 100 : 0,
    expectedReturn: isDebtType(a.type) ? 0 : parseFloat(a.expectedReturnRate || '0') / 100,
    volatility: DEFAULT_VOLATILITIES[a.type as AccountType] ?? 0.12,
  }))

  // Store all simulation results: [iteration][yearOffset] = netWorth
  const allResults: number[][] = []
  let successCount = 0

  for (let iter = 0; iter < iterations; iter++) {
    const balances: Record<string, number> = {}
    for (const param of accountParams) {
      balances[param.id] = param.initialBalance
    }

    const yearlyNetWorth: number[] = []

    // Record starting net worth
    let netWorth = 0
    for (const param of accountParams) {
      netWorth += param.isDebt ? -balances[param.id] : balances[param.id]
    }
    yearlyNetWorth.push(netWorth)

    let neverNegative = true
    let regime: Regime = 'normal'

    for (let year = 1; year <= yearsToProject; year++) {
      regime = sampleRegime(regime, rng)
      const regimeMul = REGIME_MULTIPLIERS[regime]

      // Draw a shared market factor for this year (correlates accounts)
      const marketFactor = tDistRandom(rng, T_DF, 0, 1)

      for (const param of accountParams) {
        if (param.isDebt) {
          balances[param.id] *= (1 + param.debtRate)
        } else {
          // Apply regime multiplier to the expected return
          const regimeMean = param.expectedReturn * regimeMul.meanMul
          const regimeVol = param.volatility * regimeMul.volMul

          // Use shared market factor scaled by per-account volatility
          const accountReturn = regimeMean + marketFactor * regimeVol

          balances[param.id] *= (1 + accountReturn)
        }

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
      for (const param of accountParams) {
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
