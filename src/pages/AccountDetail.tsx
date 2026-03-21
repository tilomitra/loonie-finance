import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAccount, useBalanceHistory } from '@/db/hooks'
import { formatCurrency, formatCurrencyPrecise } from '@/lib/utils'
import { ACCOUNT_TYPE_LABELS } from '@/types'
import { ArrowLeft } from 'lucide-react'

export function AccountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const account = useAccount(id)
  const history = useBalanceHistory(id)

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary text-[13px]">Account not found.</p>
        <Button variant="ghost" onClick={() => navigate('/accounts')} className="mt-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Accounts
        </Button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => navigate('/accounts')}
        className="flex items-center gap-1 text-[13px] text-text-secondary hover:text-text mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Accounts
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl">{account.name}</h1>
          <p className="text-text-secondary text-[13px] mt-1">
            {ACCOUNT_TYPE_LABELS[account.type]}
            {account.institution && ` · ${account.institution}`}
          </p>
        </div>
        <div className="text-2xl font-semibold text-primary tracking-tight">
          {formatCurrency(account.balance)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <dl className="space-y-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-text-secondary">Type</dt>
              <dd className="font-medium">{ACCOUNT_TYPE_LABELS[account.type]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Balance</dt>
              <dd className="font-medium">{formatCurrencyPrecise(account.balance)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Currency</dt>
              <dd className="font-medium">{account.currency}</dd>
            </div>
            {account.institution && (
              <div className="flex justify-between">
                <dt className="text-text-secondary">Institution</dt>
                <dd className="font-medium">{account.institution}</dd>
              </div>
            )}
            {account.interestRate && (
              <div className="flex justify-between">
                <dt className="text-text-secondary">Interest Rate</dt>
                <dd className="font-medium">{account.interestRate}%</dd>
              </div>
            )}
            {account.notes && (
              <div className="flex justify-between">
                <dt className="text-text-secondary">Notes</dt>
                <dd className="font-medium">{account.notes}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance History</CardTitle>
          </CardHeader>
          {history.length === 0 ? (
            <p className="text-text-secondary text-[13px]">No history recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map(entry => (
                <div key={entry.id} className="flex justify-between items-center text-[13px]">
                  <span className="text-text-secondary">{entry.date}</span>
                  <span className="font-medium">{formatCurrencyPrecise(entry.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
