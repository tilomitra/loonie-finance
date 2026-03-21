import Decimal from 'decimal.js'
import { PROVINCIAL_TAX_2026 } from '../constants/tax-brackets-2026'
import { calculateBracketTax, calculateBasicPersonalCredit } from './federal-tax'
import type { Province } from '@/types'

export function calculateProvincialTax(income: Decimal, province: Province): Decimal {
  const system = PROVINCIAL_TAX_2026[province]
  if (!system) throw new Error(`Unknown province: ${province}`)

  const grossTax = calculateBracketTax(income, system.brackets)
  const bpaCredit = calculateBasicPersonalCredit(system, system.brackets[0].rate)
  return Decimal.max(grossTax.minus(bpaCredit), 0)
}
