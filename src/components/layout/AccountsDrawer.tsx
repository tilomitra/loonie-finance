import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useAccounts, useNetWorth } from '@/db/hooks'
import { db } from '@/db/database'
import { formatCurrency, generateId } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import {
  ACCOUNT_TYPE_LABELS,
  isDebtType,
  isRegisteredType,
  type AccountType,
  type Currency,
} from '@/types'
import { DEFAULT_RETURN_RATES } from '@/engine/projection/account-defaults'

interface AccountsDrawerProps {
  open: boolean
  onClose: () => void
}

const REGISTERED_TYPES: AccountType[] = ['tfsa', 'rrsp', 'fhsa']
const INVESTMENT_TYPES: AccountType[] = ['non-registered', 'cash', 'crypto', 'property', 'pension']
const DEBT_TYPES: AccountType[] = ['debt-mortgage', 'debt-loc', 'debt-credit', 'debt-other']

const accountTypeOptions = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const currencyOptions = [
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'USD', label: 'USD - US Dollar' },
]

interface AddAccountForm {
  name: string
  type: AccountType
  balance: string
  currency: Currency
  institution: string
  interestRate: string
  expectedReturnRate: string
}

const emptyForm = (): AddAccountForm => ({
  name: '',
  type: 'tfsa',
  balance: '',
  currency: 'CAD',
  institution: '',
  interestRate: '',
  expectedReturnRate: DEFAULT_RETURN_RATES['tfsa'],
})

