import Decimal from 'decimal.js'
import { CPP_2026 } from '../constants/cpp'

export interface CppBenefitResult {
  monthlyBenefit: Decimal
  annualBenefit: Decimal
  claimAge: number
  adjustmentFactor: Decimal
}

/**
 * Estimate CPP monthly benefit based on claim age and contribution history
 * @param claimAge - Age to start receiving CPP (60-70)
 * @param yearsContributed - Number of years of CPP contributions
 * @param averageEarningsRatio - Ratio of average earnings to YMPE (0-1, where 1 = always earned at/above YMPE)
 */
export function estimateCppBenefit(
  claimAge: number,
  yearsContributed: number,
  averageEarningsRatio: number = 0.75
): CppBenefitResult {
  if (claimAge < 60 || claimAge > 70) {
    throw new Error('CPP claim age must be between 60 and 70')
  }

  // Calculate adjustment factor based on claim age
  let adjustmentFactor: Decimal
  if (claimAge < 65) {
    const monthsBefore65 = (65 - claimAge) * 12
    adjustmentFactor = new Decimal(1).minus(
      new Decimal(CPP_2026.earlyReductionPerMonth).times(monthsBefore65)
    )
  } else if (claimAge > 65) {
    const monthsAfter65 = (claimAge - 65) * 12
    adjustmentFactor = new Decimal(1).plus(
      new Decimal(CPP_2026.lateIncreasePerMonth).times(monthsAfter65)
    )
  } else {
    adjustmentFactor = new Decimal(1)
  }

  // Estimate benefit based on contribution history
  const effectiveYears = Math.min(
    yearsContributed,
    CPP_2026.maxContributoryYears - CPP_2026.dropoutYears
  )
  const maxEffectiveYears = CPP_2026.maxContributoryYears - CPP_2026.dropoutYears
  const yearsFactor = new Decimal(effectiveYears).div(maxEffectiveYears)

  const maxBenefit = new Decimal(CPP_2026.maxMonthlyBenefitAge65)
  const monthlyBenefit = maxBenefit
    .times(yearsFactor)
    .times(averageEarningsRatio)
    .times(adjustmentFactor)

  return {
    monthlyBenefit: Decimal.max(monthlyBenefit, 0),
    annualBenefit: Decimal.max(monthlyBenefit.times(12), 0),
    claimAge,
    adjustmentFactor,
  }
}

/**
 * Generate CPP benefit estimates for all possible claim ages (60-70)
 */
export function estimateCppBenefitAllAges(
  yearsContributed: number,
  averageEarningsRatio: number = 0.75
): CppBenefitResult[] {
  const results: CppBenefitResult[] = []
  for (let age = 60; age <= 70; age++) {
    results.push(estimateCppBenefit(age, yearsContributed, averageEarningsRatio))
  }
  return results
}
