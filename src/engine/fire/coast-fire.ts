import Decimal from 'decimal.js'
import type { Province } from '@/types'
import { calculateFederalTax } from '../tax/federal-tax'
import { calculateProvincialTax } from '../tax/provincial-tax'
import { CPP_2026 } from '../constants/cpp'
import { estimateOasBenefit } from '../retirement/oas-benefit'

/**
 * Canadian FIRE and Coast FIRE engine.
 *
 * All money is in today's dollars. Growth uses the real return
 * (nominal return less inflation), so no inflation step is necessary.
 * Tax brackets are indexed to inflation, so 2026 brackets apply to all years.
 */
export interface FireInputs {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  province: Province
  /** Current invested portfolio, CAD. */
  portfolio: Decimal
  /** Part of the portfolio in RRSP/RRIF/LIRA/pension (0-1). Withdrawals from these are taxed. */
  taxDeferredShare: Decimal
  /** After-tax yearly spending in retirement. */
  annualSpending: Decimal
  /** Yearly contribution while working. */
  annualContribution: Decimal
  /** Nominal return as a fraction (0.06 = 6%). */
  nominalReturn: Decimal
  /** Inflation as a fraction. */
  inflation: Decimal
  /** Safe withdrawal rate as a fraction. */
  withdrawalRate: Decimal
  includeTax: boolean
  cppAt65Monthly: Decimal
  cppStartAge: number
  oasResidenceYears: number
  oasStartAge: number
  pensionAnnual: Decimal
  pensionStartAge: number
}

export interface ProjectionRow {
  age: number
  /** Balance at the start of the year if you keep contributing until retirement. */
  keepSaving: Decimal
  /** Balance at the start of the year if you stop all contributions now. */
  coastNow: Decimal
  /** FIRE number needed if you retire at this age. */
  fireTarget: Decimal
  /** Government benefits and pension received at this age. */
  guaranteedIncome: Decimal
  /** Portfolio withdrawal needed at this age once retired. */
  withdrawal: Decimal
}

export interface FireResult {
  realReturn: Decimal
  /** Portfolio needed at the retirement age. */
  fireNumber: Decimal
  /** Amount needed today to coast to the FIRE number with no more contributions. */
  coastNumber: Decimal
  /** Part of the FIRE number that pays for the years before CPP/OAS/pension start. */
  bridgeAmount: Decimal
  isCoastFire: boolean
  /** You could retire today. */
  isFire: boolean
  /** Coast progress: portfolio / coast number, capped at 1. */
  coastProgress: Decimal
  /** First age at which you can stop contributing. Null if not reachable by the retirement age. */
  coastAge: number | null
  /** First age at which you can retire fully (saving until then). Null if not reachable. */
  fireAge: number | null
  /** Yearly benefits once all start (CPP + OAS + pension). */
  fullGuaranteedIncome: Decimal
  cppAnnual: Decimal
  oasAnnual: Decimal
  /** Yearly portfolio withdrawal once all benefits start. */
  longTermWithdrawal: Decimal
  /** Pre-tax work income that covers your spending while you coast. */
  coastWorkIncome: Decimal
  /** Age the money runs out in each scenario. Null if it lasts to life expectancy. */
  depletionAgeKeepSaving: number | null
  depletionAgeCoastNow: number | null
  projection: ProjectionRow[]
}

const ZERO = new Decimal(0)

export function realReturn(nominal: Decimal, inflation: Decimal): Decimal {
  return nominal.plus(1).div(inflation.plus(1)).minus(1)
}

function growth(rate: Decimal, years: number): Decimal {
  return rate.plus(1).pow(years)
}

