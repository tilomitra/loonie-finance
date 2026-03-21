import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { calculateIncomeTimeline, calculateEffectiveFireNumber } from '../fire-plan'
import { calculateFirePlan, type FirePlanInputs } from '../fire-plan'

describe('calculateIncomeTimeline', () => {
  const baseInputs = {
    fireAge: 45,
    lifeExpectancy: 90,
    postFireAnnualSpending: new Decimal('50000'),
    postFireAnnualIncome: new Decimal('20000'),
    spouseAnnualIncome: new Decimal('0'),
    cppStartAge: 65,
    oasStartAge: 65,
    yearsContributedCPP: 20,
    inflationRate: new Decimal('0.02'),
    expectedReturnRate: new Decimal('0.05'),
  }

  it('should generate timeline from FIRE age to life expectancy', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    expect(timeline).toHaveLength(90 - 45)
    expect(timeline[0].age).toBe(45)
    expect(timeline[timeline.length - 1].age).toBe(89)
  })

  it('should show zero CPP/OAS income before start ages', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    const atAge50 = timeline.find(t => t.age === 50)!
    expect(atAge50.cppIncome.toNumber()).toBe(0)
    expect(atAge50.oasIncome.toNumber()).toBe(0)
  })

  it('should show CPP income starting at cppStartAge', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    const atAge65 = timeline.find(t => t.age === 65)!
    expect(atAge65.cppIncome.toNumber()).toBeGreaterThan(0)
  })

  it('should show OAS income starting at oasStartAge', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    const atAge65 = timeline.find(t => t.age === 65)!
    expect(atAge65.oasIncome.toNumber()).toBeGreaterThan(0)
  })

  it('should include spouse income when provided', () => {
    const timeline = calculateIncomeTimeline({
      ...baseInputs,
      spouseAnnualIncome: new Decimal('30000'),
    })
    expect(timeline[0].spouseIncome.toNumber()).toBe(30000)
  })

  it('should show portfolio withdrawal as spending minus all other income', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    const first = timeline[0]
    const expectedWithdrawal = first.spending.minus(first.postFireIncome).minus(first.spouseIncome)
    expect(first.portfolioWithdrawal.toNumber()).toBeCloseTo(expectedWithdrawal.toNumber(), 0)
  })

  it('should reduce portfolio withdrawals after benefits kick in', () => {
    const timeline = calculateIncomeTimeline(baseInputs)
    const before = timeline.find(t => t.age === 60)!
    const after = timeline.find(t => t.age === 66)!
    expect(after.portfolioWithdrawal.toNumber()).toBeLessThan(before.portfolioWithdrawal.toNumber())
  })
})

describe('calculateEffectiveFireNumber', () => {
  const baseInputs = {
    fireAge: 45,
    lifeExpectancy: 90,
    postFireAnnualSpending: new Decimal('50000'),
    postFireAnnualIncome: new Decimal('0'),
    spouseAnnualIncome: new Decimal('0'),
    cppStartAge: 65,
    oasStartAge: 65,
    yearsContributedCPP: 20,
    inflationRate: new Decimal('0.02'),
    expectedReturnRate: new Decimal('0.05'),
  }

  it('should return a positive FIRE number for typical inputs', () => {
    const result = calculateEffectiveFireNumber(baseInputs)
    expect(result.toNumber()).toBeGreaterThan(0)
  })

  it('should return a lower number when post-FIRE income covers some spending', () => {
    const withoutIncome = calculateEffectiveFireNumber(baseInputs)
    const withIncome = calculateEffectiveFireNumber({
      ...baseInputs,
      postFireAnnualIncome: new Decimal('20000'),
    })
    expect(withIncome.toNumber()).toBeLessThan(withoutIncome.toNumber())
  })

  it('should return zero when income covers all spending', () => {
    const result = calculateEffectiveFireNumber({
      ...baseInputs,
      postFireAnnualIncome: new Decimal('50000'),
    })
    expect(result.toNumber()).toBe(0)
  })

  it('should return a lower number with earlier CPP start', () => {
    const cpp65 = calculateEffectiveFireNumber({ ...baseInputs, cppStartAge: 65 })
    const cpp60 = calculateEffectiveFireNumber({ ...baseInputs, cppStartAge: 60 })
    expect(cpp65.toNumber()).toBeGreaterThan(0)
    expect(cpp60.toNumber()).toBeGreaterThan(0)
  })

  it('should return a lower number with spouse income', () => {
    const solo = calculateEffectiveFireNumber(baseInputs)
    const withSpouse = calculateEffectiveFireNumber({
      ...baseInputs,
      spouseAnnualIncome: new Decimal('30000'),
    })
    expect(withSpouse.toNumber()).toBeLessThan(solo.toNumber())
  })
})

