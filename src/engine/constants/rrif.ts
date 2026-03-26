// Registered Retirement Income Fund (RRIF) constants
// Based on CRA prescribed minimum withdrawal factors

// Age at which RRSP must be converted to RRIF
export const RRIF_CONVERSION_AGE = 71

// Minimum annual withdrawal rates by age (CRA prescribed factors)
// Rates apply starting at age 72 (first year of mandatory withdrawals)
export const RRIF_MINIMUM_RATES: Record<number, number> = {
  72: 0.0528,
  73: 0.0540,
  74: 0.0553,
  75: 0.0567,
  76: 0.0582,
  77: 0.0598,
  78: 0.0617,
  79: 0.0636,
  80: 0.0658,
  81: 0.0682,
  82: 0.0708,
  83: 0.0738,
  84: 0.0771,
  85: 0.0808,
  86: 0.0851,
  87: 0.0899,
  88: 0.0955,
  89: 0.1021,
  90: 0.1099,
  91: 0.1192,
  92: 0.1306,
  93: 0.1449,
  94: 0.1634,
  95: 0.2000,
}

/**
 * Returns the CRA prescribed minimum RRIF withdrawal rate for a given age.
 * Returns 0 for ages below 72 (no mandatory withdrawal yet).
 * Returns 0.20 (20%) for ages 95 and above.
 */
export function getRrifMinimumRate(age: number): number {
  if (age < 72) return 0
  if (age >= 95) return 0.2
  return RRIF_MINIMUM_RATES[age]
}
