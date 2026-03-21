import Decimal from 'decimal.js'
import { calculateFederalTax } from './federal-tax'
import { calculateProvincialTax } from './provincial-tax'
import type { Province } from '@/types'

export interface TaxResult {
  federalTax: Decimal
  provincialTax: Decimal
  totalTax: Decimal
  effectiveRate: Decimal
  marginalRate: Decimal
}

export function calculateTotalTax(income: Decimal, province: Province): TaxResult {
  const federalTax = calculateFederalTax(income)
  const provincialTax = calculateProvincialTax(income, province)
  const totalTax = federalTax.plus(provincialTax)
  const effectiveRate = income.gt(0) ? totalTax.div(income) : new Decimal(0)

  // Calculate marginal rate by checking tax on $1 more
  const taxOnOneDollarMore = calculateFederalTax(income.plus(1)).plus(
    calculateProvincialTax(income.plus(1), province)
  )
  const marginalRate = taxOnOneDollarMore.minus(totalTax)

  return { federalTax, provincialTax, totalTax, effectiveRate, marginalRate }
}
