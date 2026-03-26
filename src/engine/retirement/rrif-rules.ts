import Decimal from 'decimal.js'
import { getRrifMinimumRate, RRIF_CONVERSION_AGE } from '../constants/rrif'

/**
 * Calculate the mandatory minimum RRIF withdrawal for a given age and balance.
 * Returns 0 for ages below 72 (no mandatory withdrawal).
 */
export function calculateRrifMinimum(age: number, balance: Decimal): Decimal {
  const rate = getRrifMinimumRate(age)
  if (rate === 0) return new Decimal(0)
  return balance.mul(rate).toDecimalPlaces(2)
}

/**
 * Check if an RRSP should be converted to RRIF at this age.
 */
export function shouldConvertToRrif(age: number): boolean {
  return age >= RRIF_CONVERSION_AGE
}
