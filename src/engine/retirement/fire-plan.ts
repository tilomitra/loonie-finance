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
