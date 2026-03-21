import Decimal from 'decimal.js'
import { OAS_2026 } from '../constants/oas'

export interface OasBenefitResult {
  grossMonthlyBenefit: Decimal
  clawbackAmount: Decimal
  netMonthlyBenefit: Decimal
  netAnnualBenefit: Decimal
  claimAge: number
  deferralBonus: Decimal
}

/**
 * Estimate OAS monthly benefit with clawback
 * @param claimAge - Age to start OAS (65-70)
 * @param annualIncome - Expected annual income in retirement (for clawback calculation)
 * @param yearsOfResidence - Years of Canadian residence after age 18 (max 40)
 * @param age - Current or projected age (affects benefit amount for 75+)
 */
export function estimateOasBenefit(
  claimAge: number,
  annualIncome: number,
  yearsOfResidence: number = 40,
  age?: number
): OasBenefitResult {
  if (claimAge < 65 || claimAge > 70) {
    throw new Error('OAS claim age must be between 65 and 70')
  }

  const effectiveAge = age || claimAge
  const baseMonthly = effectiveAge >= 75
    ? OAS_2026.maxMonthlyBenefit75plus
    : OAS_2026.maxMonthlyBenefit65to74

  // Partial OAS based on years of residence
  const residenceFactor = new Decimal(Math.min(yearsOfResidence, OAS_2026.fullResidenceYears))
    .div(OAS_2026.fullResidenceYears)

  // Deferral bonus
  let deferralBonus = new Decimal(0)
  if (claimAge > 65) {
    const monthsDeferred = (claimAge - 65) * 12
    deferralBonus = new Decimal(OAS_2026.deferralBonusPerMonth).times(monthsDeferred)
    deferralBonus = Decimal.min(deferralBonus, OAS_2026.maxDeferralBonus)
  }

  const grossMonthly = new Decimal(baseMonthly)
    .times(residenceFactor)
    .times(deferralBonus.plus(1))

  // Clawback calculation
  const income = new Decimal(annualIncome)
  let annualClawback = new Decimal(0)
  if (income.gt(OAS_2026.clawbackThreshold)) {
    annualClawback = income
      .minus(OAS_2026.clawbackThreshold)
      .times(OAS_2026.clawbackRate)
  }
  const monthlyClawback = Decimal.min(annualClawback.div(12), grossMonthly)

  const netMonthly = Decimal.max(grossMonthly.minus(monthlyClawback), 0)

  return {
    grossMonthlyBenefit: grossMonthly,
    clawbackAmount: monthlyClawback,
    netMonthlyBenefit: netMonthly,
    netAnnualBenefit: netMonthly.times(12),
    claimAge,
    deferralBonus,
  }
}
