import { db } from './database'
import type { Account, AccountType, Institution } from '@/types'
import { includeInFireByDefault } from '@/types'
import { generateId } from '@/lib/utils'

export interface AccountDraft {
  key: string
  name: string
  type: AccountType
  institution: Institution
  balance: string
  includeInFire: boolean
}

/** Add new accounts, or update the balance of accounts imported before (matched by import key). */
export async function upsertImportedAccounts(drafts: AccountDraft[]): Promise<{ added: number; updated: number }> {
  let added = 0
  let updated = 0
  await db.transaction('rw', db.accounts, async () => {
    for (const d of drafts) {
      const existing = await db.accounts.where('importKey').equals(d.key).first()
      if (existing) {
        await db.accounts.update(existing.id, {
          balance: d.balance, type: d.type, name: d.name, includeInFire: d.includeInFire, updatedAt: Date.now(),
        })
        updated++
      } else {
        await db.accounts.add({ id: generateId(), importKey: d.key, ...omitKey(d), updatedAt: Date.now() })
        added++
      }
    }
  })
  return { added, updated }
}

function omitKey(d: AccountDraft) {
  const { key: _key, ...rest } = d
  void _key
  return rest
}

export async function addManualAccount(input: { name: string; institution: Institution; type: AccountType; balance: string }) {
  const account: Account = {
    id: generateId(),
    ...input,
    includeInFire: includeInFireByDefault(input.type),
    updatedAt: Date.now(),
  }
  await db.accounts.add(account)
}

export async function updateAccount(id: string, changes: Partial<Account>) {
  await db.accounts.update(id, { ...changes, updatedAt: Date.now() })
}

export async function deleteAccount(id: string) {
  await db.accounts.delete(id)
}
