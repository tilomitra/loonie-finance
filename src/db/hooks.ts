import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './database'
import Decimal from 'decimal.js'
import { isDebtType, type UserProfile } from '@/types'

export function useAccounts() {
  return useLiveQuery(() => db.accounts.orderBy('createdAt').toArray(), []) ?? []
}

export function useAccount(id: string | undefined) {
  return useLiveQuery(
    () => (id ? db.accounts.get(id) : undefined),
    [id]
  )
}

export function useBalanceHistory(accountId: string | undefined) {
  return useLiveQuery(
    () =>
      accountId
        ? db.balanceHistory.where('accountId').equals(accountId).sortBy('date')
        : [],
    [accountId]
  ) ?? []
}

export function useScenarios() {
  return useLiveQuery(() => db.scenarios.toArray(), []) ?? []
}

export function useDefaultScenario() {
  return useLiveQuery(
    () => db.scenarios.where('isDefault').equals(1).first(),
    []
  )
}

export function useUserProfile(): UserProfile | undefined {
  return useLiveQuery(() => db.userProfile.get('singleton'), [])
}

export function useSnapshots() {
  return useLiveQuery(() => db.snapshots.orderBy('date').toArray(), []) ?? []
}

export function useNetWorth() {
  const accounts = useAccounts()

  const totalAssets = accounts
    .filter(a => !isDebtType(a.type))
    .reduce((sum, a) => sum.plus(new Decimal(a.balance || '0')), new Decimal(0))

  const totalDebts = accounts
    .filter(a => isDebtType(a.type))
    .reduce((sum, a) => sum.plus(new Decimal(a.balance || '0')), new Decimal(0))

  const netWorth = totalAssets.minus(totalDebts)

  return { netWorth, totalAssets, totalDebts }
}
