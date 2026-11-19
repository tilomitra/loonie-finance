import { describe, it, expect } from 'vitest'
import { estimateCppBenefit, estimateCppBenefitAllAges } from '../cpp-benefit'
import { estimateOasBenefit } from '../oas-benefit'

describe('CPP Benefit', () => {
  it('should estimate maximum benefit at 65', () => {
    const result = estimateCppBenefit(65, 39, 1.0)
    expect(result.monthlyBenefit.toNumber()).toBeCloseTo(1364.60, 0)
    expect(result.adjustmentFactor.toNumber()).toBe(1)
  })

  it('should reduce benefit for early claiming at 60', () => {
    const result = estimateCppBenefit(60, 39, 1.0)
    // 36% reduction
    expect(result.adjustmentFactor.toNumber()).toBeCloseTo(0.64, 2)
    expect(result.monthlyBenefit.toNumber()).toBeLessThan(1000)
  })

  it('should increase benefit for late claiming at 70', () => {
    const result = estimateCppBenefit(70, 39, 1.0)
    // 42% increase
    expect(result.adjustmentFactor.toNumber()).toBeCloseTo(1.42, 2)
    expect(result.monthlyBenefit.toNumber()).toBeGreaterThan(1364)
  })

  it('should reduce benefit for fewer contribution years', () => {
    const full = estimateCppBenefit(65, 39, 1.0)
    const partial = estimateCppBenefit(65, 20, 1.0)
    expect(partial.monthlyBenefit.toNumber()).toBeLessThan(full.monthlyBenefit.toNumber())
  })

  it('should generate estimates for all ages 60-70', () => {
    const results = estimateCppBenefitAllAges(30, 0.8)
    expect(results).toHaveLength(11)
    // Benefits should increase with later claiming
    for (let i = 1; i < results.length; i++) {
      expect(results[i].monthlyBenefit.toNumber())
        .toBeGreaterThan(results[i - 1].monthlyBenefit.toNumber())
    }
  })
})

describe('OAS Benefit', () => {
  it('should estimate full benefit at 65 with no clawback', () => {
    const result = estimateOasBenefit(65, 50000, 40)
    expect(result.grossMonthlyBenefit.toNumber()).toBeCloseTo(742.31, 0)
    expect(result.clawbackAmount.toNumber()).toBe(0)
    expect(result.netMonthlyBenefit.toNumber()).toBeCloseTo(742.31, 0)
  })

  it('should apply clawback for high income', () => {
    const result = estimateOasBenefit(65, 120000, 40)
    expect(result.clawbackAmount.toNumber()).toBeGreaterThan(0)
    expect(result.netMonthlyBenefit.toNumber()).toBeLessThan(result.grossMonthlyBenefit.toNumber())
  })

  it('should apply deferral bonus at age 70', () => {
    const at65 = estimateOasBenefit(65, 50000, 40)
    const at70 = estimateOasBenefit(70, 50000, 40)
    // 36% bonus at 70
    expect(at70.deferralBonus.toNumber()).toBeCloseTo(0.36, 2)
    expect(at70.grossMonthlyBenefit.toNumber()).toBeGreaterThan(at65.grossMonthlyBenefit.toNumber())
  })

  it('should reduce for partial residence', () => {
    const full = estimateOasBenefit(65, 50000, 40)
    const partial = estimateOasBenefit(65, 50000, 20)
    expect(partial.grossMonthlyBenefit.toNumber()).toBeCloseTo(
      full.grossMonthlyBenefit.toNumber() / 2, 0
    )
  })
})
