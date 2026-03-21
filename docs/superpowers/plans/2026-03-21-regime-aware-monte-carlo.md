# Regime-Aware Monte Carlo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the naive i.i.d. normal Monte Carlo with a regime-switching model featuring fat tails and correlated asset returns, and surface it on the Projections page as an on-demand confidence band chart.

**Architecture:** The engine (`monte-carlo.ts`) is rewritten with three composable primitives — regime sampling, t-distribution draws, and correlated return generation — that the main simulation loop calls per year. The UI adds a single Card to the existing Projections page with on-demand computation and a Recharts fan chart.

**Tech Stack:** TypeScript, Vitest, React 19, Recharts, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-21-regime-aware-monte-carlo-design.md`

---

### Task 1: Remove duplicate MonteCarloResult from types

**Files:**
- Modify: `src/types/index.ts:105-115`

- [ ] **Step 1: Remove the unused MonteCarloResult interface**

Delete lines 105-115 from `src/types/index.ts`:

```typescript
// DELETE THIS ENTIRE BLOCK:
export interface MonteCarloResult {
  percentiles: {
    p5: ProjectionPoint[]
    p25: ProjectionPoint[]
    p50: ProjectionPoint[]
    p75: ProjectionPoint[]
    p95: ProjectionPoint[]
  }
  successRate: number
  iterations: number
}
```

- [ ] **Step 2: Verify nothing imports it**

Run: `npx tsc --noEmit`
Expected: No errors. The engine's local `MonteCarloResult` in `monte-carlo.ts` is the one actually used.

- [ ] **Step 3: Run existing tests**

Run: `npm test`
Expected: All 51 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "fix: remove duplicate MonteCarloResult type from types/index.ts"
```

---

### Task 2: Add regime types and constants

**Files:**
- Modify: `src/engine/projection/monte-carlo.ts`

- [ ] **Step 1: Add regime types and constant data**

Add these types and constants at the top of `monte-carlo.ts`, below the existing imports:

```typescript
export type Regime = 'bull' | 'normal' | 'bear'

export interface RegimeParams {
  stockMean: number
  stockVol: number
  bondMean: number
  bondVol: number
  cashMean: number
  cashVol: number
  correlation: number
}

const REGIME_PARAMS: Record<Regime, RegimeParams> = {
  bull:   { stockMean: 0.12, stockVol: 0.12, bondMean: 0.04,  bondVol: 0.05, cashMean: 0.025, cashVol: 0.01, correlation:  0.2 },
  normal: { stockMean: 0.07, stockVol: 0.16, bondMean: 0.035, bondVol: 0.06, cashMean: 0.02,  cashVol: 0.01, correlation:  0.0 },
  bear:   { stockMean:-0.15, stockVol: 0.25, bondMean: 0.05,  bondVol: 0.08, cashMean: 0.015, cashVol: 0.01, correlation: -0.3 },
}

// Transition matrix: TRANSITIONS[from][to] = probability
const TRANSITIONS: Record<Regime, Record<Regime, number>> = {
  bull:   { bull: 0.70, normal: 0.25, bear: 0.05 },
  normal: { bull: 0.20, normal: 0.65, bear: 0.15 },
  bear:   { bull: 0.10, normal: 0.40, bear: 0.50 },
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run existing tests**

Run: `npm test`
Expected: All 51 tests pass (nothing changed behaviorally yet).

- [ ] **Step 4: Commit**

```bash
git add src/engine/projection/monte-carlo.ts
git commit -m "feat: add regime types and market parameter constants"
```

---

### Task 3: Implement and test `sampleRegime`

**Files:**
- Modify: `src/engine/projection/monte-carlo.ts`
- Modify: `src/engine/projection/__tests__/monte-carlo.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `monte-carlo.test.ts`:

```typescript
import { runMonteCarloSimulation, sampleRegime } from '../monte-carlo'

// ... existing tests ...

describe('sampleRegime', () => {
  it('should transition from bear with correct approximate probabilities', () => {
    const rng = createTestRng(42)
    const counts = { bull: 0, normal: 0, bear: 0 }
    const n = 10000

    for (let i = 0; i < n; i++) {
      counts[sampleRegime('bear', rng)]++
    }

    // Bear -> bear ~50%, normal ~40%, bull ~10% (within 5% tolerance)
    expect(counts.bear / n).toBeCloseTo(0.50, 1)
    expect(counts.normal / n).toBeCloseTo(0.40, 1)
    expect(counts.bull / n).toBeCloseTo(0.10, 1)
  })
})
```

