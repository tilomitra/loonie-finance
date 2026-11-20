import Dexie, { type Table } from 'dexie'
import type { Account, Plan } from '@/types'

export class LoonieDatabase extends Dexie {
  accounts!: Table<Account, string>
  plan!: Table<Plan, string>

  constructor() {
    // New database name: the FIRE calculator does not reuse the old net-worth schema.
    super('loonie-fire')
    this.version(1).stores({
      accounts: 'id, importKey, institution, type',
      plan: 'id',
    })
  }
}

export const db = new LoonieDatabase()

export const DEFAULT_PLAN: Plan = {
  id: 'singleton',
  currentAge: 30,
  retirementAge: 60,
  lifeExpectancy: 95,
  province: 'ON',
  annualSpending: '50000',
  annualContribution: '15000',
  expectedReturn: '6',
  inflation: '2.5',
  withdrawalRate: '4',
  includeTax: true,
  cppAt65Monthly: '900',
  cppStartAge: 65,
  oasResidenceYears: 40,
  oasStartAge: 65,
  pensionAnnual: '0',
  pensionStartAge: 65,
  updatedAt: 0,
}