/** Yearly CPP for a claim age, from the estimate at 65. */
export function cppAnnual(at65Monthly: Decimal, startAge: number): Decimal {
  const age = Math.min(70, Math.max(60, startAge))
  const months = (age - 65) * 12
  const factor = months < 0
    ? new Decimal(1).plus(new Decimal(CPP_2026.earlyReductionPerMonth).times(months))
    : new Decimal(1).plus(new Decimal(CPP_2026.lateIncreasePerMonth).times(months))
  return at65Monthly.times(12).times(factor)
}

/** Yearly OAS at a given age (no clawback; spending-based plans rarely reach it). */
export function oasAnnualAt(age: number, startAge: number, residenceYears: number): Decimal {
  if (age < startAge || residenceYears < 10) return ZERO
  const claim = Math.min(70, Math.max(65, startAge))
  return estimateOasBenefit(claim, 0, residenceYears, age).netAnnualBenefit
}

export function guaranteedIncomeAt(age: number, inp: FireInputs): Decimal {
  let income = ZERO
  if (age >= inp.cppStartAge) income = income.plus(cppAnnual(inp.cppAt65Monthly, inp.cppStartAge))
  income = income.plus(oasAnnualAt(age, inp.oasStartAge, inp.oasResidenceYears))
  if (age >= inp.pensionStartAge) income = income.plus(inp.pensionAnnual)
  return income
}

export function incomeTax(income: Decimal, province: Province): Decimal {
  if (income.lte(0)) return ZERO
  return calculateFederalTax(income).plus(calculateProvincialTax(income, province))
}

/**
 * Portfolio withdrawal W that covers net spending:
 *   W + benefits - tax(benefits + W * taxDeferredShare) = spending
 * Benefits are fully taxable. TFSA and non-registered withdrawals are treated as tax-free
 * (capital gains on non-registered money are ignored).
 */
export function withdrawalNeeded(
  spending: Decimal,
  benefits: Decimal,
  taxDeferredShare: Decimal,
  province: Province,
  includeTax: boolean,
): Decimal {
  if (!includeTax) return Decimal.max(spending.minus(benefits), 0)
  const net = (w: Decimal) => w.plus(benefits).minus(incomeTax(benefits.plus(w.times(taxDeferredShare)), province))
  if (net(ZERO).gte(spending)) return ZERO
  let lo = ZERO
  let hi = spending.times(3).plus(1000)
  for (let i = 0; i < 40; i++) {
    const mid = lo.plus(hi).div(2)
    if (net(mid).lt(spending)) lo = mid
    else hi = mid
  }
  return hi
}

/** Pre-tax employment income whose after-tax value equals the spending. */
export function grossIncomeFor(spending: Decimal, province: Province, includeTax: boolean): Decimal {
  return withdrawalNeeded(spending, ZERO, new Decimal(1), province, includeTax)
}

function withdrawalAt(age: number, inp: FireInputs): Decimal {
  return withdrawalNeeded(inp.annualSpending, guaranteedIncomeAt(age, inp), inp.taxDeferredShare, inp.province, inp.includeTax)
}

/** The age at which all benefits have started and income stops changing (except OAS at 75). */
function benefitsSteadyAge(inp: FireInputs, retireAge: number): number {
  const starts = [inp.cppStartAge, inp.oasStartAge]
  if (inp.pensionAnnual.gt(0)) starts.push(inp.pensionStartAge)
  return Math.max(retireAge, ...starts)
}

/**
 * Portfolio needed to retire at `retireAge`.
 * = long-term withdrawal / SWR + present value of the extra withdrawals in the bridge
 *   years before CPP, OAS and pension start.
 */
export function fireNumberAt(retireAge: number, inp: FireInputs, r: Decimal): { total: Decimal; bridge: Decimal; longTerm: Decimal } {
  const steady = benefitsSteadyAge(inp, retireAge)
  const longTerm = withdrawalAt(steady, inp)
  let bridge = ZERO
  for (let age = retireAge; age < steady; age++) {
    const extra = withdrawalAt(age, inp).minus(longTerm)
    if (extra.gt(0)) bridge = bridge.plus(extra.div(growth(r, age - retireAge)))
  }
  const total = inp.withdrawalRate.gt(0) ? longTerm.div(inp.withdrawalRate).plus(bridge) : bridge
  return { total, bridge, longTerm }
}

