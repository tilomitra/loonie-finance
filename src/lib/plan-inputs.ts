import Decimal from 'decimal.js'
import type { Account, Plan } from '@/types'
import { isTaxDeferred } from '@/types'
import type { FireInputs } from '@/engine/fire/coast-fire'

/** Safe Decimal from user text; empty or bad input becomes 0. */
export function dec(value: string | number | undefined): Decimal {
  try {
    const d = new Decimal(value === undefined || value === '' ? 0 : value)
    return d.isFinite() ? d : new Decimal(0)
  } catch {
    return new Decimal(0)
  }
}

export function portfolioTotals(accounts: Account[]) {
  let total = new Decimal(0)
  let taxDeferred = new Decimal(0)
  for (const a of accounts) {
    if (!a.includeInFire) continue
    const b = dec(a.balance)
    total = total.plus(b)
    if (isTaxDeferred(a.type)) taxDeferred = taxDeferred.plus(b)
  }
  const taxDeferredShare = total.gt(0) ? taxDeferred.div(total) : new Decimal(0)
  return { total, taxDeferred, taxDeferredShare }
}

export function toFireInputs(plan: Plan, accounts: Account[]): FireInputs {
  const { total, taxDeferredShare } = portfolioTotals(accounts)
  const currentAge = Math.max(16, Math.min(100, Math.round(plan.currentAge || 0)))
  const retirementAge = Math.max(currentAge, Math.min(100, Math.round(plan.retirementAge || 0)))
  return {
    currentAge,
    retirementAge,
    lifeExpectancy: Math.max(retirementAge + 1, Math.min(110, Math.round(plan.lifeExpectancy || 0))),
    province: plan.province,
    portfolio: total,
    taxDeferredShare,
    annualSpending: dec(plan.annualSpending),
    annualContribution: dec(plan.annualContribution),
    nominalReturn: dec(plan.expectedReturn).div(100),
    inflation: dec(plan.inflation).div(100),
    withdrawalRate: dec(plan.withdrawalRate).div(100),
    includeTax: plan.includeTax,
    cppAt65Monthly: dec(plan.cppAt65Monthly),
    cppStartAge: plan.cppStartAge,
    oasResidenceYears: plan.oasResidenceYears,
    oasStartAge: plan.oasStartAge,
    pensionAnnual: dec(plan.pensionAnnual),
    pensionStartAge: plan.pensionStartAge,
  }
}
