import Decimal from 'decimal.js'
import { estimateCppBenefit } from './cpp-benefit'
import { estimateOasBenefit } from './oas-benefit'
import { calculateYearsToFire, type FireType } from './fire'
import { calculateTotalTax } from '../tax/calculate-tax'
import { compoundGrowth } from '../projection/compound'
import type { Province } from '@/types'

export interface IncomeTimelineInputs {
  fireAge: number
  lifeExpectancy: number
  postFireAnnualSpending: Decimal
  postFireAnnualIncome: Decimal
  spouseAnnualIncome: Decimal
  cppStartAge: number
  oasStartAge: number
  yearsContributedCPP: number
  inflationRate: Decimal
  expectedReturnRate: Decimal // nominal
}

export interface TimelineYear {
  age: number
  spending: Decimal
  postFireIncome: Decimal
  spouseIncome: Decimal
  cppIncome: Decimal
  oasIncome: Decimal
  portfolioWithdrawal: Decimal
  totalIncome: Decimal
}

export function calculateIncomeTimeline(inputs: IncomeTimelineInputs): TimelineYear[] {
  const {
    fireAge, lifeExpectancy, postFireAnnualSpending, postFireAnnualIncome,
    spouseAnnualIncome, cppStartAge, oasStartAge, yearsContributedCPP,
  } = inputs

  const timeline: TimelineYear[] = []

  // Pre-compute benefit amounts (same for every year at a given start age)
  const cppAtStartAge = estimateCppBenefit(cppStartAge, yearsContributedCPP, 0.75)
  // OAS clawback uses post-FIRE spending as a proxy for retirement income.
  // This is a simplification — actual clawback depends on taxable income.
  const oasAtStartAge = estimateOasBenefit(oasStartAge, postFireAnnualSpending.toNumber(), 40)

  for (let age = fireAge; age < lifeExpectancy; age++) {
    const spending = postFireAnnualSpending
    const postFireIncome = postFireAnnualIncome
    const spouseIncome = spouseAnnualIncome

    const cppIncome = age >= cppStartAge ? cppAtStartAge.annualBenefit : new Decimal(0)

    let oasIncome = new Decimal(0)
    if (age >= oasStartAge) {
      if (age >= 75 && oasStartAge < 75) {
        const oas75 = estimateOasBenefit(oasStartAge, postFireAnnualSpending.toNumber(), 40, age)
        oasIncome = oas75.netAnnualBenefit
      } else {
        oasIncome = oasAtStartAge.netAnnualBenefit
      }
    }

    const nonPortfolioIncome = postFireIncome.plus(spouseIncome).plus(cppIncome).plus(oasIncome)
    const portfolioWithdrawal = Decimal.max(spending.minus(nonPortfolioIncome), 0)

    timeline.push({
      age,
      spending,
      postFireIncome,
      spouseIncome,
      cppIncome,
      oasIncome,
      portfolioWithdrawal,
      totalIncome: nonPortfolioIncome.plus(portfolioWithdrawal),
    })
  }

  return timeline
}

/**
 * Calculate the initial portfolio at FIRE age needed to sustain withdrawals
 * through retirement without depletion. Uses binary search over the timeline.
 *
 * Works in real (inflation-adjusted) terms:
 * - realReturn = expectedReturnRate - inflationRate
 * - All spending and income in today's dollars
 */
export function calculateEffectiveFireNumber(inputs: IncomeTimelineInputs): Decimal {
  const timeline = calculateIncomeTimeline(inputs)
  const realReturn = inputs.expectedReturnRate.minus(inputs.inflationRate)

  // If no withdrawals needed at all
  if (timeline.every(y => y.portfolioWithdrawal.lte(0))) {
    return new Decimal(0)
  }

  // Binary search for the minimum starting portfolio
  // Upper bound: total spending * 3 handles negative real returns safely
  let lo = new Decimal(0)
  let hi = inputs.postFireAnnualSpending.times(inputs.lifeExpectancy - inputs.fireAge).times(3)

  for (let i = 0; i < 100; i++) {
    const mid = lo.plus(hi).div(2)
    if (portfolioSurvives(mid, timeline, realReturn)) {
      hi = mid
    } else {
      lo = mid
    }
    if (hi.minus(lo).lt(100)) break // within $100
  }

  return hi.toDecimalPlaces(0)
}

function portfolioSurvives(
  startingPortfolio: Decimal,
  timeline: TimelineYear[],
  realReturn: Decimal
): boolean {
  let portfolio = startingPortfolio
  for (const year of timeline) {
    portfolio = portfolio.times(realReturn.plus(1)).minus(year.portfolioWithdrawal)
    if (portfolio.lt(0)) return false
  }
  return true
}

export interface FirePlanInputs {
  currentAge: number
  targetFireAge: number
  lifeExpectancy: number
  currentNetWorth: Decimal
  annualSavings: Decimal
  currentAnnualExpenses: Decimal
  postFireAnnualSpending: Decimal
  leanExpenses: Decimal
  fatExpenses: Decimal
  postFireAnnualIncome: Decimal
  hasSpouse: boolean
  spouseAnnualIncome: Decimal
  spousePortfolio: Decimal
  cppStartAge: number
  oasStartAge: number
  rrspWithdrawalStartAge: number
  rrspBalance: Decimal
  withdrawalRate: Decimal
  inflationRate: Decimal
  expectedReturnRate: Decimal
  yearsContributedCPP: number
  province: Province
}

export interface FireTypeResult {
  type: FireType
  effectiveNumber: Decimal
  yearsToFire: number | null
  progress: number
}