export function calculateFire(inp: FireInputs): FireResult {
  const r = realReturn(inp.nominalReturn, inp.inflation)
  const retireAge = Math.max(inp.retirementAge, inp.currentAge)
  const horizon = Math.max(inp.lifeExpectancy, retireAge + 1)

  const target = fireNumberAt(retireAge, inp, r)
  const coastNumber = target.total.div(growth(r, retireAge - inp.currentAge))

  // Year-by-year projection. Contributions arrive at year end; withdrawals at year start.
  const projection: ProjectionRow[] = []
  let keep = inp.portfolio
  let coast = inp.portfolio
  let depletionKeep: number | null = null
  let depletionCoast: number | null = null
  const targetCache = new Map<number, Decimal>()
  const targetFor = (age: number) => {
    if (!targetCache.has(age)) targetCache.set(age, fireNumberAt(age, inp, r).total)
    return targetCache.get(age)!
  }

  for (let age = inp.currentAge; age <= horizon; age++) {
    const retired = age >= retireAge
    const income = guaranteedIncomeAt(age, inp)
    const withdrawal = retired ? withdrawalAt(age, inp) : ZERO
    projection.push({
      age,
      keepSaving: Decimal.max(keep, 0),
      coastNow: Decimal.max(coast, 0),
      fireTarget: age <= retireAge ? targetFor(age) : ZERO,
      guaranteedIncome: income,
      withdrawal,
    })
    if (retired) {
      keep = keep.minus(withdrawal).times(r.plus(1))
      coast = coast.minus(withdrawal).times(r.plus(1))
      if (keep.lt(0) && depletionKeep === null) depletionKeep = age
      if (coast.lt(0) && depletionCoast === null) depletionCoast = age
    } else {
      keep = keep.times(r.plus(1)).plus(inp.annualContribution)
      coast = coast.times(r.plus(1))
    }
  }

  // Coast age: first age A where saving until A, then coasting, reaches the target at retirement.
  let coastAge: number | null = null
  let fireAge: number | null = null
  let bal = inp.portfolio
  for (let age = inp.currentAge; age <= Math.max(horizon, 100); age++) {
    if (coastAge === null && age <= retireAge && bal.times(growth(r, retireAge - age)).gte(target.total)) {
      coastAge = age
    }
    if (fireAge === null && bal.gte(targetFor(age))) fireAge = age
    if (fireAge !== null && (coastAge !== null || age >= retireAge)) break
    bal = bal.times(r.plus(1)).plus(inp.annualContribution)
  }

  const steady = benefitsSteadyAge(inp, retireAge)
  const cpp = cppAnnual(inp.cppAt65Monthly, inp.cppStartAge)
  const oas = oasAnnualAt(Math.max(inp.oasStartAge, 65), inp.oasStartAge, inp.oasResidenceYears)

  return {
    realReturn: r,
    fireNumber: target.total,
    coastNumber,
    bridgeAmount: target.bridge,
    isCoastFire: inp.portfolio.gte(coastNumber),
    isFire: fireAge === inp.currentAge,
    coastProgress: coastNumber.gt(0) ? Decimal.min(inp.portfolio.div(coastNumber), 1) : new Decimal(1),
    coastAge,
    fireAge,
    fullGuaranteedIncome: guaranteedIncomeAt(steady, inp),
    cppAnnual: cpp,
    oasAnnual: oas,
    longTermWithdrawal: target.longTerm,
    coastWorkIncome: grossIncomeFor(inp.annualSpending, inp.province, inp.includeTax),
    depletionAgeKeepSaving: depletionKeep,
    depletionAgeCoastNow: depletionCoast,
    projection,
  }
}
