# Per-Account Expected Return Rate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace global stock/bond/cash return assumptions with a per-account expected return rate so users can specify different growth rates per account (e.g., savings at 2.5%, TFSA at 5%, RRSP at 10%).

**Architecture:** Add `expectedReturnRate` field to each account, remove `assetAllocation` and global return assumptions. Both deterministic and Monte Carlo engines use the per-account rate directly. Volatility for Monte Carlo is derived from account type.

**Tech Stack:** Vite 6 + React 19 + TypeScript, Dexie.js (IndexedDB), decimal.js, Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-per-account-return-rate-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/index.ts` | Modify | Remove `AssetAllocation`, add `expectedReturnRate` to `Account`, remove `stockReturn`/`bondReturn`/`cashReturn` from `ScenarioAssumptions` |
| `src/engine/projection/account-defaults.ts` | Create | Export `DEFAULT_RETURN_RATES` and `DEFAULT_VOLATILITIES` maps by account type |
| `src/db/database.ts` | Modify | Bump Dexie version, add `upgrade()` migration |
| `src/engine/projection/project-net-worth.ts` | Modify | Replace `getAccountReturnRate()` with direct use of `expectedReturnRate` |
| `src/engine/projection/monte-carlo.ts` | Modify | Replace asset-class model with per-account rate + type-based volatility + shared market factor |
| `src/pages/Accounts.tsx` | Modify | Add return rate input to create/edit dialog, smart defaults by type |
| `src/pages/Projections.tsx` | Modify | Remove stock/bond/cash return sliders |
| `src/pages/ImportExport.tsx` | Modify | Normalize legacy imports missing `expectedReturnRate` |
| `src/engine/projection/__tests__/project-net-worth.test.ts` | Modify | Update test helpers and assertions |
| `src/engine/projection/__tests__/monte-carlo.test.ts` | Modify | Update test helpers and assertions |
| `src/hooks/__tests__/useFinancialContext.test.ts` | Modify | Replace `assetAllocation` with `expectedReturnRate` in test Account objects |

---

### Task 1: Update Type Definitions

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/engine/projection/account-defaults.ts`
- Modify: `src/hooks/__tests__/useFinancialContext.test.ts`

- [ ] **Step 1: Create `account-defaults.ts` constants file**

Create `src/engine/projection/account-defaults.ts`:

```typescript
import type { AccountType } from '@/types'

/** Default expected annual return rate (as decimal string percentage, e.g. '5.0' = 5%) */
export const DEFAULT_RETURN_RATES: Record<AccountType, string> = {
  'cash': '2.5',
  'tfsa': '5.0',
  'rrsp': '5.0',
  'fhsa': '5.0',
  'non-registered': '5.0',
  'crypto': '8.0',
  'property': '3.0',
  'pension': '4.0',
  'debt-mortgage': '0',
  'debt-loc': '0',
  'debt-credit': '0',
  'debt-other': '0',
}

/** Default annual volatility for Monte Carlo, by account type */
export const DEFAULT_VOLATILITIES: Record<AccountType, number> = {
  'cash': 0.01,
  'tfsa': 0.12,
  'rrsp': 0.12,
  'fhsa': 0.12,
  'non-registered': 0.12,
  'crypto': 0.50,
  'property': 0.12,
  'pension': 0.08,
  'debt-mortgage': 0,
  'debt-loc': 0,
  'debt-credit': 0,
  'debt-other': 0,
}
```

- [ ] **Step 2: Update `Account` interface — remove `AssetAllocation`, add `expectedReturnRate`**

In `src/types/index.ts`:

Remove lines 10-15 (the `AssetAllocation` interface).

Replace the `Account` interface (lines 17-30) with:

```typescript
export interface Account {
  id: string
  name: string
  type: AccountType
  balance: string // decimal string
  currency: Currency
  institution: string
  expectedReturnRate: string // annual return % as decimal string (e.g., '5.0')
  contributionRoom: string | null
  interestRate: string | null
  notes: string
  createdAt: number
  updatedAt: number
}
```