export function AccountsDrawer({ open, onClose }: AccountsDrawerProps) {
  const accounts = useAccounts()
  const { netWorth, totalAssets, totalDebts } = useNetWorth()

  const [addingForGroup, setAddingForGroup] = useState<'registered' | 'investments' | 'debts' | null>(null)
  const [addForm, setAddForm] = useState<AddAccountForm>(emptyForm())
  const [returnRateEdited, setReturnRateEdited] = useState(false)

  const [editBalanceId, setEditBalanceId] = useState<string | null>(null)
  const [editBalanceValue, setEditBalanceValue] = useState('')

  // Group accounts
  const registeredAccounts = accounts.filter(a => isRegisteredType(a.type))
  const investmentAccounts = accounts.filter(a => !isRegisteredType(a.type) && !isDebtType(a.type))
  const debtAccounts = accounts.filter(a => isDebtType(a.type))

  const openAddForGroup = (group: 'registered' | 'investments' | 'debts') => {
    const defaultType: AccountType = group === 'registered' ? 'tfsa' : group === 'investments' ? 'non-registered' : 'debt-mortgage'
    setAddForm({ ...emptyForm(), type: defaultType, expectedReturnRate: DEFAULT_RETURN_RATES[defaultType] })
    setReturnRateEdited(false)
    setAddingForGroup(group)
  }

  const cancelAdd = () => {
    setAddingForGroup(null)
    setAddForm(emptyForm())
    setReturnRateEdited(false)
  }

  const handleAddSave = async () => {
    if (!addForm.name) return
    const now = Date.now()
    const id = generateId()
    await db.accounts.add({
      id,
      name: addForm.name,
      type: addForm.type,
      balance: addForm.balance || '0',
      currency: addForm.currency,
      institution: addForm.institution,
      expectedReturnRate: isDebtType(addForm.type) ? '0' : addForm.expectedReturnRate,
      contributionRoom: null,
      interestRate: isDebtType(addForm.type) ? addForm.interestRate || null : null,
      notes: '',
      createdAt: now,
      updatedAt: now,
    })
    await db.balanceHistory.add({
      id: generateId(),
      accountId: id,
      balance: addForm.balance || '0',
      date: new Date().toISOString().split('T')[0],
      source: 'manual',
    })
    cancelAdd()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account?')) return
    await db.accounts.delete(id)
    await db.balanceHistory.where('accountId').equals(id).delete()
  }

  const startEditBalance = (id: string, currentBalance: string) => {
    setEditBalanceId(id)
    setEditBalanceValue(currentBalance)
  }

  const saveEditBalance = async (id: string) => {
    await db.accounts.update(id, {
      balance: editBalanceValue || '0',
      updatedAt: Date.now(),
    })
    setEditBalanceId(null)
    setEditBalanceValue('')
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-surface border-l border-border z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-serif text-lg font-bold text-text">Accounts</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-alt hover:text-text transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Registered Accounts */}
          <AccountGroup
            title="Registered Accounts"
            accounts={registeredAccounts}
            editBalanceId={editBalanceId}
            editBalanceValue={editBalanceValue}
            onStartEditBalance={startEditBalance}
            onSaveEditBalance={saveEditBalance}
            onCancelEditBalance={() => setEditBalanceId(null)}
            onEditBalanceChange={setEditBalanceValue}
            onDelete={handleDelete}
            onAddClick={() => openAddForGroup('registered')}
            addingForm={addingForGroup === 'registered' ? (
              <AddForm
                form={addForm}
                filterTypes={[...REGISTERED_TYPES]}
                returnRateEdited={returnRateEdited}
                onChange={setAddForm}
                onReturnRateEdited={() => setReturnRateEdited(true)}
                onSave={handleAddSave}
                onCancel={cancelAdd}
              />
            ) : null}
          />

          {/* Investment Accounts */}
          <AccountGroup
            title="Investments"
            accounts={investmentAccounts}
            editBalanceId={editBalanceId}
            editBalanceValue={editBalanceValue}
            onStartEditBalance={startEditBalance}
            onSaveEditBalance={saveEditBalance}
            onCancelEditBalance={() => setEditBalanceId(null)}
            onEditBalanceChange={setEditBalanceValue}
            onDelete={handleDelete}
            onAddClick={() => openAddForGroup('investments')}
            addingForm={addingForGroup === 'investments' ? (
              <AddForm
                form={addForm}
                filterTypes={[...INVESTMENT_TYPES]}
                returnRateEdited={returnRateEdited}
                onChange={setAddForm}
                onReturnRateEdited={() => setReturnRateEdited(true)}
                onSave={handleAddSave}
                onCancel={cancelAdd}
              />
            ) : null}
          />

          {/* Debts */}
          <AccountGroup
            title="Debts"
            accounts={debtAccounts}
            editBalanceId={editBalanceId}
            editBalanceValue={editBalanceValue}
            onStartEditBalance={startEditBalance}
            onSaveEditBalance={saveEditBalance}
            onCancelEditBalance={() => setEditBalanceId(null)}
            onEditBalanceChange={setEditBalanceValue}
            onDelete={handleDelete}
            onAddClick={() => openAddForGroup('debts')}
            isDebts
            addingForm={addingForGroup === 'debts' ? (
              <AddForm
                form={addForm}
                filterTypes={[...DEBT_TYPES]}
                returnRateEdited={returnRateEdited}
                onChange={setAddForm}
                onReturnRateEdited={() => setReturnRateEdited(true)}
                onSave={handleAddSave}
                onCancel={cancelAdd}
              />
            ) : null}
          />
        </div>

        {/* Footer: Summary */}
        <div className="shrink-0 border-t border-border px-5 py-4 bg-surface-alt space-y-1.5">
          <div className="flex justify-between text-[12px]">
            <span className="text-text-secondary">Total Assets</span>
            <span className="text-text font-medium">{formatCurrency(totalAssets.toString())}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-text-secondary">Total Debts</span>
            <span className="text-danger font-medium">-{formatCurrency(totalDebts.toString())}</span>
          </div>
          <div className="flex justify-between text-[13px] pt-1 border-t border-border">
            <span className="font-semibold text-text">Net Worth</span>
            <span className={`font-semibold ${netWorth.gte(0) ? 'text-primary' : 'text-danger'}`}>
              {formatCurrency(netWorth.toString())}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── AccountGroup ────────────────────────────────────────────────────────────

interface AccountGroupProps {
  title: string
  accounts: import('@/types').Account[]
  editBalanceId: string | null
  editBalanceValue: string
  onStartEditBalance: (id: string, balance: string) => void
  onSaveEditBalance: (id: string) => void
  onCancelEditBalance: () => void
  onEditBalanceChange: (val: string) => void
  onDelete: (id: string) => void
  onAddClick: () => void
  isDebts?: boolean
  addingForm: React.ReactNode
}

function AccountGroup({
  title,
  accounts,
  editBalanceId,
  editBalanceValue,
  onStartEditBalance,
  onSaveEditBalance,
  onCancelEditBalance,
  onEditBalanceChange,
  onDelete,
  onAddClick,
  isDebts = false,
  addingForm,
}: AccountGroupProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">{title}</h3>
        <button
          onClick={onAddClick}
          className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {addingForm}

      {accounts.length === 0 && !addingForm && (
        <p className="text-[12px] text-text-secondary/60 italic py-1">None yet.</p>
      )}

      <div className="space-y-0.5">
        {accounts.map(account => (
          <AccountRow
            key={account.id}
            account={account}
            isDebt={isDebts}
            editBalanceId={editBalanceId}
            editBalanceValue={editBalanceValue}
            onStartEditBalance={onStartEditBalance}
            onSaveEditBalance={onSaveEditBalance}
            onCancelEditBalance={onCancelEditBalance}
            onEditBalanceChange={onEditBalanceChange}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

// ─── AccountRow ──────────────────────────────────────────────────────────────

interface AccountRowProps {
  account: import('@/types').Account
  isDebt: boolean
  editBalanceId: string | null
  editBalanceValue: string
  onStartEditBalance: (id: string, balance: string) => void
  onSaveEditBalance: (id: string) => void
  onCancelEditBalance: () => void
  onEditBalanceChange: (val: string) => void
  onDelete: (id: string) => void
}

function AccountRow({
  account,
  isDebt,
  editBalanceId,
  editBalanceValue,
  onStartEditBalance,
  onSaveEditBalance,
  onCancelEditBalance,
  onEditBalanceChange,
  onDelete,
}: AccountRowProps) {
  const isEditingBalance = editBalanceId === account.id

  return (
    <div className="group flex items-start justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-surface-alt transition-colors">
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-[13px] text-text truncate">{account.name}</span>
          <span className="text-[10px] bg-surface-alt group-hover:bg-background border border-border rounded px-1 py-0.5 text-text-secondary shrink-0 transition-colors">
            {ACCOUNT_TYPE_LABELS[account.type]}
          </span>
        </div>
        <div className="text-[11px] text-text-secondary mt-0.5">
          {account.institution && <span>{account.institution} · </span>}
          {isDebt
            ? account.interestRate && <span>{account.interestRate}% interest</span>
            : account.expectedReturnRate && <span>{account.expectedReturnRate}% return</span>
          }
          {isRegisteredType(account.type) && account.contributionRoom && (
            <span className="ml-1 text-primary">Room: {formatCurrency(account.contributionRoom)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isEditingBalance ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              value={editBalanceValue}
              onChange={e => onEditBalanceChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onSaveEditBalance(account.id)
                if (e.key === 'Escape') onCancelEditBalance()
              }}
              autoFocus
              className="w-24 text-right text-[12px] border border-primary rounded px-1.5 py-0.5 bg-surface text-text focus:outline-none"
            />
            <button
              onClick={() => onSaveEditBalance(account.id)}
              className="text-[11px] text-primary hover:text-primary/80 font-medium cursor-pointer"
            >
              Save
            </button>
            <button
              onClick={onCancelEditBalance}
              className="text-[11px] text-text-secondary hover:text-text cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onStartEditBalance(account.id, account.balance)}
              className="text-[13px] font-semibold cursor-pointer hover:opacity-70 transition-opacity"
              title="Click to edit balance"
            >
              <span className={isDebt ? 'text-danger' : 'text-primary'}>
                {isDebt ? '-' : ''}{formatCurrency(account.balance)}
              </span>
            </button>
            <button
              onClick={() => onDelete(account.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-danger transition-all cursor-pointer"
              title="Delete account"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── AddForm ─────────────────────────────────────────────────────────────────

interface AddFormProps {
  form: AddAccountForm
  filterTypes: AccountType[]
  returnRateEdited: boolean
  onChange: (form: AddAccountForm) => void
  onReturnRateEdited: () => void
  onSave: () => void
  onCancel: () => void
}

function AddForm({ form, filterTypes, returnRateEdited, onChange, onReturnRateEdited, onSave, onCancel }: AddFormProps) {
  const filteredOptions = accountTypeOptions.filter(o => filterTypes.includes(o.value as AccountType))
  const isDebt = isDebtType(form.type)

  return (
    <div className="mb-3 p-3 border border-border rounded-xl bg-surface-alt space-y-3">
      <Input
        label="Account Name"
        value={form.name}
        onChange={e => onChange({ ...form, name: e.target.value })}
        placeholder="e.g., Wealthsimple TFSA"
      />
      <Select
        label="Account Type"
        value={form.type}
        onChange={e => {
          const newType = e.target.value as AccountType
          onChange({
            ...form,
            type: newType,
            ...(!returnRateEdited ? { expectedReturnRate: DEFAULT_RETURN_RATES[newType] } : {}),
          })
        }}
        options={filteredOptions}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Balance"
          type="number"
          step="0.01"
          value={form.balance}
          onChange={e => onChange({ ...form, balance: e.target.value })}
          placeholder="0.00"
        />
        <Select
          label="Currency"
          value={form.currency}
          onChange={e => onChange({ ...form, currency: e.target.value as Currency })}
          options={currencyOptions}
        />
      </div>
      <Input
        label="Institution"
        value={form.institution}
        onChange={e => onChange({ ...form, institution: e.target.value })}
        placeholder="e.g., Wealthsimple, TD"
      />
      {isDebt ? (
        <Input
          label="Interest Rate (%)"
          type="number"
          step="0.01"
          value={form.interestRate}
          onChange={e => onChange({ ...form, interestRate: e.target.value })}
          placeholder="e.g., 5.25"
        />
      ) : (
        <Input
          label="Expected Annual Return (%)"
          type="number"
          step="0.1"
          min="0"
          max="30"
          value={form.expectedReturnRate}
          onChange={e => {
            onChange({ ...form, expectedReturnRate: e.target.value })
            onReturnRateEdited()
          }}
          placeholder="e.g., 5.0"
        />
      )}
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={!form.name}>Add Account</Button>
      </div>
    </div>
  )
}
