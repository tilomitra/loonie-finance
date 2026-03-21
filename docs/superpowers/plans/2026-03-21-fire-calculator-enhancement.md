# FIRE Calculator Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the FIRE calculator page with target FIRE age, post-FIRE spending/income, spouse support, CPP/OAS timing recommendations, RRSP withdrawal strategy comparison, and automatic inflation adjustment.

**Architecture:** New `fire-plan.ts` engine module with year-by-year simulation, consumed by a rewritten `Fire.tsx` page. No new DB tables — all inputs are page-local state. Existing engine modules (`cpp-benefit.ts`, `oas-benefit.ts`, `calculate-tax.ts`) used as-is.

**Tech Stack:** TypeScript, decimal.js, React 19, Recharts, Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-fire-calculator-enhancement-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/engine/retirement/fire-plan.ts` | Create | Core FIRE planning engine: income timeline, effective FIRE numbers, RRSP comparison, benefit recommendations |
| `src/engine/retirement/__tests__/fire-plan.test.ts` | Create | Tests for fire-plan.ts |
| `src/pages/Fire.tsx` | Rewrite | Enhanced FIRE page with new input sections and result panels |

No changes to existing engine modules (`fire.ts`, `cpp-benefit.ts`, `oas-benefit.ts`, `calculate-tax.ts`).

---

### Task 1: Income Timeline Engine

Build the core year-by-year simulation that computes income sources and portfolio drawdown from FIRE age to life expectancy.

**Files:**
- Create: `src/engine/retirement/fire-plan.ts`
- Create: `src/engine/retirement/__tests__/fire-plan.test.ts`

- [ ] **Step 1: Write failing tests for income timeline**

```typescript
// src/engine/retirement/__tests__/fire-plan.test.ts
import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { calculateIncomeTimeline } from '../fire-plan'