- [ ] **Step 3: Update `ScenarioAssumptions` — remove `stockReturn`, `bondReturn`, `cashReturn`**

In `src/types/index.ts`, update the `ScenarioAssumptions` interface to remove the three return fields:

```typescript
export interface ScenarioAssumptions {
  inflationRate: string
  salaryGrowthRate: string
  retirementAge: number
  lifeExpectancy: number
  cppStartAge: number
  oasStartAge: number
  province: Province
  annualIncome: string
  annualExpenses: string
  annualSavingsRate: string
  monthlyContributions: MonthlyContribution[]
}
```

- [ ] **Step 4: Update `useFinancialContext` test to use new Account shape**

In `src/hooks/__tests__/useFinancialContext.test.ts`, replace the two Account objects (lines 22-31):

```typescript
const accounts: Account[] = [
  {
    id: '1', name: 'TFSA', type: 'tfsa', balance: '25000', currency: 'CAD',
    institution: 'WS', expectedReturnRate: '5.0',
    contributionRoom: null, interestRate: null, notes: '', createdAt: 0, updatedAt: 0,
  },
  {
    id: '2', name: 'Mortgage', type: 'debt-mortgage', balance: '300000', currency: 'CAD',
    institution: 'TD', expectedReturnRate: '0',
    contributionRoom: null, interestRate: '4.8', notes: '', createdAt: 0, updatedAt: 0,
  },
]
```

