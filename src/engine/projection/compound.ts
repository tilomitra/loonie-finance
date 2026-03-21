import Decimal from 'decimal.js'

/**
 * Calculate compound growth over N years
 */
export function compoundGrowth(
  principal: Decimal,
  annualRate: Decimal,
  years: number
): Decimal {
  return principal.times(annualRate.plus(1).pow(years))
}

/**
 * Calculate future value with regular annual contributions
 * FV = P(1+r)^n + C * [((1+r)^n - 1) / r]
 */
export function futureValueWithContributions(
  principal: Decimal,
  annualContribution: Decimal,
  annualRate: Decimal,
  years: number
): Decimal {
  if (annualRate.eq(0)) {
    return principal.plus(annualContribution.times(years))
  }
  const growthFactor = annualRate.plus(1).pow(years)
  const principalFV = principal.times(growthFactor)
  const contributionFV = annualContribution.times(
    growthFactor.minus(1).div(annualRate)
  )
  return principalFV.plus(contributionFV)
}