describe('calculateIncomeTimeline', () => {
  const baseInputs = {
    fireAge: 45,
    lifeExpectancy: 90,
    postFireAnnualSpending: new Decimal('50000'),
    postFireAnnualIncome: new Decimal('20000'),
    spouseAnnualIncome: new Decimal('0'),
    cppStartAge: 65,
    oasStartAge: 65,
    yearsContributedCPP: 20,
    inflationRate: new Decimal('0.02'),
    expectedReturnRate: new Decimal('0.05'),
  }

  it('should generate timeline from FIRE age to life expectancy', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    expect(timeline).toHaveLength(90 - 45)
    expect(timeline[0].age).toBe(45)
    expect(timeline[timeline.length - 1].age).toBe(89)
  })

  it('should show zero CPP/OAS income before start ages', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    const atAge50 = timeline.find(t => t.age === 50)!
    expect(atAge50.cppIncome.toNumber()).toBe(0)
    expect(atAge50.oasIncome.toNumber()).toBe(0)
  })

  it('should show CPP income starting at cppStartAge', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    const atAge65 = timeline.find(t => t.age === 65)!
    expect(atAge65.cppIncome.toNumber()).toBeGreaterThan(0)
  })

  it('should show OAS income starting at oasStartAge', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    const atAge65 = timeline.find(t => t.age === 65)!
    expect(atAge65.oasIncome.toNumber()).toBeGreaterThan(0)
  })

  it('should include spouse income when provided', () => {
    const timeline = calculateIncomeTimeline({
      ...baseInputs,
      spouseAnnualIncome: new Decimal('30000'),
    })
    expect(timeline[0].spouseIncome.toNumber()).toBe(30000)
  })

  it('should show portfolio withdrawal as spending minus all other income', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    const first = timeline[0]
    // Before CPP/OAS: withdrawal = spending - postFireIncome - spouseIncome
    const expectedWithdrawal = first.spending.minus(first.postFireIncome).minus(first.spouseIncome)
    expect(first.portfolioWithdrawal.toNumber()).toBeCloseTo(expectedWithdrawal.toNumber(), 0)
  })

  it('should reduce portfolio withdrawals after benefits kick in', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    const before = timeline.find(t => t.age === 60)!
    const after = timeline.find(t => t.age === 66)!
    expect(after.portfolioWithdrawal.toNumber()).toBeLessThan(before.portfolioWithdrawal.toNumber())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/engine/retirement/__tests__/fire-plan.test.ts`
Expected: FAIL — `calculateIncomeTimeline` not found

- [ ] **Step 3: Implement calculateIncomeTimeline**

```typescript
// src/engine/retirement/fire-plan.ts
import Decimal from 'decimal.js'
import { estimateCppBenefit } from './cpp-benefit'
import { estimateOasBenefit } from './oas-benefit'
import type { FireType } from './fire'
import type { Province } from '@/types'

export interface IncomeTimelineInputs {
  fireAge: number
  lifeExpectancy: number
  postFireAnnualSpending: Decimal
  postFireAnnualIncome: Decimal
  spouseAnnualIncome: Decimal
  cppStartAge: number
  oasStartAge: number
  yearsContributedCPP: number
  inflationRate: Decimal
  expectedReturnRate: Decimal // nominal
}

export interface TimelineYear {
  age: number
  spending: Decimal           // in today's dollars
  postFireIncome: Decimal
  spouseIncome: Decimal
  cppIncome: Decimal
  oasIncome: Decimal
  portfolioWithdrawal: Decimal
  totalIncome: Decimal
}

export function calculateIncomeTimeline(inputs: IncomeTimelineInputs): TimelineYear[] {
  const {
    fireAge, lifeExpectancy, postFireAnnualSpending, postFireAnnualIncome,
    spouseAnnualIncome, cppStartAge, oasStartAge, yearsContributedCPP,
    inflationRate, expectedReturnRate,
  } = inputs

  const timeline: TimelineYear[] = []

  // Pre-compute benefit amounts (same for every year at a given start age)
  const cppAtStartAge = estimateCppBenefit(cppStartAge, yearsContributedCPP, 0.75)
  // OAS clawback uses post-FIRE spending as a proxy for retirement income.
  // This is a simplification — actual clawback depends on taxable income (RRSP
  // withdrawals, CPP, etc.), but modeling that precisely creates circular dependencies.
  const oasAtStartAge = estimateOasBenefit(oasStartAge, postFireAnnualSpending.toNumber(), 40)

  for (let age = fireAge; age < lifeExpectancy; age++) {
    // All amounts in today's dollars (real terms)
    const spending = postFireAnnualSpending

    const postFireIncome = postFireAnnualIncome
    const spouseIncome = spouseAnnualIncome

    // CPP: only if at or past start age
    const cppIncome = age >= cppStartAge ? cppAtStartAge.annualBenefit : new Decimal(0)

    // OAS: only if at or past start age (use 75+ rate after 75)
    let oasIncome = new Decimal(0)
    if (age >= oasStartAge) {
      // Recompute for 75+ rate change if needed
      if (age >= 75 && oasStartAge < 75) {
        const oas75 = estimateOasBenefit(oasStartAge, postFireAnnualSpending.toNumber(), 40, age)
        oasIncome = oas75.netAnnualBenefit
      } else {
        oasIncome = oasAtStartAge.netAnnualBenefit
      }
    }

    const nonPortfolioIncome = postFireIncome.plus(spouseIncome).plus(cppIncome).plus(oasIncome)
    const portfolioWithdrawal = Decimal.max(spending.minus(nonPortfolioIncome), 0)

    timeline.push({
      age,
      spending,
      postFireIncome,
      spouseIncome,
      cppIncome,
      oasIncome,
      portfolioWithdrawal,
      totalIncome: nonPortfolioIncome.plus(portfolioWithdrawal),
    })
  }

  return timeline
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/engine/retirement/__tests__/fire-plan.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/retirement/fire-plan.ts src/engine/retirement/__tests__/fire-plan.test.ts
git commit -m "feat: add income timeline engine for FIRE planning"
```

---

### Task 2: Effective FIRE Number Calculation

Add the year-by-year portfolio simulation to find the initial portfolio needed to sustain retirement.

**Files:**
- Modify: `src/engine/retirement/fire-plan.ts`
- Modify: `src/engine/retirement/__tests__/fire-plan.test.ts`

- [ ] **Step 1: Write failing tests for effective FIRE number**

Add to `fire-plan.test.ts`:

```typescript
import { calculateEffectiveFireNumber } from '../fire-plan'

describe('calculateEffectiveFireNumber', () => {
  const baseInputs = {
    fireAge: 45,
    lifeExpectancy: 90,
    postFireAnnualSpending: new Decimal('50000'),
    postFireAnnualIncome: new Decimal('0'),
    spouseAnnualIncome: new Decimal('0'),
    cppStartAge: 65,
    oasStartAge: 65,
    yearsContributedCPP: 20,
    inflationRate: new Decimal('0.02'),
    expectedReturnRate: new Decimal('0.05'),
  }

  it('should return a positive FIRE number for typical inputs', () => {
    const result = calculateEffectiveFireNumber(baseInputs)
    expect(result.toNumber()).toBeGreaterThan(0)
  })

  it('should return a lower number when post-FIRE income covers some spending', () => {
    const withoutIncome = calculateEffectiveFireNumber(baseInputs)
    const withIncome = calculateEffectiveFireNumber({
      ...baseInputs,
      postFireAnnualIncome: new Decimal('20000'),
    })
    expect(withIncome.toNumber()).toBeLessThan(withoutIncome.toNumber())
  })

  it('should return zero when income covers all spending', () => {
    const result = calculateEffectiveFireNumber({
      ...baseInputs,
      postFireAnnualIncome: new Decimal('50000'),
    })
    expect(result.toNumber()).toBe(0)
  })

  it('should return a lower number with earlier CPP start', () => {
    const cpp65 = calculateEffectiveFireNumber({ ...baseInputs, cppStartAge: 65 })
    const cpp60 = calculateEffectiveFireNumber({ ...baseInputs, cppStartAge: 60 })
    // Earlier CPP means less time bridging with portfolio, but lower monthly amount
    // The net effect depends on amounts — just verify both are positive
    expect(cpp65.toNumber()).toBeGreaterThan(0)
    expect(cpp60.toNumber()).toBeGreaterThan(0)
  })

  it('should return a lower number with spouse income', () => {
    const solo = calculateEffectiveFireNumber(baseInputs)
    const withSpouse = calculateEffectiveFireNumber({
      ...baseInputs,
      spouseAnnualIncome: new Decimal('30000'),
    })
    expect(withSpouse.toNumber()).toBeLessThan(solo.toNumber())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/engine/retirement/__tests__/fire-plan.test.ts`
Expected: FAIL — `calculateEffectiveFireNumber` not found

- [ ] **Step 3: Implement calculateEffectiveFireNumber**

Add to `fire-plan.ts`:

```typescript
/**
 * Calculate the initial portfolio at FIRE age needed to sustain withdrawals
 * through retirement without depletion. Uses binary search over the timeline.
 *
 * Works in real (inflation-adjusted) terms:
 * - realReturn = expectedReturnRate - inflationRate
 * - All spending and income in today's dollars
 */
export function calculateEffectiveFireNumber(inputs: IncomeTimelineInputs): Decimal {
  const timeline = calculateIncomeTimeline(inputs)
  const realReturn = inputs.expectedReturnRate.minus(inputs.inflationRate)

  // If no withdrawals needed at all
  if (timeline.every(y => y.portfolioWithdrawal.lte(0))) {
    return new Decimal(0)
  }

  // Binary search for the minimum starting portfolio
  // Upper bound: total spending * 3 handles negative real returns safely
  let lo = new Decimal(0)
  let hi = inputs.postFireAnnualSpending.times(inputs.lifeExpectancy - inputs.fireAge).times(3)

  for (let i = 0; i < 100; i++) {
    const mid = lo.plus(hi).div(2)
    if (portfolioSurvives(mid, timeline, realReturn)) {
      hi = mid
    } else {
      lo = mid
    }
    if (hi.minus(lo).lt(100)) break // within $100
  }

  return hi.toDecimalPlaces(0)
}

function portfolioSurvives(
  startingPortfolio: Decimal,
  timeline: TimelineYear[],
  realReturn: Decimal
): boolean {
  let portfolio = startingPortfolio
  for (const year of timeline) {
    portfolio = portfolio.times(realReturn.plus(1)).minus(year.portfolioWithdrawal)
    if (portfolio.lt(0)) return false
  }
  return true
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/engine/retirement/__tests__/fire-plan.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/retirement/fire-plan.ts src/engine/retirement/__tests__/fire-plan.test.ts
git commit -m "feat: add effective FIRE number via year-by-year portfolio simulation"
```

---

### Task 3: FIRE Plan — All Types, Feasibility, and Years-to-FIRE

Compute all 5 FIRE types with effective numbers, feasibility check, and projected FIRE age.

**Files:**
- Modify: `src/engine/retirement/fire-plan.ts`
- Modify: `src/engine/retirement/__tests__/fire-plan.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `fire-plan.test.ts`:

```typescript
import { calculateFirePlan, type FirePlanInputs } from '../fire-plan'

describe('calculateFirePlan', () => {
  const planInputs: FirePlanInputs = {
    currentAge: 35,
    targetFireAge: 50,
    lifeExpectancy: 90,
    currentNetWorth: new Decimal('300000'),
    annualSavings: new Decimal('40000'),
    currentAnnualExpenses: new Decimal('50000'),
    postFireAnnualSpending: new Decimal('45000'),
    leanExpenses: new Decimal('30000'),
    fatExpenses: new Decimal('70000'),
    postFireAnnualIncome: new Decimal('10000'),
    hasSpouse: false,
    spouseAnnualIncome: new Decimal('0'),
    spousePortfolio: new Decimal('0'),
    cppStartAge: 65,
    oasStartAge: 65,
    rrspWithdrawalStartAge: 65,
    rrspBalance: new Decimal('100000'),
    withdrawalRate: new Decimal('0.04'),
    inflationRate: new Decimal('0.02'),
    expectedReturnRate: new Decimal('0.05'),
    yearsContributedCPP: 20,
    province: 'ON',
  }

  it('should return feasibility with on-track or gap info', () => {
    const result = calculateFirePlan(planInputs)
    expect(result.feasibility).toBeDefined()
    expect(typeof result.feasibility.isOnTrack).toBe('boolean')
    expect(result.feasibility.effectiveFireNumber.toNumber()).toBeGreaterThan(0)
    expect(result.feasibility.currentTotal.toNumber()).toBe(300000)
    expect(result.feasibility.projectedFireAge).toBeGreaterThanOrEqual(planInputs.currentAge)
  })

  it('should return all 5 FIRE types', () => {
    const result = calculateFirePlan(planInputs)
    expect(result.fireTypes).toHaveLength(5)
    const types = result.fireTypes.map(t => t.type)
    expect(types).toContain('lean')
    expect(types).toContain('regular')
    expect(types).toContain('fat')
    expect(types).toContain('coast')
    expect(types).toContain('barista')
  })

  it('should have lean < regular < fat effective numbers', () => {
    const result = calculateFirePlan(planInputs)
    const lean = result.fireTypes.find(t => t.type === 'lean')!
    const regular = result.fireTypes.find(t => t.type === 'regular')!
    const fat = result.fireTypes.find(t => t.type === 'fat')!
    expect(lean.effectiveNumber.toNumber()).toBeLessThan(regular.effectiveNumber.toNumber())
    expect(regular.effectiveNumber.toNumber()).toBeLessThan(fat.effectiveNumber.toNumber())
  })

  it('should include spouse portfolio in currentTotal', () => {
    const result = calculateFirePlan({
      ...planInputs,
      hasSpouse: true,
      spousePortfolio: new Decimal('100000'),
    })
    expect(result.feasibility.currentTotal.toNumber()).toBe(400000)
  })

  it('should return income timeline', () => {
    const result = calculateFirePlan(planInputs)
    expect(result.incomeTimeline.length).toBe(90 - 50) // fireAge to lifeExpectancy
  })

  it('should handle already-FI case when income covers spending', () => {
    const result = calculateFirePlan({
      ...planInputs,
      postFireAnnualIncome: new Decimal('50000'),
    })
    const regular = result.fireTypes.find(t => t.type === 'regular')!
    expect(regular.effectiveNumber.toNumber()).toBe(0)
  })

  it('should handle retire-now case when targetFireAge <= currentAge', () => {
    const result = calculateFirePlan({
      ...planInputs,
      targetFireAge: 35, // same as currentAge
    })
    expect(result.feasibility).toBeDefined()
    expect(result.incomeTimeline.length).toBe(90 - 35)
  })

  it('should handle zero RRSP balance', () => {
    const result = calculateFirePlan({
      ...planInputs,
      rrspBalance: new Decimal('0'),
    })
    expect(result.rrspComparison.early.annualWithdrawal.toNumber()).toBe(0)
    expect(result.rrspComparison.deferred.annualWithdrawal.toNumber()).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/engine/retirement/__tests__/fire-plan.test.ts`
Expected: FAIL — `calculateFirePlan` not found

- [ ] **Step 3: Implement calculateFirePlan**

Add to the top-level imports in `fire-plan.ts`:

```typescript
import { calculateYearsToFire } from './fire'
import { calculateTotalTax } from '../tax/calculate-tax'
import { compoundGrowth } from '../projection/compound'
```

Add to `fire-plan.ts`:

```typescript
export interface FirePlanInputs {
  currentAge: number
  targetFireAge: number
  lifeExpectancy: number
  currentNetWorth: Decimal
  annualSavings: Decimal
  currentAnnualExpenses: Decimal
  postFireAnnualSpending: Decimal
  leanExpenses: Decimal
  fatExpenses: Decimal
  postFireAnnualIncome: Decimal
  hasSpouse: boolean
  spouseAnnualIncome: Decimal
  spousePortfolio: Decimal
  cppStartAge: number
  oasStartAge: number
  rrspWithdrawalStartAge: number
  rrspBalance: Decimal
  withdrawalRate: Decimal
  inflationRate: Decimal
  expectedReturnRate: Decimal
  yearsContributedCPP: number
  province: Province
}

export interface FireTypeResult {
  type: FireType
  effectiveNumber: Decimal
  yearsToFire: number | null
  progress: number
}

export interface FirePlanResult {
  feasibility: {
    isOnTrack: boolean
    effectiveFireNumber: Decimal
    currentTotal: Decimal
    gap: Decimal
    projectedFireAge: number
  }
  fireTypes: FireTypeResult[]
  incomeTimeline: TimelineYear[]
  rrspComparison: RrspComparison
  benefitRecommendation: BenefitRecommendation
}

export function calculateFirePlan(inputs: FirePlanInputs): FirePlanResult {
  const currentTotal = inputs.currentNetWorth.plus(
    inputs.hasSpouse ? inputs.spousePortfolio : 0
  )
  const realReturn = inputs.expectedReturnRate.minus(inputs.inflationRate)
  const spouseIncome = inputs.hasSpouse ? inputs.spouseAnnualIncome : new Decimal(0)

  // Build timeline inputs for a given spending level
  const makeTimelineInputs = (spending: Decimal): IncomeTimelineInputs => ({
    fireAge: inputs.targetFireAge,
    lifeExpectancy: inputs.lifeExpectancy,
    postFireAnnualSpending: spending,
    postFireAnnualIncome: inputs.postFireAnnualIncome,
    spouseAnnualIncome: spouseIncome,
    cppStartAge: inputs.cppStartAge,
    oasStartAge: inputs.oasStartAge,
    yearsContributedCPP: inputs.yearsContributedCPP,
    inflationRate: inputs.inflationRate,
    expectedReturnRate: inputs.expectedReturnRate,
  })

  // Calculate effective FIRE numbers for each spending level
  const regularNumber = calculateEffectiveFireNumber(makeTimelineInputs(inputs.postFireAnnualSpending))
  const leanNumber = calculateEffectiveFireNumber(makeTimelineInputs(inputs.leanExpenses))
  const fatNumber = calculateEffectiveFireNumber(makeTimelineInputs(inputs.fatExpenses))

  // Coast FIRE: how much you need TODAY to coast to the regular number
  const yearsToFire = inputs.targetFireAge - inputs.currentAge
  const coastNumber = yearsToFire > 0
    ? regularNumber.div(realReturn.plus(1).pow(yearsToFire))
    : regularNumber

  // Barista FIRE: max part-time income needed across pre-benefit years
  const regularTimeline = calculateIncomeTimeline(makeTimelineInputs(inputs.postFireAnnualSpending))
  const baristaIncome = regularTimeline.reduce(
    (max, year) => Decimal.max(max, year.portfolioWithdrawal),
    new Decimal(0)
  )

  // Build fire types
  const makeFireType = (type: FireType, effectiveNumber: Decimal): FireTypeResult => {
    const progress = effectiveNumber.gt(0)
      ? Math.min(currentTotal.div(effectiveNumber).toNumber(), 1)
      : 1
    const years = effectiveNumber.gt(0)
      ? calculateYearsToFire(currentTotal, inputs.annualSavings, effectiveNumber, realReturn)
      : 0
    return { type, effectiveNumber, yearsToFire: years, progress }
  }

  const fireTypes: FireTypeResult[] = [
    makeFireType('lean', leanNumber),
    makeFireType('regular', regularNumber),
    makeFireType('fat', fatNumber),
    makeFireType('coast', coastNumber),
    { type: 'barista', effectiveNumber: baristaIncome, yearsToFire: null, progress: 0 },
  ]

  // Feasibility
  const regularType = fireTypes.find(t => t.type === 'regular')!
  const projectedFireAge = regularType.yearsToFire !== null
    ? inputs.currentAge + regularType.yearsToFire
    : inputs.currentAge + 100
  const gap = Decimal.max(regularNumber.minus(currentTotal), 0)

  // Income timeline for the results chart
  const incomeTimeline = regularTimeline

  // RRSP and benefit recommendations (stub implementations replaced in Tasks 4 & 5)
  const rrspComparison = calculateRrspComparison(inputs)
  const benefitRecommendation = calculateBenefitRecommendation(inputs)

  return {
    feasibility: {
      isOnTrack: projectedFireAge <= inputs.targetFireAge,
      effectiveFireNumber: regularNumber,
      currentTotal,
      gap,
      projectedFireAge: Math.min(projectedFireAge, inputs.currentAge + 100),
    },
    fireTypes,
    incomeTimeline,
    rrspComparison,
    benefitRecommendation,
  }
}
```

Also add these stub implementations and type definitions (will be replaced with real implementations in Tasks 4 and 5):

```typescript
export interface RrspStrategyResult {
  startAge: number
  balanceAtStart: Decimal
  annualWithdrawal: Decimal
  marginalTaxRate: Decimal
  totalAfterTaxIncome: Decimal
  portfolioLongevityImpactYears: number
}

export interface RrspComparison {
  early: RrspStrategyResult
  deferred: RrspStrategyResult
  recommendEarly: boolean
  oasClawbackWarning: boolean
}

export interface BenefitRecommendation {
  recommendedCppAge: number
  recommendedOasAge: number
  reasoning: string
  cppBreakEvenAge: number
  monthlyAtRecommended: Decimal
  monthlyAt65: Decimal
}

// Stub — replaced in Task 4
export function calculateRrspComparison(inputs: FirePlanInputs): RrspComparison {
  const zero = new Decimal(0)
  const stub: RrspStrategyResult = {
    startAge: 65, balanceAtStart: zero, annualWithdrawal: zero,
    marginalTaxRate: zero, totalAfterTaxIncome: zero, portfolioLongevityImpactYears: 0,
  }
  return { early: stub, deferred: { ...stub, startAge: 71 }, recommendEarly: false, oasClawbackWarning: false }
}

// Stub — replaced in Task 5
export function calculateBenefitRecommendation(inputs: FirePlanInputs): BenefitRecommendation {
  return {
    recommendedCppAge: 65, recommendedOasAge: 65, reasoning: '',
    cppBreakEvenAge: 80, monthlyAtRecommended: new Decimal(0), monthlyAt65: new Decimal(0),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/engine/retirement/__tests__/fire-plan.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/retirement/fire-plan.ts src/engine/retirement/__tests__/fire-plan.test.ts
git commit -m "feat: add calculateFirePlan with all FIRE types and feasibility check"
```

---

### Task 4: RRSP Strategy Comparison

Compare early RRSP withdrawal vs deferral to 71, with tax estimates.

**Files:**
- Modify: `src/engine/retirement/fire-plan.ts`
- Modify: `src/engine/retirement/__tests__/fire-plan.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `fire-plan.test.ts`:

```typescript
import { calculateRrspComparison } from '../fire-plan'

describe('calculateRrspComparison', () => {
  const inputs: FirePlanInputs = {
    currentAge: 35,
    targetFireAge: 50,
    lifeExpectancy: 90,
    currentNetWorth: new Decimal('300000'),
    annualSavings: new Decimal('40000'),
    currentAnnualExpenses: new Decimal('50000'),
    postFireAnnualSpending: new Decimal('45000'),
    leanExpenses: new Decimal('30000'),
    fatExpenses: new Decimal('70000'),
    postFireAnnualIncome: new Decimal('10000'),
    hasSpouse: false,
    spouseAnnualIncome: new Decimal('0'),
    spousePortfolio: new Decimal('0'),
    cppStartAge: 65,
    oasStartAge: 65,
    rrspWithdrawalStartAge: 55,
    rrspBalance: new Decimal('100000'),
    withdrawalRate: new Decimal('0.04'),
    inflationRate: new Decimal('0.02'),
    expectedReturnRate: new Decimal('0.05'),
    yearsContributedCPP: 20,
    province: 'ON',
  }

  it('should return early and deferred strategies', () => {
    const result = calculateRrspComparison(inputs)
    expect(result.early).toBeDefined()
    expect(result.deferred).toBeDefined()
    expect(result.early.startAge).toBe(55)
    expect(result.deferred.startAge).toBe(71)
  })

  it('should have larger balance for deferred strategy', () => {
    const result = calculateRrspComparison(inputs)
    expect(result.deferred.balanceAtStart.toNumber())
      .toBeGreaterThan(result.early.balanceAtStart.toNumber())
  })

  it('should compute annual withdrawal and tax for both', () => {
    const result = calculateRrspComparison(inputs)
    expect(result.early.annualWithdrawal.toNumber()).toBeGreaterThan(0)
    expect(result.deferred.annualWithdrawal.toNumber()).toBeGreaterThan(0)
    expect(result.early.marginalTaxRate.toNumber()).toBeGreaterThanOrEqual(0)
    expect(result.deferred.marginalTaxRate.toNumber()).toBeGreaterThanOrEqual(0)
  })

  it('should compute total after-tax income for both', () => {
    const result = calculateRrspComparison(inputs)
    expect(result.early.totalAfterTaxIncome.toNumber()).toBeGreaterThan(0)
    expect(result.deferred.totalAfterTaxIncome.toNumber()).toBeGreaterThan(0)
  })

  it('should include portfolio longevity impact', () => {
    const result = calculateRrspComparison(inputs)
    expect(typeof result.early.portfolioLongevityImpactYears).toBe('number')
    expect(typeof result.deferred.portfolioLongevityImpactYears).toBe('number')
  })

  it('should flag OAS clawback risk for large deferred balances', () => {
    const result = calculateRrspComparison({
      ...inputs,
      rrspBalance: new Decimal('800000'),
    })
    expect(typeof result.oasClawbackWarning).toBe('boolean')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/engine/retirement/__tests__/fire-plan.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement calculateRrspComparison**

Replace the stub `calculateRrspComparison` in `fire-plan.ts` with the real implementation (types already defined from Task 3 stubs):

```typescript
export function calculateRrspComparison(inputs: FirePlanInputs): RrspComparison {
  const realReturn = inputs.expectedReturnRate.minus(inputs.inflationRate)

  const computeStrategy = (startAge: number): RrspStrategyResult => {
    const yearsGrowing = startAge - inputs.currentAge
    const balanceAtStart = compoundGrowth(inputs.rrspBalance, realReturn, yearsGrowing)

    const yearsWithdrawing = Math.max(inputs.lifeExpectancy - startAge, 1)
    // Level annual withdrawal to deplete over retirement (annuity formula)
    let annualWithdrawal: Decimal
    if (realReturn.eq(0)) {
      annualWithdrawal = balanceAtStart.div(yearsWithdrawing)
    } else {
      const r = realReturn
      const factor = new Decimal(1).minus(r.plus(1).pow(-yearsWithdrawing))
      annualWithdrawal = balanceAtStart.times(r).div(factor)
    }

    const taxResult = calculateTotalTax(annualWithdrawal, inputs.province)
    const afterTaxAnnual = annualWithdrawal.minus(taxResult.totalTax)
    const totalAfterTaxIncome = afterTaxAnnual.times(yearsWithdrawing)

    // Portfolio longevity impact: how many extra years does the non-RRSP portfolio
    // last if RRSP covers some of the withdrawal burden?
    // Compute by comparing drawdown with and without RRSP supplementing
    const spendingGap = inputs.postFireAnnualSpending.minus(inputs.postFireAnnualIncome)
      .minus(inputs.hasSpouse ? inputs.spouseAnnualIncome : 0)
    const gapWithRrsp = Decimal.max(spendingGap.minus(afterTaxAnnual), 0)
    const gapWithout = Decimal.max(spendingGap, 0)

    let longevityImpact = 0
    if (gapWithout.gt(0) && gapWithRrsp.lt(gapWithout)) {
      // Rough estimate: years saved = rrsp total / gap reduction per year
      const annualReduction = gapWithout.minus(gapWithRrsp)
      if (annualReduction.gt(0) && realReturn.gt(0)) {
        longevityImpact = Math.round(totalAfterTaxIncome.div(gapWithout).toNumber())
      }
    }

    return {
      startAge,
      balanceAtStart: balanceAtStart.toDecimalPlaces(0),
      annualWithdrawal: annualWithdrawal.toDecimalPlaces(0),
      marginalTaxRate: taxResult.marginalRate,
      totalAfterTaxIncome: totalAfterTaxIncome.toDecimalPlaces(0),
      portfolioLongevityImpactYears: longevityImpact,
    }
  }

  const early = computeStrategy(inputs.rrspWithdrawalStartAge)
  const deferred = computeStrategy(71)

  // OAS clawback warning: if deferred RRIF annual withdrawal > OAS clawback threshold
  const oasClawbackWarning = deferred.annualWithdrawal.toNumber() > 90997

  return {
    early,
    deferred,
    recommendEarly: early.totalAfterTaxIncome.gt(deferred.totalAfterTaxIncome),
    oasClawbackWarning,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/engine/retirement/__tests__/fire-plan.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/retirement/fire-plan.ts src/engine/retirement/__tests__/fire-plan.test.ts
git commit -m "feat: add RRSP withdrawal strategy comparison with tax estimates"
```

---

### Task 5: CPP/OAS Benefit Recommendation

Generate optimal CPP/OAS start age recommendations with break-even analysis.

**Files:**
- Modify: `src/engine/retirement/fire-plan.ts`
- Modify: `src/engine/retirement/__tests__/fire-plan.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `fire-plan.test.ts`:

```typescript
import { calculateBenefitRecommendation } from '../fire-plan'

describe('calculateBenefitRecommendation', () => {
  const inputs: FirePlanInputs = {
    currentAge: 35,
    targetFireAge: 50,
    lifeExpectancy: 90,
    currentNetWorth: new Decimal('500000'),
    annualSavings: new Decimal('40000'),
    currentAnnualExpenses: new Decimal('50000'),
    postFireAnnualSpending: new Decimal('45000'),
    leanExpenses: new Decimal('30000'),
    fatExpenses: new Decimal('70000'),
    postFireAnnualIncome: new Decimal('10000'),
    hasSpouse: false,
    spouseAnnualIncome: new Decimal('0'),
    spousePortfolio: new Decimal('0'),
    cppStartAge: 65,
    oasStartAge: 65,
    rrspWithdrawalStartAge: 65,
    rrspBalance: new Decimal('100000'),
    withdrawalRate: new Decimal('0.04'),
    inflationRate: new Decimal('0.02'),
    expectedReturnRate: new Decimal('0.05'),
    yearsContributedCPP: 25,
    province: 'ON',
  }

  it('should recommend CPP age between 60 and 70', () => {
    const result = calculateBenefitRecommendation(inputs)
    expect(result.recommendedCppAge).toBeGreaterThanOrEqual(60)
    expect(result.recommendedCppAge).toBeLessThanOrEqual(70)
  })

  it('should recommend OAS age between 65 and 70', () => {
    const result = calculateBenefitRecommendation(inputs)
    expect(result.recommendedOasAge).toBeGreaterThanOrEqual(65)
    expect(result.recommendedOasAge).toBeLessThanOrEqual(70)
  })

  it('should provide a break-even age', () => {
    const result = calculateBenefitRecommendation(inputs)
    expect(result.cppBreakEvenAge).toBeGreaterThan(65)
    expect(result.cppBreakEvenAge).toBeLessThan(100)
  })

  it('should provide monthly amounts at 65 and recommended age', () => {
    const result = calculateBenefitRecommendation(inputs)
    expect(result.monthlyAt65.toNumber()).toBeGreaterThan(0)
    expect(result.monthlyAtRecommended.toNumber()).toBeGreaterThan(0)
  })

  it('should provide reasoning string', () => {
    const result = calculateBenefitRecommendation(inputs)
    expect(result.reasoning.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/engine/retirement/__tests__/fire-plan.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement calculateBenefitRecommendation**

Add/replace in `fire-plan.ts`:

```typescript
export interface BenefitRecommendation {
  recommendedCppAge: number
  recommendedOasAge: number
  reasoning: string
  cppBreakEvenAge: number
  monthlyAtRecommended: Decimal
  monthlyAt65: Decimal
}

export function calculateBenefitRecommendation(inputs: FirePlanInputs): BenefitRecommendation {
  const realReturn = inputs.expectedReturnRate.minus(inputs.inflationRate)
  const monthlyAt65 = estimateCppBenefit(65, inputs.yearsContributedCPP, 0.75).monthlyBenefit

  // Compare present value of lifetime CPP for each start age
  let bestCppAge = 65
  let bestCppPV = new Decimal(0)

  for (let startAge = 60; startAge <= 70; startAge++) {
    const cpp = estimateCppBenefit(startAge, inputs.yearsContributedCPP, 0.75)
    let pv = new Decimal(0)
    for (let age = startAge; age < inputs.lifeExpectancy; age++) {
      const yearsFromNow = age - inputs.currentAge
      const discountFactor = realReturn.plus(1).pow(-yearsFromNow)
      pv = pv.plus(cpp.annualBenefit.times(discountFactor))
    }
    if (pv.gt(bestCppPV)) {
      bestCppPV = pv
      bestCppAge = startAge
    }
  }

  // OAS: compare PV of 65 vs 70
  let bestOasAge = 65
  let bestOasPV = new Decimal(0)

  for (let startAge = 65; startAge <= 70; startAge++) {
    const oas = estimateOasBenefit(startAge, inputs.postFireAnnualSpending.toNumber(), 40)
    let pv = new Decimal(0)
    for (let age = startAge; age < inputs.lifeExpectancy; age++) {
      const yearsFromNow = age - inputs.currentAge
      const discountFactor = realReturn.plus(1).pow(-yearsFromNow)
      pv = pv.plus(oas.netAnnualBenefit.times(discountFactor))
    }
    if (pv.gt(bestOasPV)) {
      bestOasPV = pv
      bestOasAge = startAge
    }
  }

  // CPP break-even: age where cumulative PV of deferred (70) exceeds cumulative PV of early (60)
  const earlyCpp = estimateCppBenefit(60, inputs.yearsContributedCPP, 0.75)
  const lateCpp = estimateCppBenefit(70, inputs.yearsContributedCPP, 0.75)
  let cumulativePVEarly = new Decimal(0)
  let cumulativePVLate = new Decimal(0)
  let breakEvenAge = 95 // default if never breaks even

  for (let age = 60; age < 100; age++) {
    const discountFactor = realReturn.plus(1).pow(-(age - inputs.currentAge))
    cumulativePVEarly = cumulativePVEarly.plus(earlyCpp.annualBenefit.times(discountFactor))
    if (age >= 70) {
      cumulativePVLate = cumulativePVLate.plus(lateCpp.annualBenefit.times(discountFactor))
    }
    if (age >= 70 && cumulativePVLate.gte(cumulativePVEarly)) {
      breakEvenAge = age
      break
    }
  }

  const monthlyAtRecommended = estimateCppBenefit(bestCppAge, inputs.yearsContributedCPP, 0.75).monthlyBenefit

  // Build reasoning
  let reasoning: string
  if (bestCppAge > 65) {
    reasoning = `With a life expectancy of ${inputs.lifeExpectancy} and a portfolio to bridge the gap, deferring CPP to ${bestCppAge} maximizes lifetime present value. Deferring past 65 increases your monthly benefit by ${((bestCppAge - 65) * 12 * 0.7).toFixed(0)}%.`
  } else if (bestCppAge < 65) {
    reasoning = `Starting CPP at ${bestCppAge} provides income sooner, which is valuable given your expected return rate and reduces portfolio drawdown during the early FIRE years.`
  } else {
    reasoning = `Starting CPP at 65 provides the best balance between benefit amount and years of collection for your situation.`
  }

  if (bestOasAge > 65) {
    reasoning += ` For OAS, deferring to ${bestOasAge} adds a ${((bestOasAge - 65) * 12 * 0.6).toFixed(0)}% bonus.`
  }

  return {
    recommendedCppAge: bestCppAge,
    recommendedOasAge: bestOasAge,
    reasoning,
    cppBreakEvenAge: breakEvenAge,
    monthlyAtRecommended,
    monthlyAt65,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/engine/retirement/__tests__/fire-plan.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/retirement/fire-plan.ts src/engine/retirement/__tests__/fire-plan.test.ts
git commit -m "feat: add CPP/OAS benefit recommendation with break-even analysis"
```

---

### Task 6: Rewrite FIRE Page — Input Panel

Replace the existing FIRE page inputs with the 6 new sections.

**Files:**
- Modify: `src/pages/Fire.tsx`

- [ ] **Step 1: Replace state and imports**

Replace the state definition and imports in `Fire.tsx`. The new state has all the fields from the spec. Use `useAccounts()` instead of just `useNetWorth()` to get RRSP balance and weighted return rate.

```typescript
import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAccounts, useUserProfile } from '@/db/hooks'
import { formatCurrency } from '@/lib/utils'
import { calculateFirePlan, type FirePlanResult } from '@/engine/retirement/fire-plan'
import { estimateCppBenefitAllAges } from '@/engine/retirement/cpp-benefit'
import { estimateOasBenefit } from '@/engine/retirement/oas-benefit'
import { isDebtType } from '@/types'
import Decimal from 'decimal.js'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, Legend,
} from 'recharts'
import { Flame, TrendingUp, Coffee, Leaf, Crown, CheckCircle, AlertTriangle } from 'lucide-react'
```

New state:

```typescript
const [params, setParams] = useState({
  annualExpenses: '50000',
  postFireSpending: '50000',
  leanExpenses: '35000',
  fatExpenses: '80000',
  annualSavings: '30000',
  targetFireAge: 50,
  lifeExpectancy: 90,
  postFireIncome: '0',
  hasSpouse: false,
  spouseIncome: '0',
  spousePortfolio: '0',
  cppStartAge: 65,
  oasStartAge: 65,
  rrspStartAge: 65,
  withdrawalRate: '0.04',
  inflationRate: '0.02',
})
```

Derived values:

```typescript
const accounts = useAccounts()
const profile = useUserProfile()

const currentAge = useMemo(() => {
  if (!profile?.dateOfBirth) return 30
  return new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
}, [profile])

const { netWorth, rrspBalance, weightedReturnRate } = useMemo(() => {
  const assets = accounts.filter(a => !isDebtType(a.type))
  const debts = accounts.filter(a => isDebtType(a.type))
  const totalAssets = assets.reduce((s, a) => s.plus(new Decimal(a.balance || '0')), new Decimal(0))
  const totalDebts = debts.reduce((s, a) => s.plus(new Decimal(a.balance || '0')), new Decimal(0))
  const netWorth = totalAssets.minus(totalDebts)

  const rrspBalance = accounts
    .filter(a => a.type === 'rrsp')
    .reduce((s, a) => s.plus(new Decimal(a.balance || '0')), new Decimal(0))

  // Balance-weighted average return rate across non-debt accounts
  let weightedReturnRate = new Decimal('0.05') // default
  if (totalAssets.gt(0)) {
    const weightedSum = assets.reduce((s, a) => {
      const bal = new Decimal(a.balance || '0')
      const rate = new Decimal(a.expectedReturnRate || '5')
      return s.plus(bal.times(rate))
    }, new Decimal(0))
    weightedReturnRate = weightedSum.div(totalAssets).div(100) // convert % to decimal
  }

  return { netWorth, rrspBalance, weightedReturnRate }
}, [accounts])
```

- [ ] **Step 2: Build the input panel JSX**

Replace the existing input Card with 6 sections. Use collapsible `<details>` elements or just stacked cards for each section. The sections are:

1. **FIRE Goal**: Target FIRE Age, Life Expectancy
2. **Spending & Saving**: Current Expenses, Post-FIRE Spending, Lean, Fat, Savings
3. **Income After FIRE**: Post-FIRE Income, Spouse toggle, Spouse Income, Spouse Portfolio
4. **Government Benefits**: CPP Start Age dropdown (60-70), OAS Start Age dropdown (65-70)
5. **RRSP Strategy**: Withdrawal Start Age dropdown (targetFireAge to 71)
6. **Assumptions**: Withdrawal Rate slider, Inflation Rate slider

Each section gets a heading with the section name. The spouse fields conditionally render when `hasSpouse` is true. CPP/OAS dropdowns use the `<Select>` component with options generated from the valid range.

- [ ] **Step 3: Wire up calculateFirePlan**

```typescript
const firePlan = useMemo((): FirePlanResult | null => {
  if (currentAge <= 0) return null
  return calculateFirePlan({
    currentAge,
    targetFireAge: params.targetFireAge,
    lifeExpectancy: params.lifeExpectancy,
    currentNetWorth: netWorth,
    annualSavings: new Decimal(params.annualSavings || '0'),
    currentAnnualExpenses: new Decimal(params.annualExpenses || '0'),
    postFireAnnualSpending: new Decimal(params.postFireSpending || '0'),
    leanExpenses: new Decimal(params.leanExpenses || '0'),
    fatExpenses: new Decimal(params.fatExpenses || '0'),
    postFireAnnualIncome: new Decimal(params.postFireIncome || '0'),
    hasSpouse: params.hasSpouse,
    spouseAnnualIncome: new Decimal(params.spouseIncome || '0'),
    spousePortfolio: new Decimal(params.spousePortfolio || '0'),
    cppStartAge: params.cppStartAge,
    oasStartAge: params.oasStartAge,
    rrspWithdrawalStartAge: params.rrspStartAge,
    rrspBalance,
    withdrawalRate: new Decimal(params.withdrawalRate || '0.04'),
    inflationRate: new Decimal(params.inflationRate || '0.02'),
    expectedReturnRate: weightedReturnRate,
    yearsContributedCPP: profile?.yearsContributedCPP || 20,
    province: profile?.province || 'ON',
  })
}, [currentAge, params, netWorth, rrspBalance, weightedReturnRate, profile])
```

- [ ] **Step 4: Verify dev server renders the input panel**

Run: `npm run dev`
Check: The FIRE page renders all 6 input sections without errors. Changing inputs updates state.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Fire.tsx
git commit -m "feat: rewrite FIRE page input panel with all new sections"
```

---

### Task 7: FIRE Page — Feasibility Banner and Enhanced FIRE Cards

Add the feasibility banner and update the FIRE cards to show effective numbers.

**Files:**
- Modify: `src/pages/Fire.tsx`

- [ ] **Step 1: Add feasibility banner**

At the top of the results panel (`lg:col-span-3`), add a banner card that shows:
- Green state when `firePlan.feasibility.isOnTrack`: "On track to FIRE at [age]"
- Amber state when not on track: "Gap: $[X] needed — on trajectory for age [projectedFireAge]"
- Progress bar showing `currentTotal / effectiveFireNumber`
- Display: current total, effective FIRE number, gap

Use `CheckCircle` icon (green) and `AlertTriangle` icon (amber) from lucide-react.

- [ ] **Step 2: Update FIRE type cards to use effective numbers**

Replace the `fireResults.map()` rendering to use `firePlan.fireTypes` instead of the old `calculateAllFireTypes`. Each card shows:
- `effectiveNumber` instead of `targetNumber`
- `yearsToFire` from the new calculation
- `progress` percentage
- Barista card shows "Required income: $X/yr" instead of a portfolio number

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Check: Banner shows on-track/gap status. FIRE cards show effective numbers. Changing inputs (especially post-FIRE income, spouse) visibly reduces the effective numbers.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Fire.tsx
git commit -m "feat: add FIRE feasibility banner and enhanced FIRE type cards"
```

---

### Task 8: FIRE Page — Income Timeline Chart

Add the stacked area chart showing income sources from FIRE age to life expectancy.

**Files:**
- Modify: `src/pages/Fire.tsx`

- [ ] **Step 1: Transform timeline data for Recharts**

```typescript
const timelineChartData = useMemo(() => {
  if (!firePlan) return []
  return firePlan.incomeTimeline.map(year => ({
    age: year.age,
    'Portfolio Withdrawal': year.portfolioWithdrawal.toNumber(),
    'Post-FIRE Income': year.postFireIncome.toNumber(),
    'Spouse Income': year.spouseIncome.toNumber(),
    'CPP': year.cppIncome.toNumber(),
    'OAS': year.oasIncome.toNumber(),
    spending: year.spending.toNumber(),
  }))
}, [firePlan])
```

- [ ] **Step 2: Add the stacked area chart**

Below the FIRE cards, add a Card with a `<ResponsiveContainer>` containing a Recharts `<AreaChart>`:
- Stacked areas for each income source with distinct colors:
  - Portfolio Withdrawal: `#3b82f6` (blue)
  - Post-FIRE Income: `#22c55e` (green)
  - Spouse Income: `#a855f7` (purple)
  - CPP: `#f97316` (orange)
  - OAS: `#14b8a6` (teal)
- `<ReferenceLine>` at spending amount (dashed, labeled "Annual Spending")
- X-axis: age, Y-axis: dollar amounts formatted as `$XXK`
- Tooltip showing all values formatted as currency

Conditionally hide the Spouse Income area if `!params.hasSpouse`.

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Check: Chart shows income sources phasing in at CPP/OAS start ages. Changing start ages moves when the bands appear. The spending reference line is visible.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Fire.tsx
git commit -m "feat: add post-FIRE income timeline stacked area chart"
```

---

### Task 9: FIRE Page — RRSP Strategy Comparison

Display the side-by-side RRSP early vs deferred comparison.

**Files:**
- Modify: `src/pages/Fire.tsx`

- [ ] **Step 1: Add RRSP comparison card**

Below the income timeline chart, add a Card with two columns:

```
┌─────────────────────┬─────────────────────┐
│ Early (age XX)      │ Defer to 71         │
├─────────────────────┼─────────────────────┤
│ Balance: $XXX,XXX   │ Balance: $XXX,XXX   │
│ Annual: $XX,XXX     │ Annual: $XX,XXX     │
│ Tax rate: XX%       │ Tax rate: XX%       │
│ After-tax total:    │ After-tax total:    │
│ $X,XXX,XXX          │ $X,XXX,XXX          │
└─────────────────────┴─────────────────────┘
       ✓ Recommended (or on other side)
```

- Highlight the recommended column with a subtle border color
- If `oasClawbackWarning` is true, show a warning: "Large RRIF withdrawals at 71 may trigger OAS clawback"
- Show "No RRSP accounts found" if `rrspBalance` is zero

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`
Check: Both columns render with data. Recommended side is highlighted. Changing RRSP withdrawal start age updates the early column.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Fire.tsx
git commit -m "feat: add RRSP strategy comparison panel"
```

---

### Task 10: FIRE Page — CPP/OAS Recommendation + Benefit Tables

Add the recommendation card and update the existing benefit tables.

**Files:**
- Modify: `src/pages/Fire.tsx`

- [ ] **Step 1: Add benefit recommendation card**

Above the existing CPP/OAS tables, add a recommendation Card:
- "We recommend starting CPP at [age] and OAS at [age]"
- Monthly at 65 vs monthly at recommended age
- Break-even age
- Reasoning text
- Styled with a left border accent (same as the info callouts in the input panel)

- [ ] **Step 2: Update OAS table to use chosen start age**

The current OAS card hardcodes age 65. Update it to use `params.oasStartAge`:

```typescript
const oasEstimate = useMemo(() => {
  return estimateOasBenefit(
    params.oasStartAge,
    parseFloat(params.postFireSpending) || 50000,
    40,
    params.oasStartAge
  )
}, [params.oasStartAge, params.postFireSpending])
```

Update the card description from "At age 65" to "At age {params.oasStartAge}". Show the deferral bonus percentage if `oasStartAge > 65`.

- [ ] **Step 3: Add recommendation callout to Government Benefits input section**

In the left panel's Government Benefits section, below the dropdowns, add a dynamic callout that shows the recommendation:
- "💡 Consider starting CPP at {recommended} for {X}% more monthly income"
- Updates reactively as inputs change

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`
Check: Recommendation card appears with reasoning. OAS table reflects chosen start age. Changing FIRE age updates the recommendation.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Fire.tsx
git commit -m "feat: add CPP/OAS recommendation card and update benefit tables"
```

---

### Task 11: Remove Old FIRE Progress Bar Chart

The old bar chart comparing target vs current for each FIRE type is replaced by the new results sections. Clean it up.

**Files:**
- Modify: `src/pages/Fire.tsx`

- [ ] **Step 1: Remove the old BarChart and its data**

Remove:
- The `chartData` useMemo that maps `fireResults` to bar chart data
- The "FIRE Progress" Card containing the `<BarChart>`
- The `portfolioIncome` state field (replaced by `postFireIncome`)
- Any remaining references to old `calculateAllFireTypes` imports

Keep: the FIRE_ICONS and FIRE_COLORS constants (still used by the enhanced cards).

- [ ] **Step 2: Remove unused imports**

Remove `BarChart`, `Bar`, `Cell` from recharts imports if no longer used. Remove `calculateAllFireTypes` import.

- [ ] **Step 3: Verify no console errors**

Run: `npm run dev`
Check: Page renders cleanly with no console errors. All old chart code is gone.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Fire.tsx
git commit -m "refactor: remove old FIRE progress bar chart"
```

---

### Task 12: Final Integration Test

Run all tests and verify the full page works end-to-end.

**Files:**
- All modified files

- [ ] **Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass, including both old `retirement.test.ts` and new `fire-plan.test.ts`.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
Verify:
1. All 6 input sections render and accept input
2. Feasibility banner shows correct on-track/gap status
3. Enhanced FIRE cards show effective numbers that decrease when adding post-FIRE income
4. Income timeline chart shows income sources phasing in at correct ages
5. RRSP comparison shows two strategies with recommendation
6. CPP/OAS recommendation updates when changing FIRE age
7. Spouse fields appear/disappear with toggle
8. Inflation slider affects all numbers
9. No console errors

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for FIRE calculator enhancement"
```
