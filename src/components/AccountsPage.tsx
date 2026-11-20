import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Account, AccountType, Institution } from '@/types'
import { ACCOUNT_TYPE_LABELS, INSTITUTION_LABELS, isTaxDeferred } from '@/types'
import { addManualAccount, deleteAccount, updateAccount } from '@/db/accounts'
import { portfolioTotals } from '@/lib/plan-inputs'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ImportPanel } from '@/components/ImportPanel'
import { formatCurrency } from '@/lib/utils'

const typeOptions = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const institutionOptions = Object.entries(INSTITUTION_LABELS).map(([value, label]) => ({ value, label }))

function BalanceCell({ account }: { account: Account }) {
  const [value, setValue] = useState(account.balance)
  const [prev, setPrev] = useState(account.balance)
  if (prev !== account.balance) {
    setPrev(account.balance)
    setValue(account.balance)
  }
  return (
    <input
      type="number"
      aria-label={`Balance for ${account.name}`}
      className="w-32 border border-border px-2 py-1 text-right bg-surface"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => value !== account.balance && updateAccount(account.id, { balance: value || '0' })}
    />
  )
}

export function AccountsPage({ accounts }: { accounts: Account[] }) {
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState<Institution>('td')
  const [type, setType] = useState<AccountType>('tfsa')
  const [balance, setBalance] = useState('')
  const totals = portfolioTotals(accounts)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!balance) return
    await addManualAccount({
      name: name || `${INSTITUTION_LABELS[institution]} ${ACCOUNT_TYPE_LABELS[type]}`,
      institution, type, balance,
    })
    setName('')
    setBalance('')
  }

  return (
    <div className="space-y-4">
      <ImportPanel />

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>Your accounts</CardTitle>
          <div className="text-[12px] text-text-secondary">
            FIRE portfolio <span className="font-semibold text-text">{formatCurrency(totals.total)}</span>
            {totals.total.gt(0) && <> · {totals.taxDeferredShare.times(100).toFixed(0)}% tax-deferred</>}
          </div>
        </div>

        {accounts.length === 0 ? (
          <p className="mt-3 text-[12px] text-text-secondary">No accounts yet. Import a CSV above or add one below.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-text-secondary">
                  <th className="py-1 font-medium">Account</th>
                  <th className="py-1 font-medium">Type</th>
                  <th className="py-1 font-medium text-right">Balance (CAD)</th>
                  <th className="py-1 font-medium text-center">Count for FIRE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="py-1.5 pr-2">
                      <div>{a.name}</div>
                      <div className="text-[10px] text-text-secondary">
                        {INSTITUTION_LABELS[a.institution]} · updated {new Date(a.updatedAt).toLocaleDateString('en-CA')}
                        {isTaxDeferred(a.type) && ' · taxed on withdrawal'}
                      </div>
                    </td>
                    <td className="py-1.5 pr-2">
                      <select className="border border-border px-2 py-1 bg-surface" value={a.type}
                        onChange={e => updateAccount(a.id, { type: e.target.value as AccountType })}>
                        {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 text-right"><BalanceCell account={a} /></td>
                    <td className="py-1.5 text-center">
                      <input type="checkbox" aria-label={`Count ${a.name} for FIRE`} checked={a.includeInFire}
                        onChange={e => updateAccount(a.id, { includeInFire: e.target.checked })} />
                    </td>
                    <td className="py-1.5 text-right">
                      <button className="p-1 text-text-secondary hover:text-danger cursor-pointer" aria-label={`Delete ${a.name}`}
                        onClick={() => confirm(`Delete ${a.name}?`) && deleteAccount(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-text-secondary">
          FHSA and RESP are not counted by default, because that money is for a home or education. Tick the box to include them.
        </p>
      </Card>

      <Card>
        <CardTitle>Add an account by hand</CardTitle>
        <form onSubmit={add} className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <Input label="Name" placeholder="TD TFSA" value={name} onChange={e => setName(e.target.value)} />
          <Select label="Institution" value={institution} onChange={e => setInstitution(e.target.value as Institution)} options={institutionOptions} />
          <Select label="Type" value={type} onChange={e => setType(e.target.value as AccountType)} options={typeOptions} />
          <Input label="Balance (CAD)" type="number" placeholder="25000" value={balance} onChange={e => setBalance(e.target.value)} />
          <Button type="submit" disabled={!balance}>Add</Button>
        </form>
      </Card>
    </div>
  )
}
