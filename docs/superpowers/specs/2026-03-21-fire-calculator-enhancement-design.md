# FIRE Calculator Enhancement — Design Spec

## Overview

Enhance the existing FIRE calculator page from a basic calculator into a comprehensive Canadian FIRE planning tool. Keep the single-page layout (left inputs, right results) but add missing inputs for target FIRE age, post-FIRE spending and income, spouse support, government benefit timing, RRSP withdrawal strategy, and inflation. All calculations are inflation-adjusted automatically.

## Current State

The FIRE page (`src/pages/Fire.tsx`) has:
- **Inputs**: annual/lean/fat expenses, annual savings, portfolio income, retirement age, withdrawal rate slider
- **Results**: 5 FIRE type cards (lean/regular/fat/coast/barista), FIRE progress bar chart, CPP estimates table (ages 60-70), OAS estimate at 65

Key gaps: no target FIRE age, no post-FIRE spending/income modeling, no spouse, CPP/OAS don't feed into FIRE calculations, no RRSP drawdown strategy, no inflation adjustment.

## Design

### Input Panel (Left Column)

Six sections, top to bottom. Existing inputs reorganized into these sections.

#### 1. FIRE Goal
- **Target FIRE Age** — number input (default: current retirement age from profile)
- **Life Expectancy** — number input (default: 90)

#### 2. Spending & Saving
- **Current Annual Expenses** — text input (existing)
- **Post-FIRE Annual Spending** — text input (new, defaults to current expenses). Distinct from pre-FIRE expenses since spending may change.
- **Lean Expenses** — text input (existing)
- **Fat Expenses** — text input (existing)
- **Annual Savings** — text input (existing)

#### 3. Income After FIRE
- **Post-FIRE Annual Income** — text input. Covers all non-government income (part-time work, rental, side business). Single field for simplicity.
- **Spouse Contributing?** — toggle (Yes/No, default No)
- **Spouse Annual Income** — text input (shown when spouse = Yes)
- **Spouse Savings/Portfolio** — text input (shown when spouse = Yes). Lump sum representing spouse's total portfolio.

#### 4. Government Benefits
- **CPP Start Age** — dropdown, range 60-70, default 65
- **OAS Start Age** — dropdown, range 65-70, default 65
- **Recommendation callout** — dynamic text box that suggests optimal CPP/OAS start ages based on the user's FIRE age, portfolio size, and post-FIRE income. Updates reactively.

#### 5. RRSP Strategy
- **RRSP Withdrawal Start Age** — dropdown, range from FIRE age to 71, default 65
- **Info callout** — "Mandatory RRIF conversion at 71"

#### 6. Assumptions
- **Withdrawal Rate** — range slider 3-5% (existing)
- **Inflation Rate** — range slider 1-5%, default 2% (new, standalone — not dependent on Projections page)

### Results Panel (Right Column)

Five sections, top to bottom.

#### 1. FIRE Feasibility Banner
A prominent status card at the top:
- **On track** (green): "On track to FIRE at [age] — projected to reach $[FIRE number] by [year]"
- **Gap** (amber): "Gap: need $[X] more to FIRE at [age] — on current trajectory, FIRE at [calculated age]"
- Shows: current net worth (from accounts) + spouse portfolio, required FIRE number, progress percentage
- FIRE number accounts for post-FIRE income, spouse income, and government benefits that reduce portfolio withdrawal needs

#### 2. Enhanced FIRE Type Cards
Same 5 cards (Lean/Regular/Fat/Coast/Barista) with existing icons and color coding, but:
- FIRE numbers now represent the **effective** number — the initial portfolio at FIRE age needed to sustain withdrawals through retirement without depletion
- Calculated via year-by-year simulation: for each year from FIRE age to life expectancy, compute income gap (spending minus all active income sources at that age). The effective FIRE number is the initial portfolio that can cover all gaps without running out. This is NOT a simple division — it requires iterating year-by-year because income sources phase in at different ages.
- Before CPP/OAS kick in, portfolio withdrawals are higher; after, they decrease
- All amounts inflation-adjusted to today's dollars
- Years-to-FIRE recalculated with the effective number
- **Barista FIRE exception**: Barista FIRE shows required part-time income (not a portfolio target). Under the enhanced model, this is reduced by government benefits active at each age. Display the max required part-time income across all pre-benefit years.

#### 3. Post-FIRE Income Timeline Chart
Stacked area chart (Recharts) from FIRE age to life expectancy:
- **Layers** (bottom to top): Portfolio withdrawals (blue), Post-FIRE income (green), Spouse income (purple), CPP (orange, starts at chosen age), OAS (teal, starts at chosen age)
- **Horizontal reference line**: Post-FIRE annual spending (inflation-adjusted)
- Shows how income sources phase in over time and portfolio withdrawals decrease as benefits kick in
- X-axis: age. Y-axis: annual income in today's dollars

#### 4. RRSP Strategy Comparison
Two-column comparison card:
- **Column A: Early Withdrawal** — start at FIRE age (or chosen age)
- **Column B: Defer to 71** — let RRSP grow, mandatory RRIF at 71