export interface FirePlanResult {
  feasibility: {
    isOnTrack: boolean
    effectiveFireNumber: Decimal
    currentTotal: Decimal
    gap: Decimal
    projectedFireAge: number
  }
  fireTypes: FireTypeResult[]
  incomeTimeline: TimelineYear[]
  rrspComparison: RrspComparison
  benefitRecommendation: BenefitRecommendation
}

export interface RrspStrategyResult {
  startAge: number
  balanceAtStart: Decimal
  annualWithdrawal: Decimal
  marginalTaxRate: Decimal
  totalAfterTaxIncome: Decimal
  portfolioLongevityImpactYears: number
}

export interface RrspComparison {
  early: RrspStrategyResult
  deferred: RrspStrategyResult
  recommendEarly: boolean
  oasClawbackWarning: boolean
}

export interface BenefitRecommendation {
  recommendedCppAge: number
  recommendedOasAge: number
  reasoning: string
  cppBreakEvenAge: number
  monthlyAtRecommended: Decimal
  monthlyAt65: Decimal
}

// Stub — replaced in Task 4
export function calculateRrspComparison(inputs: FirePlanInputs): RrspComparison {
  const zero = new Decimal(0)
  const stub: RrspStrategyResult = {
    startAge: inputs.rrspWithdrawalStartAge, balanceAtStart: zero, annualWithdrawal: zero,
    marginalTaxRate: zero, totalAfterTaxIncome: zero, portfolioLongevityImpactYears: 0,
  }
  return { early: stub, deferred: { ...stub, startAge: 71 }, recommendEarly: false, oasClawbackWarning: false }
}

// Stub — replaced in Task 5
export function calculateBenefitRecommendation(inputs: FirePlanInputs): BenefitRecommendation {
  return {
    recommendedCppAge: 65, recommendedOasAge: 65, reasoning: '',
    cppBreakEvenAge: 80, monthlyAtRecommended: new Decimal(0), monthlyAt65: new Decimal(0),
  }
}

export function calculateFirePlan(inputs: FirePlanInputs): FirePlanResult {
  const currentTotal = inputs.currentNetWorth.plus(
    inputs.hasSpouse ? inputs.spousePortfolio : 0
  )
  const realReturn = inputs.expectedReturnRate.minus(inputs.inflationRate)
  const spouseIncome = inputs.hasSpouse ? inputs.spouseAnnualIncome : new Decimal(0)

  const makeTimelineInputs = (spending: Decimal): IncomeTimelineInputs => ({
    fireAge: inputs.targetFireAge,
    lifeExpectancy: inputs.lifeExpectancy,
    postFireAnnualSpending: spending,
    postFireAnnualIncome: inputs.postFireAnnualIncome,
    spouseAnnualIncome: spouseIncome,
    cppStartAge: inputs.cppStartAge,
    oasStartAge: inputs.oasStartAge,
    yearsContributedCPP: inputs.yearsContributedCPP,
    inflationRate: inputs.inflationRate,
    expectedReturnRate: inputs.expectedReturnRate,
  })

  const regularNumber = calculateEffectiveFireNumber(makeTimelineInputs(inputs.postFireAnnualSpending))
  const leanNumber = calculateEffectiveFireNumber(makeTimelineInputs(inputs.leanExpenses))
  const fatNumber = calculateEffectiveFireNumber(makeTimelineInputs(inputs.fatExpenses))

  const yearsToFire = inputs.targetFireAge - inputs.currentAge
  const coastNumber = yearsToFire > 0
    ? regularNumber.div(realReturn.plus(1).pow(yearsToFire))
    : regularNumber

  const regularTimeline = calculateIncomeTimeline(makeTimelineInputs(inputs.postFireAnnualSpending))
  const baristaIncome = regularTimeline.reduce(
    (max, year) => Decimal.max(max, year.portfolioWithdrawal),
    new Decimal(0)
  )

  const makeFireType = (type: FireType, effectiveNumber: Decimal): FireTypeResult => {
    const progress = effectiveNumber.gt(0)
      ? Math.min(currentTotal.div(effectiveNumber).toNumber(), 1)
      : 1
    const years = effectiveNumber.gt(0)
      ? calculateYearsToFire(currentTotal, inputs.annualSavings, effectiveNumber, realReturn)
      : 0
    return { type, effectiveNumber, yearsToFire: years, progress }
  }

  const fireTypes: FireTypeResult[] = [
    makeFireType('lean', leanNumber),
    makeFireType('regular', regularNumber),
    makeFireType('fat', fatNumber),
    makeFireType('coast', coastNumber),
    { type: 'barista', effectiveNumber: baristaIncome, yearsToFire: null, progress: 0 },
  ]

  const regularType = fireTypes.find(t => t.type === 'regular')!
  const projectedFireAge = regularType.yearsToFire !== null
    ? inputs.currentAge + regularType.yearsToFire
    : inputs.currentAge + 100
  const gap = Decimal.max(regularNumber.minus(currentTotal), 0)

  const rrspComparison = calculateRrspComparison(inputs)
  const benefitRecommendation = calculateBenefitRecommendation(inputs)

  return {
    feasibility: {
      isOnTrack: projectedFireAge <= inputs.targetFireAge,
      effectiveFireNumber: regularNumber,
      currentTotal,
      gap,
      projectedFireAge: Math.min(projectedFireAge, inputs.currentAge + 100),
    },
    fireTypes,
    incomeTimeline: regularTimeline,
    rrspComparison,
    benefitRecommendation,
  }
}
