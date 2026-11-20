import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_PLAN } from './database'
import type { Account, Plan } from '@/types'

export function useAccounts(): Account[] | undefined {
  return useLiveQuery(() => db.accounts.orderBy('institution').toArray(), [])
}

/** Returns undefined while loading, then the saved plan or the defaults. */
export function usePlan(): Plan | undefined {
  return useLiveQuery(async () => (await db.plan.get('singleton')) ?? DEFAULT_PLAN, [])
}

export async function savePlan(plan: Plan) {
  await db.plan.put({ ...plan, id: 'singleton', updatedAt: Date.now() })
}
