# Regime-Aware Monte Carlo Simulation

**Date:** 2026-03-21
**Status:** Approved

## Problem

The current Monte Carlo simulation uses independent, identically distributed normal draws per year. This produces unrealistic projections because real markets exhibit volatility clustering (bad years clump together), fat tails (extreme moves happen more often than normal distributions predict), and cross-asset correlation that varies by market conditions.

## Design

### Engine Changes

**File:** `src/engine/projection/monte-carlo.ts`

#### Pre-existing Type Conflict

There are duplicate `MonteCarloResult` definitions: one in `src/types/index.ts` (using `ProjectionPoint[]` with string-based `netWorth`) and one in `monte-carlo.ts` (using `MonteCarloPoint[]` with numeric `netWorth`). The engine's local definition is the one actually used. As part of this work, **remove the unused `MonteCarloResult` from `src/types/index.ts`** to eliminate the conflict.

#### Regime Model

Three market regimes modeled as a Markov chain. Each year, the simulation transitions between regimes based on a fixed probability matrix. **The simulation always starts in the Normal regime.**

| Regime | Stock Mean | Stock Vol | Bond Mean | Bond Vol | Cash Mean | Cash Vol | Stock-Bond Correlation |
|--------|-----------|-----------|-----------|----------|-----------|----------|----------------------|
| Bull   | +12%      | 12%       | +4%       | 5%       | +2.5%     | 1%       | +0.2                 |
| Normal | +7%       | 16%       | +3.5%     | 6%       | +2%       | 1%       | 0.0                  |
| Bear   | -15%      | 25%       | +5%       | 8%       | +1.5%     | 1%       | -0.3                 |

**Transition matrix** (row = current, column = next):

|        | Bull | Normal | Bear |
|--------|------|--------|------|
| Bull   | 0.70 | 0.25   | 0.05 |
| Normal | 0.20 | 0.65   | 0.15 |
| Bear   | 0.10 | 0.40   | 0.50 |

Key properties:
- Bear markets persist (50% self-transition) creating realistic drawdown sequences
- Bull markets are sticky (70%) creating multi-year runs
- Bear→Bull direct transition is rare (10%) — recovery typically goes through Normal first

#### Relationship to User Assumptions

The user's `stockReturn`, `bondReturn`, and `cashReturn` sliders are **ignored in the Monte Carlo path**. These sliders continue to drive the deterministic projection only. The Monte Carlo uses its own regime-calibrated parameters. This is intentional — the regime model is the point, and mixing user overrides with calibrated parameters would produce incoherent results.

The user still controls: iteration count, retirement age, life expectancy, contributions, and province (which affect the simulation through account growth and contribution logic).

#### Fat Tails

Replace `normalRandom` with Student's t distribution (5 degrees of freedom). This preserves the same mean and variance but produces heavier tails, so extreme years (-30%, +40%) occur at historically realistic frequencies.

Implementation: generate a t-distributed random variable by dividing a standard normal by `sqrt(chi-squared(df) / df)`. The chi-squared(5) is the sum of 5 squared standard normals. This increases RNG consumption (~3x per draw), which is acceptable at the iteration counts used.

#### Correlated Asset Returns

Use Cholesky decomposition of the 2x2 stock-bond correlation matrix (per regime) to generate correlated draws. Steps:

1. Draw two independent t-distributed random variables (z1, z2)
2. Apply Cholesky factor: `stock_return = z1`, `bond_return = ρ * z1 + √(1-ρ²) * z2`
3. Scale each by the regime's mean and standard deviation

Cash returns are drawn independently using the regime's cash parameters.

#### Exported Internal Helpers

To enable proper unit testing, the following internal functions are exported:

- `sampleRegime(current: Regime, rng: () => number): Regime` — single Markov transition
- `tDistRandom(rng: () => number, df: number, mean: number, stdDev: number): number` — Student's t draw
- `correlatedReturns(rng: () => number, regime: RegimeParams, df: number): { stockReturn: number; bondReturn: number; cashReturn: number }` — single year's correlated draws

The main `runMonteCarloSimulation` signature is unchanged.