Each column shows:
- Projected RRSP balance at withdrawal start (using account's expected return rate, inflation-adjusted)
- Estimated annual withdrawal amount
- Estimated marginal tax bracket
- Total after-tax income over retirement
- Impact on portfolio longevity (years extended/reduced)

Highlight which strategy produces more total after-tax income.

#### 5. CPP/OAS Recommendation + Tables
- **Recommendation card**: "Given your FIRE age of [X], we recommend [starting CPP at Y / deferring to Z]" with:
  - Dollar comparison: "$[A]/mo at 60 vs $[B]/mo at 70"
  - Break-even age: "Deferring to 70 breaks even at age [X]"
  - Reasoning based on portfolio size and income gap
- **CPP table**: existing table showing estimates at ages 60-70 (uses profile's yearsContributedCPP)
- **OAS estimate**: existing card but updated to use chosen start age and show deferral bonus

### Engine Changes

#### New: `src/engine/retirement/fire-plan.ts`
Core planning engine that ties everything together:

```typescript
interface FirePlanInputs {
  currentAge: number
  targetFireAge: number
  lifeExpectancy: number
  currentNetWorth: Decimal        // from accounts
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
  rrspBalance: Decimal            // from RRSP accounts
  withdrawalRate: Decimal
  inflationRate: Decimal
  expectedReturnRate: Decimal     // weighted avg nominal return from accounts (real return = this - inflationRate)
  yearsContributedCPP: number
  province: string
}

interface FirePlanResult {
  feasibility: {
    isOnTrack: boolean
    effectiveFireNumber: Decimal
    currentTotal: Decimal         // net worth + spouse portfolio
    gap: Decimal
    projectedFireAge: number      // when they'll actually hit it
  }
  fireTypes: {
    type: FireType
    effectiveNumber: Decimal      // reduced by income sources
    yearsToFire: number | null
    progress: number              // percentage
  }[]
  incomeTimeline: {
    age: number
    portfolioWithdrawal: Decimal
    postFireIncome: Decimal
    spouseIncome: Decimal
    cppIncome: Decimal
    oasIncome: Decimal
    totalIncome: Decimal
    spending: Decimal             // inflation-adjusted
  }[]
  rrspComparison: {
    early: RrspStrategyResult
    deferred: RrspStrategyResult
    recommendEarly: boolean
  }
  benefitRecommendation: {
    recommendedCppAge: number
    recommendedOasAge: number
    reasoning: string
    cppBreakEvenAge: number
    monthlyAtRecommended: Decimal
    monthlyAt65: Decimal
  }
}
```

Key calculation logic:
- **Effective FIRE number**: Year-by-year simulation from FIRE age to life expectancy. For each year, compute income gap = inflation-adjusted spending minus all active income sources (post-FIRE income, spouse income, CPP if past cppStartAge, OAS if past oasStartAge, RRSP withdrawals if past rrspWithdrawalStartAge). The effective FIRE number is the initial portfolio value at FIRE age such that, after drawing down to cover gaps and growing at the real return rate each year, the portfolio is not depleted before life expectancy. Solved iteratively.
- **Real vs nominal returns**: `expectedReturnRate` in inputs is the nominal rate (from account settings). The engine computes `realReturn = expectedReturnRate - inflationRate` and uses that for all projections. All output amounts are in today's dollars.
- **Income timeline**: Year-by-year from FIRE age to life expectancy, computing each income source and portfolio drawdown. CPP/OAS amounts from existing engine functions (which take `number` args — convert Decimal to number at call sites).
- **RRSP comparison**: Project RRSP balance forward at expected return, then model two withdrawal schedules. Use federal + provincial tax brackets from existing engine to estimate tax on withdrawals. Note: RRSP/RRIF withdrawals count as income for OAS clawback — the comparison should flag this when large RRIF conversions would trigger clawback.
- **Benefit recommendation**: Compare total lifetime CPP/OAS income at different start ages using present-value comparison (discount future payments at real return rate). Break-even age = age where cumulative PV of deferred payments exceeds cumulative PV of early payments. Factor in portfolio size — larger portfolios favor deferral since you can bridge with withdrawals.
- **OAS years of residence**: Default to 40 (full eligibility). Not exposed as a user input — consistent with current OAS engine behavior.
- **RRSP balance**: Aggregated from all accounts where `type === 'rrsp'`, summing balances. Weighted `expectedReturnRate` computed across all non-debt accounts by balance weight.
- **Edge cases**:
  - If `postFireAnnualSpending <= postFireIncome + spouseIncome + govBenefits`, the effective FIRE number is zero — user is already financially independent. UI shows a "Already FI" state.
  - If `targetFireAge <= currentAge`, treat as "retire now" — skip accumulation phase, go straight to drawdown feasibility.
  - Spouse income is constant for all years (simplification noted in scope exclusions).

#### Performance

Since inputs include sliders (withdrawal rate, inflation), `calculateFirePlan()` may fire frequently. Wrap in `useMemo` with all inputs as dependencies. Consider debouncing slider onChange (e.g. 100ms) to avoid recomputing on every pixel of slider movement.

#### Modifications to existing engine

- `fire.ts` — no changes. The new `fire-plan.ts` replaces `calculateAllFireTypes()` for the enhanced page, computing its own effective FIRE numbers via year-by-year simulation. The old functions remain available for simple calculations.
- `cpp-benefit.ts` and `oas-benefit.ts` — no changes, already support variable start ages. Note: these functions use `number` types, not `Decimal`. Convert at call sites.
- Reuse existing tax engine (`src/engine/tax/`) for RRSP tax bracket estimation

### Data Flow

1. Page loads → read accounts via `useAccounts()` (for net worth, RRSP balance filtered by `type === 'rrsp'`, balance-weighted average return rate across non-debt accounts), user profile (age, province, CPP years)
2. User adjusts inputs → all reactive via React state
3. Inputs feed into `calculateFirePlan()` → returns `FirePlanResult`
4. Result renders into the 5 results sections
5. No new database tables or persistence — all inputs are page-local state (like current implementation)

### What's NOT in Scope

- Full spouse profile (age, accounts, CPP/OAS) — spouse is a simple income + portfolio field
- Phased income (different amounts at different ages) — single annual amount
- Tax optimization beyond RRSP strategy — no detailed tax planning
- Saving FIRE plans to database — inputs are ephemeral page state
- Changes to other pages (Projections, Tax, Accounts)
