import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { useNetWorth, useAccounts } from '@/db/hooks'
import { formatCurrency } from '@/lib/utils'
import { isDebtType } from '@/types'
import { TrendingUp, Wallet, CreditCard } from 'lucide-react'

export function Dashboard() {
  const { netWorth, totalAssets, totalDebts } = useNetWorth()
  const accounts = useAccounts()

  return (
    <div>
      <h1 className="font-serif text-2xl mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/8 rounded-lg">
              <TrendingUp className="w-4 h-4 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Net Worth</div>
              <div className="text-xl font-semibold tracking-tight">{formatCurrency(netWorth.toString())}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/8 rounded-lg">
              <Wallet className="w-4 h-4 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Total Assets</div>
              <div className="text-xl font-semibold tracking-tight">{formatCurrency(totalAssets.toString())}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger/8 rounded-lg">
              <CreditCard className="w-4 h-4 text-danger" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Total Debts</div>
              <div className="text-xl font-semibold tracking-tight">{formatCurrency(totalDebts.toString())}</div>
            </div>
          </div>
        </Card>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <Wallet className="w-10 h-10 text-border mx-auto mb-3" strokeWidth={1.5} />
            <h3 className="font-serif text-lg mb-1">No accounts yet</h3>
            <p className="text-text-secondary text-[13px]">
              Add your first account to start tracking your net worth.
            </p>
            <a
              href="/accounts"
              className="inline-block mt-5 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary-dark transition-colors"
            >
              Add Account
            </a>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
              <CardDescription>{accounts.filter(a => !isDebtType(a.type)).length} accounts</CardDescription>
            </CardHeader>
            <div className="space-y-1">
              {accounts.filter(a => !isDebtType(a.type)).map(account => (
                <a
                  key={account.id}
                  href={`/accounts/${account.id}`}
                  className="flex justify-between items-center py-2 px-2 -mx-2 rounded-lg hover:bg-surface-alt transition-colors"
                >
                  <span className="text-[13px] font-medium">{account.name}</span>
                  <span className="text-[13px] text-primary font-medium">
                    {formatCurrency(account.balance)}
                  </span>
                </a>
              ))}
            </div>
          </Card>

          {accounts.some(a => isDebtType(a.type)) && (
            <Card>
              <CardHeader>
                <CardTitle>Debts</CardTitle>
                <CardDescription>{accounts.filter(a => isDebtType(a.type)).length} accounts</CardDescription>
              </CardHeader>
              <div className="space-y-1">
                {accounts.filter(a => isDebtType(a.type)).map(account => (
                  <a
                    key={account.id}
                    href={`/accounts/${account.id}`}
                    className="flex justify-between items-center py-2 px-2 -mx-2 rounded-lg hover:bg-surface-alt transition-colors"
                  >
                    <span className="text-[13px] font-medium">{account.name}</span>
                    <span className="text-[13px] text-danger font-medium">
                      -{formatCurrency(account.balance)}
                    </span>
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