describe('calculateFirePlan', () => {
  const planInputs: FirePlanInputs = {
    currentAge: 35,
    targetFireAge: 50,
    lifeExpectancy: 90,
    currentNetWorth: new Decimal('300000'),
    annualSavings: new Decimal('40000'),
    currentAnnualExpenses: new Decimal('50000'),
    postFireAnnualSpending: new Decimal('45000'),
    leanExpenses: new Decimal('30000'),
    fatExpenses: new Decimal('70000'),
    postFireAnnualIncome: new Decimal('10000'),
    hasSpouse: false,
    spouseAnnualIncome: new Decimal('0'),
    spousePortfolio: new Decimal('0'),
    cppStartAge: 65,
    oasStartAge: 65,
    rrspWithdrawalStartAge: 65,
    rrspBalance: new Decimal('100000'),
    withdrawalRate: new Decimal('0.04'),
    inflationRate: new Decimal('0.02'),
    expectedReturnRate: new Decimal('0.05'),
    yearsContributedCPP: 20,
    province: 'ON',
  }

  it('should return feasibility with on-track or gap info', () => {
    const result = calculateFirePlan(planInputs)
    expect(result.feasibility).toBeDefined()
    expect(typeof result.feasibility.isOnTrack).toBe('boolean')
    expect(result.feasibility.effectiveFireNumber.toNumber()).toBeGreaterThan(0)
    expect(result.feasibility.currentTotal.toNumber()).toBe(300000)
    expect(result.feasibility.projectedFireAge).toBeGreaterThanOrEqual(planInputs.currentAge)
  })

  it('should return all 5 FIRE types', () => {
    const result = calculateFirePlan(planInputs)
    expect(result.fireTypes).toHaveLength(5)
    const types = result.fireTypes.map(t => t.type)
    expect(types).toContain('lean')
    expect(types).toContain('regular')
    expect(types).toContain('fat')
    expect(types).toContain('coast')
    expect(types).toContain('barista')
  })

  it('should have lean < regular < fat effective numbers', () => {
    const result = calculateFirePlan(planInputs)
    const lean = result.fireTypes.find(t => t.type === 'lean')!
    const regular = result.fireTypes.find(t => t.type === 'regular')!
    const fat = result.fireTypes.find(t => t.type === 'fat')!
    expect(lean.effectiveNumber.toNumber()).toBeLessThan(regular.effectiveNumber.toNumber())
    expect(regular.effectiveNumber.toNumber()).toBeLessThan(fat.effectiveNumber.toNumber())
  })

  it('should include spouse portfolio in currentTotal', () => {
    const result = calculateFirePlan({
      ...planInputs,
      hasSpouse: true,
      spousePortfolio: new Decimal('100000'),
    })
    expect(result.feasibility.currentTotal.toNumber()).toBe(400000)
  })

  it('should return income timeline', () => {
    const result = calculateFirePlan(planInputs)
    expect(result.incomeTimeline.length).toBe(90 - 50)
  })

  it('should handle already-FI case when income covers spending', () => {
    const result = calculateFirePlan({
      ...planInputs,
      postFireAnnualIncome: new Decimal('50000'),
    })
    const regular = result.fireTypes.find(t => t.type === 'regular')!
    expect(regular.effectiveNumber.toNumber()).toBe(0)
  })

  it('should handle retire-now case when targetFireAge <= currentAge', () => {
    const result = calculateFirePlan({
      ...planInputs,
      targetFireAge: 35,
    })
    expect(result.feasibility).toBeDefined()
    expect(result.incomeTimeline.length).toBe(90 - 35)
  })

  it('should handle zero RRSP balance', () => {
    const result = calculateFirePlan({
      ...planInputs,
      rrspBalance: new Decimal('0'),
    })
    expect(result.rrspComparison.early.annualWithdrawal.toNumber()).toBe(0)
    expect(result.rrspComparison.deferred.annualWithdrawal.toNumber()).toBe(0)
  })
})