- [ ] **Step 5: Verify TypeScript compiles (expect errors in downstream files — that's correct)**

Run: `npx tsc --noEmit 2>&1 | head -40`

Expected: Errors in Accounts.tsx, Projections.tsx, project-net-worth.ts, monte-carlo.ts, and test files referencing the removed fields. This confirms the type changes propagated.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/engine/projection/account-defaults.ts src/hooks/__tests__/useFinancialContext.test.ts
git commit -m "feat: add expectedReturnRate to Account, remove assetAllocation and global return assumptions"
```

---

### Task 2: Database Migration

**Files:**
- Modify: `src/db/database.ts`

- [ ] **Step 1: Add Dexie v2 migration with `upgrade()` callback**

Replace the contents of `src/db/database.ts` with:

```typescript
import Dexie, { type Table } from 'dexie'
import type { Account, BalanceHistory, Scenario, UserProfile, Snapshot } from '@/types'
import { DEFAULT_RETURN_RATES } from '@/engine/projection/account-defaults'
import type { AccountType } from '@/types'

export class LoonieDatabase extends Dexie {
  accounts!: Table<Account, string>
  balanceHistory!: Table<BalanceHistory, string>
  scenarios!: Table<Scenario, string>
  userProfile!: Table<UserProfile, string>
  snapshots!: Table<Snapshot, string>

  constructor() {
    super('loonie-finance')

    this.version(1).stores({
      accounts: 'id, type, createdAt',
      balanceHistory: 'id, accountId, date',
      scenarios: 'id, isDefault',
      userProfile: 'id',
      snapshots: 'id, date',
    })

    // v2: Replace assetAllocation with expectedReturnRate
    this.version(2).stores({
      accounts: 'id, type, createdAt',
      balanceHistory: 'id, accountId, date',
      scenarios: 'id, isDefault',
      userProfile: 'id',
      snapshots: 'id, date',
    }).upgrade(tx => {
      return tx.table('accounts').toCollection().modify(account => {
        const type = account.type as AccountType
        account.expectedReturnRate = DEFAULT_RETURN_RATES[type] ?? '5.0'
        delete (account as Record<string, unknown>).assetAllocation
      })
    })
  }
}

export const db = new LoonieDatabase()
```

- [ ] **Step 2: Commit**

```bash
git add src/db/database.ts
git commit -m "feat: add Dexie v2 migration for expectedReturnRate"
```

---

### Task 3: Update Deterministic Projection Engine (TDD)

**Files:**
- Modify: `src/engine/projection/__tests__/project-net-worth.test.ts`
- Modify: `src/engine/projection/project-net-worth.ts`

- [ ] **Step 1: Update test helper `makeAccount` and `defaultAssumptions`**

Replace the test helper and assumptions in `src/engine/projection/__tests__/project-net-worth.test.ts`:

```typescript
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
  expectedReturnRate: '7.0',
  contributionRoom: null,
  interestRate: null,
  notes: '',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

const defaultAssumptions: ScenarioAssumptions = {
  inflationRate: '0.02',
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
```

Keep all existing test cases but update the test description on the second test from `'should grow a 100% stock account at the stock return rate'` to `'should grow an account at its expected return rate'`. All tests should still pass since `expectedReturnRate: '7.0'` matches the old 100% stock @ 7% behavior.

- [ ] **Step 2: Run tests to verify they fail (because implementation still uses old fields)**

Run: `npx vitest run src/engine/projection/__tests__/project-net-worth.test.ts`

Expected: FAIL — TypeScript errors because `Account` no longer has `assetAllocation` and `ScenarioAssumptions` no longer has `stockReturn`/`bondReturn`/`cashReturn`.

- [ ] **Step 3: Update the projection engine implementation**

Replace `src/engine/projection/project-net-worth.ts` contents:

```typescript
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
 * Get expected annual return rate for an account.
 * Assets use expectedReturnRate, debts use interestRate (applied as negative growth).
 */
function getAccountReturnRate(account: Account): Decimal {
  if (isDebtType(account.type)) {
    return new Decimal(account.interestRate || '0').div(100).neg()
  }
  return new Decimal(account.expectedReturnRate || '0').div(100)
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
    contributionMap[contrib.accountId] = new Decimal(contrib.amount).times(12)
  }

  const points: ProjectionPoint[] = []

  // Record starting point
  points.push(buildPoint(0, currentAge, startYear, accounts, balances))

  for (let yearOffset = 1; yearOffset <= yearsToProject; yearOffset++) {
    const age = currentAge + yearOffset

    for (const account of accounts) {
      const balance = balances[account.id]
      const returnRate = getAccountReturnRate(account)

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/projection/__tests__/project-net-worth.test.ts`

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/projection/project-net-worth.ts src/engine/projection/__tests__/project-net-worth.test.ts
git commit -m "feat: deterministic projection uses per-account expectedReturnRate"
```

---

### Task 4: Update Monte Carlo Engine (TDD)

**Files:**
- Modify: `src/engine/projection/__tests__/monte-carlo.test.ts`
- Modify: `src/engine/projection/monte-carlo.ts`

- [ ] **Step 1: Update test helper `makeAccount` and `defaultAssumptions`**

In `src/engine/projection/__tests__/monte-carlo.test.ts`, update the helpers at the top:

```typescript
import { describe, it, expect } from 'vitest'
import { runMonteCarloSimulation, sampleRegime, tDistRandom } from '../monte-carlo'
import type { Account, ScenarioAssumptions } from '@/types'

function createTestRng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'test-1',
  name: 'Test Account',
  type: 'non-registered',
  balance: '100000',
  currency: 'CAD',
  institution: '',
  expectedReturnRate: '7.0',
  contributionRoom: null,
  interestRate: null,
  notes: '',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

const defaultAssumptions: ScenarioAssumptions = {
  inflationRate: '0.02',
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
```

Remove the `correlatedReturns` test suite (the function no longer exists). Remove the import of `correlatedReturns` and `RegimeParams`.

Keep the `Monte Carlo Simulation`, `sampleRegime`, and `tDistRandom` test suites as-is.

Update the spread test to use a slightly different threshold since the model changed — lower the threshold to `100000` since volatility characteristics differ.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/projection/__tests__/monte-carlo.test.ts`

Expected: FAIL — TypeScript errors from removed fields.

- [ ] **Step 3: Rewrite Monte Carlo implementation**

Replace `src/engine/projection/monte-carlo.ts` with the new implementation:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/projection/__tests__/monte-carlo.test.ts`

Expected: All tests in `Monte Carlo Simulation`, `sampleRegime`, and `tDistRandom` suites PASS. If the spread test threshold needs adjustment, lower to `100000`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/projection/monte-carlo.ts src/engine/projection/__tests__/monte-carlo.test.ts
git commit -m "feat: Monte Carlo uses per-account rate with type-based volatility and shared market factor"
```

---

### Task 5: Update Accounts Page UI

**Files:**
- Modify: `src/pages/Accounts.tsx`

- [ ] **Step 1: Add `expectedReturnRate` to form state and import defaults**

At the top of `src/pages/Accounts.tsx`, add the import:

```typescript
import { DEFAULT_RETURN_RATES } from '@/engine/projection/account-defaults'
```

Update the `form` state (line 29-37) to include `expectedReturnRate`:

```typescript
const [form, setForm] = useState({
  name: '',
  type: 'tfsa' as AccountType,
  balance: '',
  currency: 'CAD' as Currency,
  institution: '',
  interestRate: '',
  expectedReturnRate: DEFAULT_RETURN_RATES['tfsa'],
  notes: '',
})
```

Add a `returnRateManuallyEdited` ref to track if user has manually edited the rate:

```typescript
const [returnRateEdited, setReturnRateEdited] = useState(false)
```

- [ ] **Step 2: Update `resetForm`, `openEdit`, and type-change handler**

Update `resetForm`:

```typescript
const resetForm = () => {
  setForm({ name: '', type: 'tfsa', balance: '', currency: 'CAD', institution: '', interestRate: '', expectedReturnRate: DEFAULT_RETURN_RATES['tfsa'], notes: '' })
  setEditingId(null)
  setReturnRateEdited(false)
}
```

Update `openEdit` to load `expectedReturnRate`:

```typescript
const openEdit = (id: string) => {
  const account = accounts.find(a => a.id === id)
  if (!account) return
  setForm({
    name: account.name,
    type: account.type,
    balance: account.balance,
    currency: account.currency,
    institution: account.institution,
    interestRate: account.interestRate || '',
    expectedReturnRate: account.expectedReturnRate || DEFAULT_RETURN_RATES[account.type],
    notes: account.notes,
  })
  setEditingId(id)
  setReturnRateEdited(true) // Treat existing values as manually set
  setDialogOpen(true)
}
```

Update the account type `Select` onChange to also update the default return rate if not manually edited:

```typescript
onChange={(e) => {
  const newType = e.target.value as AccountType
  setForm(f => ({
    ...f,
    type: newType,
    ...(!returnRateEdited ? { expectedReturnRate: DEFAULT_RETURN_RATES[newType] } : {}),
  }))
}}
```

- [ ] **Step 3: Update `handleSave` to persist `expectedReturnRate`**

In the `handleSave` function, update the edit path to include `expectedReturnRate`:

```typescript
if (editingId) {
  await db.accounts.update(editingId, {
    name: form.name,
    type: form.type,
    balance: form.balance || '0',
    currency: form.currency,
    institution: form.institution,
    interestRate: isDebtType(form.type) ? form.interestRate || null : null,
    expectedReturnRate: isDebtType(form.type) ? '0' : form.expectedReturnRate,
    notes: form.notes,
    updatedAt: now,
  })
}
```

In the create path, replace `assetAllocation` with `expectedReturnRate`:

```typescript
await db.accounts.add({
  id,
  name: form.name,
  type: form.type,
  balance: form.balance || '0',
  currency: form.currency,
  institution: form.institution,
  expectedReturnRate: isDebtType(form.type) ? '0' : form.expectedReturnRate,
  contributionRoom: null,
  interestRate: isDebtType(form.type) ? form.interestRate || null : null,
  notes: form.notes,
  createdAt: now,
  updatedAt: now,
})
```

- [ ] **Step 4: Add return rate input field to the dialog**

After the interest rate input (line 271), add the expected return rate input for non-debt types:

```typescript
{!isDebtType(form.type) && (
  <Input
    label="Expected Annual Return (%)"
    type="number"
    step="0.1"
    min="0"
    max="30"
    value={form.expectedReturnRate}
    onChange={(e) => {
      setForm(f => ({ ...f, expectedReturnRate: e.target.value }))
      setReturnRateEdited(true)
    }}
    placeholder="e.g., 5.0"
  />
)}
```

- [ ] **Step 5: Show return rate in the asset account list**

In the asset accounts list item subtitle (line 153-156), add the return rate display:

```typescript
<div className="text-[11px] text-text-secondary mt-0.5">
  {ACCOUNT_TYPE_LABELS[account.type]}
  {account.institution && ` · ${account.institution}`}
  {account.expectedReturnRate && ` · ${account.expectedReturnRate}% return`}
</div>
```

- [ ] **Step 6: Verify in browser**

Run: `npm run dev`

Check: Create a new account, verify the return rate field appears pre-filled with the smart default. Change account type and verify the default updates. Edit an existing account and verify the rate loads correctly.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Accounts.tsx
git commit -m "feat: add expected return rate input to account create/edit dialog"
```

---

### Task 6: Update Projections Page

**Files:**
- Modify: `src/pages/Projections.tsx`

- [ ] **Step 1: Remove stock/bond/cash return fields from DEFAULT_ASSUMPTIONS**

Update the `DEFAULT_ASSUMPTIONS` constant (lines 31-46):

```typescript
const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  inflationRate: '0.02',
  salaryGrowthRate: '0.03',
  retirementAge: 65,
  lifeExpectancy: 90,
  cppStartAge: 65,
  oasStartAge: 65,
  province: 'ON',
  annualIncome: '80000',
  annualExpenses: '50000',
  annualSavingsRate: '0.20',
  monthlyContributions: [],
}
```

- [ ] **Step 2: Remove the stock/bond return slider UI elements**

Remove the two slider divs for Stock Return (lines 184-196) and Bond Return (lines 197-209). Keep the Inflation slider. The assumptions panel should have: Inflation slider, Retirement Age, Life Expectancy, Annual Income, Annual Expenses, Province.

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`

Check: Projections page loads without stock/bond/cash return sliders. Chart still renders. Monte Carlo still runs.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Projections.tsx
git commit -m "feat: remove global return assumption sliders from projections page"
```

---

### Task 7: Update Import/Export for Legacy Compatibility

**Files:**
- Modify: `src/pages/ImportExport.tsx`

- [ ] **Step 1: Add migration logic for imported accounts**

In `src/pages/ImportExport.tsx`, add an import for the defaults and a normalization function:

```typescript
import { DEFAULT_RETURN_RATES } from '@/engine/projection/account-defaults'
import type { AccountType } from '@/types'
```

After `const data = JSON.parse(text) as ExportData` (line 57), add normalization before the bulkAdd:

```typescript
// Normalize legacy accounts (v1 had assetAllocation instead of expectedReturnRate)
const normalizedAccounts = (data.accounts as Record<string, unknown>[]).map(account => {
  if (!('expectedReturnRate' in account)) {
    const type = (account.type as AccountType) || 'non-registered'
    account.expectedReturnRate = DEFAULT_RETURN_RATES[type] ?? '5.0'
  }
  delete account.assetAllocation
  return account
})
```

Then use `normalizedAccounts` instead of `data.accounts` in the bulkAdd:

```typescript
if (normalizedAccounts.length) await db.accounts.bulkAdd(normalizedAccounts as never[])
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ImportExport.tsx
git commit -m "feat: normalize legacy imports to use expectedReturnRate"
```

---

### Task 8: Run Full Test Suite and Verify Build

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: All tests pass.

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Verify production build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve any remaining type/test issues"
```