Also add a helper `createTestRng` at the top of the test file (or import `createRng` if exported):

```typescript
// Simple seeded PRNG for tests (same as engine's mulberry32)
function createTestRng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — `sampleRegime` is not exported.

- [ ] **Step 3: Implement sampleRegime**

Add to `monte-carlo.ts` and export it:

```typescript
export function sampleRegime(current: Regime, rng: () => number): Regime {
  const probs = TRANSITIONS[current]
  const r = rng()
  let cumulative = 0
  for (const [regime, prob] of Object.entries(probs) as [Regime, number][]) {
    cumulative += prob
    if (r < cumulative) return regime
  }
  return 'normal' // fallback (should not reach)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass including the new `sampleRegime` test.

- [ ] **Step 5: Commit**

```bash
git add src/engine/projection/monte-carlo.ts src/engine/projection/__tests__/monte-carlo.test.ts
git commit -m "feat: implement and test Markov regime transitions"
```

---

### Task 4: Implement and test `tDistRandom`

**Files:**
- Modify: `src/engine/projection/monte-carlo.ts`
- Modify: `src/engine/projection/__tests__/monte-carlo.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `monte-carlo.test.ts`:

```typescript
import { runMonteCarloSimulation, sampleRegime, tDistRandom } from '../monte-carlo'

// ... existing tests ...

describe('tDistRandom', () => {
  it('should produce heavier tails than normal distribution (kurtosis > 3)', () => {
    const rng = createTestRng(123)
    const n = 50000
    const samples: number[] = []

    for (let i = 0; i < n; i++) {
      samples.push(tDistRandom(rng, 5, 0, 1))
    }

    const mean = samples.reduce((a, b) => a + b, 0) / n
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    const fourthMoment = samples.reduce((a, b) => a + (b - mean) ** 4, 0) / n
    const kurtosis = fourthMoment / (variance ** 2)

    // t(5) has theoretical kurtosis of 9 (excess kurtosis 6)
    // Normal has kurtosis of 3. We just need > 3 to confirm fat tails.
    expect(kurtosis).toBeGreaterThan(4)
  })

  it('should center around the specified mean', () => {
    const rng = createTestRng(456)
    const n = 50000
    const samples: number[] = []

    for (let i = 0; i < n; i++) {
      samples.push(tDistRandom(rng, 5, 0.07, 0.16))
    }

    const mean = samples.reduce((a, b) => a + b, 0) / n
    expect(mean).toBeCloseTo(0.07, 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — `tDistRandom` is not exported.

- [ ] **Step 3: Implement tDistRandom**

Add to `monte-carlo.ts` and export. Keep the existing `normalRandom` (used internally by `tDistRandom`):

```typescript
export function tDistRandom(rng: () => number, df: number, mean: number, stdDev: number): number {
  // Generate standard normal via Box-Muller
  const z = normalRandom(rng, 0, 1)

  // Generate chi-squared(df) as sum of df squared normals
  let chiSq = 0
  for (let i = 0; i < df; i++) {
    const n = normalRandom(rng, 0, 1)
    chiSq += n * n
  }

  // t = z / sqrt(chiSq / df)
  const t = z / Math.sqrt(chiSq / df)

  // Scale to desired mean and stdDev
  // t(df) has variance df/(df-2), so scale factor is stdDev / sqrt(df/(df-2))
  const tStdDev = Math.sqrt(df / (df - 2))
  return mean + (t / tStdDev) * stdDev
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/projection/monte-carlo.ts src/engine/projection/__tests__/monte-carlo.test.ts
git commit -m "feat: implement and test Student's t distribution for fat tails"
```

---

### Task 5: Implement and test `correlatedReturns`

**Files:**
- Modify: `src/engine/projection/monte-carlo.ts`
- Modify: `src/engine/projection/__tests__/monte-carlo.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `monte-carlo.test.ts`:

```typescript
import {
  runMonteCarloSimulation, sampleRegime, tDistRandom, correlatedReturns,
  type RegimeParams,
} from '../monte-carlo'

// ... existing tests ...

describe('correlatedReturns', () => {
  it('should produce negatively correlated stock/bond returns in bear regime', () => {
    const rng = createTestRng(789)
    const bearRegime: RegimeParams = {
      stockMean: -0.15, stockVol: 0.25,
      bondMean: 0.05, bondVol: 0.08,
      cashMean: 0.015, cashVol: 0.01,
      correlation: -0.3,
    }

    const n = 10000
    const stockReturns: number[] = []
    const bondReturns: number[] = []

    for (let i = 0; i < n; i++) {
      const r = correlatedReturns(rng, bearRegime, 5)
      stockReturns.push(r.stockReturn)
      bondReturns.push(r.bondReturn)
    }

    // Compute sample correlation
    const stockMean = stockReturns.reduce((a, b) => a + b, 0) / n
    const bondMean = bondReturns.reduce((a, b) => a + b, 0) / n
    let cov = 0, stockVar = 0, bondVar = 0
    for (let i = 0; i < n; i++) {
      const ds = stockReturns[i] - stockMean
      const db = bondReturns[i] - bondMean
      cov += ds * db
      stockVar += ds * ds
      bondVar += db * db
    }
    const correlation = cov / Math.sqrt(stockVar * bondVar)

    expect(correlation).toBeLessThan(0)
    expect(correlation).toBeGreaterThan(-0.6) // should be around -0.3
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — `correlatedReturns` is not exported.

- [ ] **Step 3: Implement correlatedReturns**

Add to `monte-carlo.ts` and export:

```typescript
export function correlatedReturns(
  rng: () => number,
  regime: RegimeParams,
  df: number
): { stockReturn: number; bondReturn: number; cashReturn: number } {
  // Draw two independent t-distributed variables
  const z1 = tDistRandom(rng, df, 0, 1)
  const z2 = tDistRandom(rng, df, 0, 1)

  // Cholesky decomposition of 2x2 correlation matrix
  const rho = regime.correlation
  const choleskyFactor = Math.sqrt(1 - rho * rho)

  // Correlated draws (standardized)
  const stockZ = z1
  const bondZ = rho * z1 + choleskyFactor * z2

  // Scale to regime parameters
  const stockReturn = regime.stockMean + stockZ * regime.stockVol
  const bondReturn = regime.bondMean + bondZ * regime.bondVol

  // Cash is independent
  const cashReturn = tDistRandom(rng, df, regime.cashMean, regime.cashVol)

  return { stockReturn, bondReturn, cashReturn }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/projection/monte-carlo.ts src/engine/projection/__tests__/monte-carlo.test.ts
git commit -m "feat: implement and test Cholesky-correlated asset return generation"
```

---

### Task 6: Rewire `runMonteCarloSimulation` to use regime model

**Files:**
- Modify: `src/engine/projection/monte-carlo.ts`

- [ ] **Step 1: Rewrite the simulation loop**

Replace the inner simulation loop in `runMonteCarloSimulation`. The key changes:
1. Each iteration starts with `regime = 'normal'`
2. Each year: transition regime via `sampleRegime`, then generate correlated returns via `correlatedReturns`
3. Apply returns to each account based on asset allocation weights
4. Remove the old `getAccountReturnParams` function and `ASSET_STD_DEVS` constant (no longer needed)

Replace the simulation loop (lines 119-168) with:

```typescript
  const T_DF = 5 // degrees of freedom for Student's t

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
      const regimeParams = REGIME_PARAMS[regime]
      const returns = correlatedReturns(rng, regimeParams, T_DF)

      for (const param of accountParams) {
        if (param.isDebt) {
          // Debts grow by interest rate (deterministic)
          balances[param.id] *= (1 + param.debtRate)
        } else {
          // Weighted return based on asset allocation
          const accountReturn =
            param.stockW * returns.stockReturn +
            param.bondW * returns.bondReturn +
            param.cashW * returns.cashReturn

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
```

Also replace the `returnParams` setup (lines 108-113) to pre-compute allocation weights:

```typescript
  const accountParams = accounts.map(a => {
    const alloc = a.assetAllocation
    return {
      id: a.id,
      isDebt: isDebtType(a.type),
      initialBalance: parseFloat(a.balance || '0'),
      debtRate: isDebtType(a.type) ? parseFloat(a.interestRate || '0') / 100 : 0,
      stockW: alloc.stocks / 100,
      bondW: alloc.bonds / 100,
      cashW: alloc.cash / 100,
    }
  })
```

Finally, delete `getAccountReturnParams` and `ASSET_STD_DEVS` — they are no longer used.

- [ ] **Step 2: Run all existing tests**

Run: `npm test -- --reporter=verbose 2>&1 | tail -30`
Expected: All existing tests pass. The seed-based tests will produce different values now (different RNG consumption pattern), but structural assertions (percentile ordering, start values, point counts) should still hold. If the seed reproducibility test compares exact values between two runs of the *same* input, it will still pass since the RNG is deterministic.

- [ ] **Step 3: Commit**

```bash
git add src/engine/projection/monte-carlo.ts
git commit -m "feat: rewire Monte Carlo simulation to use regime-switching model"
```

---

### Task 7: Add integration test for wider spread

**Files:**
- Modify: `src/engine/projection/__tests__/monte-carlo.test.ts`

- [ ] **Step 1: Write the spread comparison test**

Add to the existing `'Monte Carlo Simulation'` describe block:

```typescript
  it('should produce wider p5-p95 spread than naive i.i.d. model', () => {
    const result = runMonteCarloSimulation({
      accounts: [makeAccount()],
      assumptions: { ...defaultAssumptions, lifeExpectancy: 60 },
      currentAge: 30,
      startYear: 2026,
      iterations: 1000,
      seed: 42,
    })

    const lastIdx = result.percentiles.p50.length - 1
    const spread = result.percentiles.p95[lastIdx].netWorth - result.percentiles.p5[lastIdx].netWorth

    // A naive i.i.d. normal model with 7% mean, ~10% portfolio vol over 30 years
    // would produce a spread roughly proportional to sqrt(30) * 2 * 1.645 * vol * startBalance
    // ≈ sqrt(30) * 2 * 1.645 * 0.10 * 100000 ≈ $180K
    // The regime model should produce a wider spread due to volatility clustering + fat tails
    expect(spread).toBeGreaterThan(180000)
  })
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: PASS — the regime-switching model naturally produces wider tails.

- [ ] **Step 3: Commit**

```bash
git add src/engine/projection/__tests__/monte-carlo.test.ts
git commit -m "test: add spread comparison test for regime-aware Monte Carlo"
```

---

### Task 8: Add Monte Carlo card UI to Projections page

**Files:**
- Modify: `src/pages/Projections.tsx`

- [ ] **Step 1: Add imports and state**

At the top of `Projections.tsx`, add the Monte Carlo import:

```typescript
import { runMonteCarloSimulation, type MonteCarloResult } from '@/engine/projection/monte-carlo'
```

And merge `Line` into the existing recharts import (modify, don't add a new line):

```typescript
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line } from 'recharts'
```

Add state variables inside the `Projections` component, after the existing state:

```typescript
  const [mcIterations, setMcIterations] = useState(1000)
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null)
  const [mcRunning, setMcRunning] = useState(false)
```

- [ ] **Step 2: Add the run handler**

Add after the `updateAssumption` function:

```typescript
  const handleRunMonteCarlo = () => {
    setMcRunning(true)
    // Use setTimeout to let the "Running..." state render before blocking
    setTimeout(() => {
      const result = runMonteCarloSimulation({
        accounts,
        assumptions,
        currentAge,
        startYear: new Date().getFullYear(),
        iterations: mcIterations,
      })
      setMcResult(result)
      setMcRunning(false)
    }, 10)
  }
```

- [ ] **Step 3: Add data transformation for the chart**

Add after `handleRunMonteCarlo`:

```typescript
  const mcChartData = useMemo(() => {
    if (!mcResult) return []

    return mcResult.percentiles.p5.map((point, i) => {
      const p5 = mcResult.percentiles.p5[i].netWorth
      const p25 = mcResult.percentiles.p25[i].netWorth
      const p75 = mcResult.percentiles.p75[i].netWorth
      const p95 = mcResult.percentiles.p95[i].netWorth
      const p50 = mcResult.percentiles.p50[i].netWorth

      // Deterministic projection value at this age (if available)
      const detPoint = projectionData.find(d => d.age === point.age)

      return {
        age: point.age,
        // Base value (p5) — rendered as invisible base
        p5,
        // Band deltas for stacking
        band_lower: p25 - p5,
        band_middle: p75 - p25,
        band_upper: p95 - p75,
        // Lines
        median: p50,
        deterministic: detPoint?.netWorth ?? null,
      }
    })
  }, [mcResult, projectionData])
```

- [ ] **Step 4: Add the Monte Carlo card JSX**

Insert this card between the existing "Net Worth Projection" `</Card>` and the "Year-by-Year Breakdown" `<Card>` (around line 262 in the current file, inside the `lg:col-span-3 space-y-4` div):

```tsx
          {/* Monte Carlo Simulation */}
          <Card>
            <CardHeader>
              <CardTitle>Monte Carlo Simulation</CardTitle>
              <CardDescription>Regime-aware projection with confidence bands</CardDescription>
            </CardHeader>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1">
                {[500, 1000, 5000].map((n) => (
                  <Button
                    key={n}
                    variant={mcIterations === n ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => { setMcIterations(n); setMcResult(null) }}
                  >
                    {n.toLocaleString()}
                  </Button>
                ))}
              </div>
              <Button onClick={handleRunMonteCarlo} disabled={mcRunning} size="sm">
                {mcRunning ? 'Running...' : 'Run Simulation'}
              </Button>
            </div>

            {mcChartData.length > 0 && (
              <>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mcChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                      <XAxis
                        dataKey="age"
                        tick={{ fontSize: 11, fill: '#878787' }}
                        label={{ value: 'Age', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#878787' } }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#878787' }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                      />
                      <Tooltip
                        formatter={(v: number, name: string) => {
                          const labels: Record<string, string> = {
                            median: 'Median (p50)',
                            deterministic: 'Deterministic',
                          }
                          return [formatCurrency(String(Math.round(v))), labels[name] || name]
                        }}
                        labelFormatter={(age) => `Age ${age}`}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E8E8E4', fontSize: '13px', boxShadow: 'none' }}
                      />

                      {/* Invisible base at p5 */}
                      <Area
                        type="monotone"
                        dataKey="p5"
                        stackId="mc"
                        fill="transparent"
                        stroke="none"
                      />
                      {/* Lower band: p5 to p25 */}
                      <Area
                        type="monotone"
                        dataKey="band_lower"
                        stackId="mc"
                        fill="#2D5A27"
                        fillOpacity={0.08}
                        stroke="none"
                        name="5th-25th percentile"
                      />
                      {/* Middle band: p25 to p75 */}
                      <Area
                        type="monotone"
                        dataKey="band_middle"
                        stackId="mc"
                        fill="#2D5A27"
                        fillOpacity={0.15}
                        stroke="none"
                        name="25th-75th percentile"
                      />
                      {/* Upper band: p75 to p95 */}
                      <Area
                        type="monotone"
                        dataKey="band_upper"
                        stackId="mc"
                        fill="#2D5A27"
                        fillOpacity={0.08}
                        stroke="none"
                        name="75th-95th percentile"
                      />

                      {/* Median line */}
                      <Line
                        type="monotone"
                        dataKey="median"
                        stroke="#2D5A27"
                        strokeWidth={2}
                        dot={false}
                        name="median"
                      />
                      {/* Deterministic overlay */}
                      <Line
                        type="monotone"
                        dataKey="deterministic"
                        stroke="#878787"
                        strokeWidth={1.5}
                        strokeDasharray="6 3"
                        dot={false}
                        name="deterministic"
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-4 gap-3 mt-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Success Rate</div>
                    <div className="text-lg font-semibold tracking-tight mt-0.5">
                      {(mcResult!.successRate * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Median Final</div>
                    <div className="text-lg font-semibold tracking-tight mt-0.5">
                      {formatCurrency(String(Math.round(mcResult!.median[mcResult!.median.length - 1]?.netWorth ?? 0)))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Worst Case (5th)</div>
                    <div className="text-lg font-semibold tracking-tight mt-0.5 text-danger">
                      {formatCurrency(String(Math.round(mcResult!.percentiles.p5[mcResult!.percentiles.p5.length - 1]?.netWorth ?? 0)))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Best Case (95th)</div>
                    <div className="text-lg font-semibold tracking-tight mt-0.5 text-primary">
                      {formatCurrency(String(Math.round(mcResult!.percentiles.p95[mcResult!.percentiles.p95.length - 1]?.netWorth ?? 0)))}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-text-secondary/60 mt-3">
                  Based on {mcResult!.iterations.toLocaleString()} simulations with regime-switching market model. Darker bands represent more likely outcomes.
                </p>
              </>
            )}
          </Card>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Projections.tsx
git commit -m "feat: add Monte Carlo simulation card with confidence band chart to Projections"
```

---

### Task 9: Manual verification and final commit

- [ ] **Step 1: Start dev server and test manually**

Run: `npm run dev`

Open http://localhost:5173/projections. Verify:
1. The deterministic chart renders as before
2. The Monte Carlo card appears below it with iteration selector and "Run Simulation" button
3. Clicking "Run Simulation" renders the fan chart with visible bands
4. The median line and dashed deterministic line appear
5. Summary stats show below the chart
6. Switching iteration counts clears results and requires re-run
7. The 5,000 iteration option shows "Running..." briefly

- [ ] **Step 2: Run full test suite one final time**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Push to main**

```bash
git push origin main
```
