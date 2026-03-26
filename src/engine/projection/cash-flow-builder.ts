import Decimal from 'decimal.js'
import type { LifeEvent } from '@/types'

export interface AnnualCashFlow {
  age: number
  partnerAge?: number
  incomeStreams: Decimal       // sum of active income events (annualized)
  expenseStreams: Decimal      // sum of active expense events (annualized)
  oneTimeInflows: Decimal      // one-time events treated as inflows
  oneTimeOutflows: Decimal     // always zero (current type system cannot distinguish)
  netCashFlow: Decimal         // income - expenses + oneTimeInflows - oneTimeOutflows
}

export function buildAnnualCashFlows(
  lifeEvents: LifeEvent[],
  selfAge: number,
  partnerAge: number | undefined,
  yearsToProject: number
): Map<number, AnnualCashFlow> {
  const result = new Map<number, AnnualCashFlow>()

  for (let yearOffset = 0; yearOffset <= yearsToProject; yearOffset++) {
    const age = selfAge + yearOffset
    const pAge = partnerAge !== undefined ? partnerAge + yearOffset : undefined

    let incomeStreams = new Decimal(0)
    let expenseStreams = new Decimal(0)
    let oneTimeInflows = new Decimal(0)
    const oneTimeOutflows = new Decimal(0)

    for (const event of lifeEvents) {
      // Determine the relevant age for this event
      let relevantAge: number | undefined
      if (event.person === 'self' || event.person === 'joint') {
        relevantAge = age
      } else if (event.person === 'partner') {
        // Skip partner events when there is no partner
        if (pAge === undefined) continue
        relevantAge = pAge
      }

      if (relevantAge === undefined) continue

      if (event.type === 'income' || event.type === 'expense') {
        // Stream event: active when relevantAge >= startAge and < endAge (or no endAge)
        const isActive =
          relevantAge >= event.startAge &&
          (event.endAge === undefined || relevantAge < event.endAge)

        if (isActive) {
          const annualAmount = new Decimal(event.amount).times(12)
          if (event.type === 'income') {
            incomeStreams = incomeStreams.plus(annualAmount)
          } else {
            expenseStreams = expenseStreams.plus(annualAmount)
          }
        }
      } else if (event.type === 'one-time') {
        // One-time event: triggers exactly at startAge
        if (relevantAge === event.startAge) {
          oneTimeInflows = oneTimeInflows.plus(new Decimal(event.amount))
        }
      }
    }

    const netCashFlow = incomeStreams
      .minus(expenseStreams)
      .plus(oneTimeInflows)
      .minus(oneTimeOutflows)

    result.set(yearOffset, {
      age,
      partnerAge: pAge,
      incomeStreams,
      expenseStreams,
      oneTimeInflows,
      oneTimeOutflows,
      netCashFlow,
    })
  }

  return result
}
