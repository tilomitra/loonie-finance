import Dexie, { type Table } from 'dexie'
import type { Account, BalanceHistory, Scenario, UserProfile, Snapshot } from '@/types'
import { DEFAULT_RETURN_RATES } from '@/engine/projection/account-defaults'
import type { AccountType } from '@/types'

export class LoonieDatabase extends Dexie {
  accounts!: Table<Account, string>
  balanceHistory!: Table<BalanceHistory, string>
  scenarios!: Table<Scenario, string>
  userProfile!: Table<UserProfile, string>
  snapshots!: Table<Snapshot, string>

  constructor() {
    super('loonie-finance')

    this.version(1).stores({
      accounts: 'id, type, createdAt',
      balanceHistory: 'id, accountId, date',
      scenarios: 'id, isDefault',
      userProfile: 'id',
      snapshots: 'id, date',
    })

    // v2: Replace assetAllocation with expectedReturnRate
    this.version(2).stores({
      accounts: 'id, type, createdAt',
      balanceHistory: 'id, accountId, date',
      scenarios: 'id, isDefault',
      userProfile: 'id',
      snapshots: 'id, date',
    }).upgrade(tx => {
      return tx.table('accounts').toCollection().modify(account => {
        const type = account.type as AccountType
        account.expectedReturnRate = DEFAULT_RETURN_RATES[type] ?? '5.0'
        delete (account as Record<string, unknown>).assetAllocation
      })
    })

    // v3: Add lifeEvents table and set owner on existing accounts
    this.version(3).stores({
      accounts: 'id, type, createdAt',
      balanceHistory: 'id, accountId, date',
      scenarios: 'id, isDefault',
      userProfile: 'id',
      snapshots: 'id, date',
      lifeEvents: 'id, type, person, startAge',
    }).upgrade(tx => {
      return tx.table('accounts').toCollection().modify(account => {
        account.owner = 'self'
      })
    })

    // v4: Add monthlyPayment field to accounts
    this.version(4).stores({
      accounts: 'id, type, createdAt',
      balanceHistory: 'id, accountId, date',
      scenarios: 'id, isDefault',
      userProfile: 'id',
      snapshots: 'id, date',
      lifeEvents: 'id, type, person, startAge',
    }).upgrade(tx => {
      return tx.table('accounts').toCollection().modify(account => {
        account.monthlyPayment = null
      })
    })
  }
}

export const db = new LoonieDatabase()
