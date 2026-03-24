import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAccounts } from '@/db/hooks'
import { db } from '@/db/database'
import { formatCurrency, generateId } from '@/lib/utils'
import { ACCOUNT_TYPE_LABELS, isDebtType, type AccountType, type Currency } from '@/types'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { DEFAULT_RETURN_RATES } from '@/engine/projection/account-defaults'

const accountTypeOptions = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const currencyOptions = [
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'USD', label: 'USD - US Dollar' },
]

export function Accounts() {
  const accounts = useAccounts()
  const navigate = useNavigate()
  const location = useLocation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    type: 'tfsa' as AccountType,
    balance: '',
    currency: 'CAD' as Currency,
    institution: '',
    interestRate: '',
    expectedReturnRate: DEFAULT_RETURN_RATES['tfsa'],
    notes: '',
  })
  const [returnRateEdited, setReturnRateEdited] = useState(false)

  useEffect(() => {
    const state = location.state as { editAccountId?: string } | null
    if (state?.editAccountId && accounts.length > 0) {
      openEdit(state.editAccountId)
      // Clear the state so it doesn't re-trigger
      navigate(location.pathname, { replace: true })
    }
  }, [location.state, accounts])

  const resetForm = () => {
    setForm({ name: '', type: 'tfsa', balance: '', currency: 'CAD', institution: '', interestRate: '', expectedReturnRate: DEFAULT_RETURN_RATES['tfsa'], notes: '' })
    setEditingId(null)
    setReturnRateEdited(false)
  }

  const openNew = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (id: string) => {
    const account = accounts.find(a => a.id === id)
    if (!account) return
    setForm({
      name: account.name,
      type: account.type,
      balance: account.balance,
      currency: account.currency,
      institution: account.institution,
      interestRate: account.interestRate || '',
      expectedReturnRate: account.expectedReturnRate || DEFAULT_RETURN_RATES[account.type],
      notes: account.notes,
    })
    setReturnRateEdited(true)
    setEditingId(id)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const now = Date.now()
    if (editingId) {
      await db.accounts.update(editingId, {
        name: form.name,
        type: form.type,
        balance: form.balance || '0',
        currency: form.currency,
        institution: form.institution,
        interestRate: isDebtType(form.type) ? form.interestRate || null : null,
        expectedReturnRate: isDebtType(form.type) ? '0' : form.expectedReturnRate,
        notes: form.notes,
        updatedAt: now,
      })
    } else {
      const id = generateId()
      await db.accounts.add({
        id,
        name: form.name,
        type: form.type,
        balance: form.balance || '0',
        currency: form.currency,
        institution: form.institution,
        expectedReturnRate: isDebtType(form.type) ? '0' : form.expectedReturnRate,
        contributionRoom: null,
        interestRate: isDebtType(form.type) ? form.interestRate || null : null,
        notes: form.notes,
        createdAt: now,
        updatedAt: now,
      })
      // Also record initial balance
      await db.balanceHistory.add({
        id: generateId(),
        accountId: id,
        balance: form.balance || '0',
        date: new Date().toISOString().split('T')[0],
        source: 'manual',
      })
    }
    setDialogOpen(false)
    resetForm()
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this account?')) return
    await db.accounts.delete(id)
    await db.balanceHistory.where('accountId').equals(id).delete()
  }

  const assetAccounts = accounts.filter(a => !isDebtType(a.type))
  const debtAccounts = accounts.filter(a => isDebtType(a.type))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl">Accounts</h1>
        <Button onClick={openNew}>
          <Plus className="w-3.5 h-3.5" />
          Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-text-secondary text-[13px] mb-4">No accounts yet. Add your first account to get started.</p>
            <Button onClick={openNew}>
              <Plus className="w-3.5 h-3.5" />
              Add Account
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {assetAccounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Assets</CardTitle>
              </CardHeader>
              <div className="space-y-0.5">
                {assetAccounts.map(account => (
                  <div
                    key={account.id}
                    onClick={() => navigate(`/accounts/${account.id}`)}
                    className="flex items-center justify-between py-2.5 px-3 -mx-1 rounded-lg hover:bg-surface-alt transition-colors cursor-pointer group"
                  >
                    <div>
                      <div className="font-medium text-[13px]">{account.name}</div>
                      <div className="text-[11px] text-text-secondary mt-0.5">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                        {account.institution && ` · ${account.institution}`}
                        {account.expectedReturnRate && ` · ${account.expectedReturnRate}% return`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[13px] text-primary">
                        {formatCurrency(account.balance)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(account.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-primary transition-all cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(account.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-danger transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {debtAccounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Debts</CardTitle>
              </CardHeader>
              <div className="space-y-0.5">
                {debtAccounts.map(account => (
                  <div
                    key={account.id}
                    onClick={() => navigate(`/accounts/${account.id}`)}
                    className="flex items-center justify-between py-2.5 px-3 -mx-1 rounded-lg hover:bg-surface-alt transition-colors cursor-pointer group"
                  >
                    <div>
                      <div className="font-medium text-[13px]">{account.name}</div>
                      <div className="text-[11px] text-text-secondary mt-0.5">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                        {account.institution && ` · ${account.institution}`}
                        {account.interestRate && ` · ${account.interestRate}% interest`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[13px] text-danger">
                        -{formatCurrency(account.balance)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(account.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-primary transition-all cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(account.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-danger transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? 'Edit Account' : 'Add Account'}>
        <div className="space-y-4">
          <Input
            label="Account Name"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g., Wealthsimple TFSA"
          />
          <Select
            label="Account Type"
            value={form.type}
            onChange={(e) => {
              const newType = e.target.value as AccountType
              setForm(f => ({
                ...f,
                type: newType,
                ...(!returnRateEdited ? { expectedReturnRate: DEFAULT_RETURN_RATES[newType] } : {}),
              }))
            }}
            options={accountTypeOptions}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Balance"
              type="number"
              step="0.01"
              value={form.balance}
              onChange={(e) => setForm(f => ({ ...f, balance: e.target.value }))}
              placeholder="0.00"
            />
            <Select
              label="Currency"
              value={form.currency}
              onChange={(e) => setForm(f => ({ ...f, currency: e.target.value as Currency }))}
              options={currencyOptions}
            />
          </div>
          <Input
            label="Institution"
            value={form.institution}
            onChange={(e) => setForm(f => ({ ...f, institution: e.target.value }))}
            placeholder="e.g., Wealthsimple, TD, RBC"
          />
          {isDebtType(form.type) && (
            <Input
              label="Interest Rate (%)"
              type="number"
              step="0.01"
              value={form.interestRate}
              onChange={(e) => setForm(f => ({ ...f, interestRate: e.target.value }))}
              placeholder="e.g., 5.25"
            />
          )}
          {!isDebtType(form.type) && (
            <Input
              label="Expected Annual Return (%)"
              type="number"
              step="0.1"
              min="0"
              max="30"
              value={form.expectedReturnRate}
              onChange={(e) => {
                setForm(f => ({ ...f, expectedReturnRate: e.target.value }))
                setReturnRateEdited(true)
              }}
              placeholder="e.g., 5.0"
            />
          )}
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name}>
              {editingId ? 'Save Changes' : 'Add Account'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
