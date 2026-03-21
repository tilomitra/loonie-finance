import Decimal from 'decimal.js'
import { FEDERAL_TAX_2026 } from '../constants/tax-brackets-2026'
import type { TaxBracket, TaxSystem } from '../constants/tax-brackets-2026'

export function calculateBracketTax(income: Decimal, brackets: TaxBracket[]): Decimal {
  let tax = new Decimal(0)
  for (const bracket of brackets) {
    if (income.lte(bracket.min)) break
    const taxableInBracket = Decimal.min(income, bracket.max === Infinity ? income : new Decimal(bracket.max)).minus(bracket.min)
    tax = tax.plus(taxableInBracket.times(bracket.rate))
  }
  return tax
}

export function calculateBasicPersonalCredit(system: TaxSystem, lowestRate: number): Decimal {
  return new Decimal(system.basicPersonalAmount).times(lowestRate)
}

export function calculateFederalTax(income: Decimal): Decimal {
  const grossTax = calculateBracketTax(income, FEDERAL_TAX_2026.brackets)
  const bpaCredit = calculateBasicPersonalCredit(FEDERAL_TAX_2026, FEDERAL_TAX_2026.brackets[0].rate)
  return Decimal.max(grossTax.minus(bpaCredit), 0)
}
