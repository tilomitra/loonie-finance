# Per-Account Expected Return Rate

Replace global stock/bond/cash return assumptions with a single expected annual return rate per account.

## Motivation

Users have accounts with very different risk/return profiles (e.g., chequing at 2.5%, TFSA at 5%, RRSP at 10%). The current model uses a global stock/bond/cash assumption blended by asset allocation, which doesn't map to how users think about their accounts.

## Data Model Changes

### Account Interface

Add `expectedReturnRate: string` (annual percentage as decimal.js string, e.g., `'5.0'`).

Remove `assetAllocation` and the `AssetAllocation` interface — no longer needed since returns are specified directly.

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

Note: Debts keep `interestRate` (cost of borrowing). Asset accounts use `expectedReturnRate` (growth). Different semantics, intentionally separate fields.

### ScenarioAssumptions Interface

Remove `stockReturn`, `bondReturn`, `cashReturn` — replaced by per-account rates.

Existing saved scenarios in the database will retain these fields as harmless dead data.

### Smart Defaults by Account Type

| Type | Default Rate | Default Volatility |
|------|-------------|-------------------|
| cash | 2.5% | 1% |
| tfsa | 5% | 12% |
| rrsp | 5% | 12% |
| fhsa | 5% | 12% |
| non-registered | 5% | 12% |
| crypto | 8% | 50% |
| property | 3% | 12% |
| pension | 4% | 8% |

Debt types continue using their existing `interestRate` field.

### Input Validation

- Expected return rate: 0% to 30% (inclusive)
- 0% means no growth, no variance in Monte Carlo

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
- Use type-based volatility lookup (not derived from rate) for realistic risk modeling:

| Type | Volatility |
|------|-----------|
| cash | 1% |
| tfsa, rrsp, fhsa, non-registered | 12% |
| crypto | 50% |
| property | 12% |
| pension | 8% |

- Draw a single market factor per year per regime, then apply per-account vol to generate each account's return. This preserves correlation across accounts (if stocks crash, both TFSA and RRSP decline together).
- Retain regime switching with Markov transition matrix
- Retain fat-tailed Student's t-distribution for realistic tail risk
- Remove Cholesky correlation helper (replaced by shared market factor approach)

### Regime Integration with Per-Account Rates

Regimes apply proportional shifts rather than flat additive shifts, so low-return accounts (cash) are not unrealistically affected:

| Regime | Mean Multiplier | Vol Multiplier |
|--------|----------------|----------------|
| bull   | 1.5x           | 0.8x           |
| normal | 1.0x           | 1.0x           |
| bear   | -0.5x          | 1.5x           |

Example: Cash at 2.5% in bear market → mean = -1.25%, vol = 1.5%. RRSP at 10% in bear → mean = -5%, vol = 18%.

## Database Migration

Dexie version upgrade with `upgrade()` callback:

```typescript
this.version(N).stores({
  accounts: 'id, type, createdAt',
  // ... same indexes
}).upgrade(tx => {
  return tx.table('accounts').toCollection().modify(account => {
    account.expectedReturnRate = DEFAULT_RATES[account.type] ?? '5.0'
    delete account.assetAllocation
  })
})
```

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Update `Account` interface (add `expectedReturnRate`, remove `assetAllocation` and `AssetAllocation` type), update `ScenarioAssumptions` |
| `src/db/database.ts` | Add migration with `upgrade()` callback, update schema version |
| `src/pages/Accounts.tsx` | Add return rate input, smart defaults by type, remove `assetAllocation` from create/edit |
| `src/pages/Projections.tsx` | Remove stock/bond/cash return inputs and defaults |
| `src/pages/ImportExport.tsx` | Handle legacy imports that have `assetAllocation` / old scenario fields |
| `src/engine/projection/project-net-worth.ts` | Use per-account rate directly, remove `getAccountReturnRate()` |
| `src/engine/projection/monte-carlo.ts` | Refactor to single-rate model with type-based vol and shared market factor |
| `src/engine/projection/__tests__/` | Update tests for new model |