#### New Internal Types

```typescript
type Regime = 'bull' | 'normal' | 'bear'

interface RegimeParams {
  stockMean: number
  stockVol: number
  bondMean: number
  bondVol: number
  cashMean: number
  cashVol: number
  correlation: number
}
```

### UI Changes

**File:** `src/pages/Projections.tsx`

A new Card added below the existing "Net Worth Projection" chart and above the "Year-by-Year Breakdown" table.

#### Monte Carlo Simulation Card

**Header:** "Monte Carlo Simulation" title with description "Regime-aware projection with confidence bands"

**Controls (single row above chart):**
- Iteration count: three `Button` components styled as a segmented group (using existing Button component with active state via primary/secondary variants). Options: 500 / 1,000 / 5,000. Default: 1,000.
- "Run Simulation" button (primary style)
- For the 5,000 option, show a brief loading state ("Running...") since computation may take 300-500ms with the t-distribution overhead.

**Chart (rendered after simulation runs):**
- Recharts AreaChart, same height as the deterministic chart (`h-96`)
- **Data transformation for bands:** The chart data is shaped as band deltas, not raw percentile values. Each data point has: `{ age, p5, band_p5_p25: p25 - p5, band_p25_p75: p75 - p25, band_p75_p95: p95 - p75 }`. Three `<Area>` components are stacked on top of a transparent base area at p5. This is the standard Recharts approach for confidence bands.
- Color scheme: three tones of the app's green — `primary/8` (outer bands), `primary/15` (middle band)
- A `<Line>` component for p50 (median) as a solid primary green line
- A `<Line>` component for the deterministic projection as a dashed line (text-secondary color). The deterministic data is converted from `Decimal` to `number` to match the chart's data format.
- X-axis: age (matching the existing chart)
- Y-axis: dollar values with $K formatting

**Summary stats (row below chart):**
Four inline metrics in a `grid grid-cols-4` layout, using the existing label style (`text-[11px] uppercase tracking-widest`):
- **Success Rate**: percentage of iterations where net worth never goes negative
- **Median Final**: p50 net worth at life expectancy
- **Worst Case (5th)**: p5 net worth at life expectancy
- **Best Case (95th)**: p95 net worth at life expectancy

**Note:** Small text below stats: "Based on {n} simulations with regime-switching market model. Darker bands represent more likely outcomes."

**State management:** Simulation results stored in component state (`useState`). Re-running clears previous results. No persistence to IndexedDB.

### Test Changes

**File:** `src/engine/projection/__tests__/monte-carlo.test.ts`

New tests added alongside existing ones (existing tests pass unchanged):

1. **`sampleRegime` transitions** — call `sampleRegime('bear', rng)` 1000 times, verify ~50% stay in bear, ~40% go to normal, ~10% go to bull (within statistical tolerance)
2. **`tDistRandom` produces fat tails** — generate 10,000 draws and verify kurtosis > 3 (normal distribution kurtosis), confirming heavier tails
3. **`correlatedReturns` shows expected correlation sign** — generate 10,000 samples with Bear regime (ρ=-0.3), compute sample correlation between stock and bond returns, verify it is negative
4. **End-to-end percentile ordering** — existing test (p5 < p50 < p95) continues to pass
5. **Seed reproducibility** — existing test continues to pass with new internals
6. **Wider spread than i.i.d.** — run simulation, verify p5-p95 spread at final year is wider than a theoretical i.i.d. normal simulation with equivalent mean parameters (computed analytically)

## Files Modified

1. `src/engine/projection/monte-carlo.ts` — engine improvements
2. `src/engine/projection/__tests__/monte-carlo.test.ts` — new tests
3. `src/pages/Projections.tsx` — UI card addition
4. `src/types/index.ts` — remove duplicate `MonteCarloResult` type

## Out of Scope

- Historical data calibration (using hand-tuned parameters instead)
- Web worker for background computation
- Persisting simulation results
- Monte Carlo on other pages (FIRE, Tax)
- Accessibility (ARIA labels, keyboard navigation for toggle) — can be added in a follow-up
