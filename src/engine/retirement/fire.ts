import Decimal from 'decimal.js'

export type FireType = 'lean' | 'regular' | 'fat' | 'coast' | 'barista'

export interface FireResult {
  type: FireType
  targetNumber: Decimal
  currentNetWorth: Decimal
  progress: Decimal // 0-1
  yearsToFire: number | null // null if already reached
  isAchieved: boolean
}

/**
 * Calculate FIRE number using the safe withdrawal rate (default 4%)
 */
export function calculateFireNumber(
  annualExpenses: Decimal,
  withdrawalRate: Decimal = new Decimal('0.04')
): Decimal {
  return annualExpenses.div(withdrawalRate)
}

/**
 * Calculate Coast FIRE number
 * The amount you need TODAY that will grow to your FIRE number by retirement age
 * with zero additional contributions.
 */
export function calculateCoastFire(
  fireNumber: Decimal,
  yearsToRetirement: number,
  realReturnRate: Decimal = new Decimal('0.07')
): Decimal {
  // coastNumber = fireNumber / (1 + realReturn)^years
  const growthFactor = realReturnRate.plus(1).pow(yearsToRetirement)
  return fireNumber.div(growthFactor)
}

/**
 * Calculate years to FIRE from current state
 */
export function calculateYearsToFire(
  currentNetWorth: Decimal,
  annualSavings: Decimal,
  targetNumber: Decimal,
  realReturnRate: Decimal = new Decimal('0.07')
): number | null {
  if (currentNetWorth.gte(targetNumber)) return 0
  if (annualSavings.lte(0) && currentNetWorth.lt(targetNumber)) return null

  // Iterative calculation: each year, grow existing + add savings
  let worth = currentNetWorth
  for (let year = 1; year <= 100; year++) {
    worth = worth.plus(annualSavings).times(realReturnRate.plus(1))
    if (worth.gte(targetNumber)) return year
  }
  return null // Not achievable within 100 years
}

/**
 * Calculate Barista FIRE: required part-time income to cover expenses
 * while letting investments grow untouched.
 */
export function calculateBaristaFire(
  annualExpenses: Decimal,
  portfolioIncome: Decimal // Expected annual investment income (dividends, etc.)
): Decimal {
  return Decimal.max(annualExpenses.minus(portfolioIncome), 0)
}

/**
 * Calculate all FIRE variants at once
 */
export function calculateAllFireTypes(params: {
  currentNetWorth: Decimal
  annualExpenses: Decimal
  leanExpenses: Decimal // Minimum comfortable expenses
  fatExpenses: Decimal // Aspirational expenses
  annualSavings: Decimal
  yearsToRetirement: number
  portfolioIncome: Decimal
  withdrawalRate?: Decimal
  realReturnRate?: Decimal
}): FireResult[] {
  const {
    currentNetWorth,
    annualExpenses,
    leanExpenses,
    fatExpenses,
    annualSavings,
    yearsToRetirement,
    portfolioIncome,
    withdrawalRate = new Decimal('0.04'),
    realReturnRate = new Decimal('0.07'),
  } = params

  const regularTarget = calculateFireNumber(annualExpenses, withdrawalRate)
  const leanTarget = calculateFireNumber(leanExpenses, withdrawalRate)
  const fatTarget = calculateFireNumber(fatExpenses, withdrawalRate)
  const coastTarget = calculateCoastFire(regularTarget, yearsToRetirement, realReturnRate)
  const baristaIncome = calculateBaristaFire(annualExpenses, portfolioIncome)

  const makeResult = (type: FireType, target: Decimal): FireResult => {
    const progress = target.gt(0) ? Decimal.min(currentNetWorth.div(target), 1) : new Decimal(1)
    const yearsToFire = calculateYearsToFire(currentNetWorth, annualSavings, target, realReturnRate)
    return {
      type,
      targetNumber: target,
      currentNetWorth,
      progress,
      yearsToFire: currentNetWorth.gte(target) ? null : yearsToFire,
      isAchieved: currentNetWorth.gte(target),
    }
  }

  return [
    makeResult('lean', leanTarget),
    makeResult('regular', regularTarget),
    makeResult('fat', fatTarget),
    makeResult('coast', coastTarget),
    { ...makeResult('barista', regularTarget), targetNumber: baristaIncome },
  ]
}
