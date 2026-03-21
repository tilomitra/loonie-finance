# Per-Account Expected Return Rate

Replace global stock/bond/cash return assumptions with a single expected annual return rate per account.

## Motivation

Users have accounts with very different risk/return profiles (e.g., chequing at 2.5%, TFSA at 5%, RRSP at 10%). The current model uses a global stock/bond/cash assumption blended by asset allocation, which doesn't map to how users think about their accounts.

## Data Model Changes

### Account Interface

Add `expectedReturnRate: string` (annual percentage as decimal.js string, e.g., `'5.0'`).

Remove `assetAllocation` — no longer needed since returns are specified directly.

```typescript
interface Account {
  id: string
  name: string
  type: AccountType
  balance: string
  currency: 'CAD' | 'USD'
  institution: string
  expectedReturnRate: string  // NEW: annual return % (e.g., '5.0')
  // assetAllocation removed
  contributionRoom: string | null
  interestRate: string | null  // debts only
  notes: string
  createdAt: number
  updatedAt: number
}
```

### ScenarioAssumptions Interface

Remove `stockReturn`, `bondReturn`, `cashReturn` — replaced by per-account rates.

### Smart Defaults by Account Type

| Type | Default Rate |
|------|-------------|
| cash | 2.5% |
| tfsa | 5% |
| rrsp | 5% |
| fhsa | 5% |
| non-registered | 5% |
| crypto | 8% |
| property | 3% |
| pension | 4% |

Debt types continue using their existing `interestRate` field.

## UI Changes

### Accounts Page (create/edit dialog)

- Add "Expected Annual Return (%)" input field for non-debt account types
- Pre-fill with smart default based on selected account type
- When user changes account type, update the default (unless user has manually edited it)

### Projections Page

- Remove stock return, bond return, and cash return assumption inputs
- Per-account rates are now the source of truth for growth

## Engine Changes

### Deterministic Projection (`project-net-worth.ts`)

- Use `account.expectedReturnRate` directly as the annual growth rate
- Remove `getAccountReturnRate()` function and weighted allocation logic
- Debts continue using `account.interestRate`

### Monte Carlo Simulation (`monte-carlo.ts`)

- Use `account.expectedReturnRate` as the mean annual return for each account
- Scale volatility to the rate: higher expected return = higher volatility
- Suggested volatility mapping: `vol = rate * 2` capped at reasonable bounds (e.g., min 1%, max 25%)
- Retain regime switching — regimes apply a multiplier/shift to the per-account mean and vol
- Retain fat-tailed Student's t-distribution for realistic tail risk
- Remove Cholesky correlation (was for stock/bond correlation, no longer applicable with single-rate model)

### Regime Integration with Per-Account Rates

Each regime shifts the per-account mean and volatility:

| Regime | Mean Shift | Vol Multiplier |
|--------|-----------|----------------|
| bull   | +3%       | 0.8x           |
| normal | 0%        | 1.0x           |
| bear   | -8%       | 1.5x           |

Example: Account with 5% expected return in a bear market → mean = -3%, vol = 1.5x base vol.

## Database Migration

Dexie version upgrade:
1. Add `expectedReturnRate` to all existing accounts using their type's smart default
2. Remove `assetAllocation` from all existing accounts

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Update `Account` and `ScenarioAssumptions` interfaces |
| `src/db/database.ts` | Add migration, update schema version |
| `src/pages/Accounts.tsx` | Add return rate input, smart defaults by type |
| `src/pages/Projections.tsx` | Remove stock/bond/cash return inputs |
| `src/engine/projection/project-net-worth.ts` | Use per-account rate directly |
| `src/engine/projection/monte-carlo.ts` | Refactor to single-rate model with regime shifts |
| `src/engine/projection/__tests__/` | Update tests for new model |
