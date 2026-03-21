import Decimal from 'decimal.js'
import { estimateCppBenefit } from './cpp-benefit'
import { estimateOasBenefit } from './oas-benefit'

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
