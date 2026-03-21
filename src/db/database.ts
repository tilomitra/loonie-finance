import Dexie, { type Table } from 'dexie'
import type { Account, BalanceHistory, Scenario, UserProfile, Snapshot } from '@/types'

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
  }
}

export const db = new LoonieDatabase()
