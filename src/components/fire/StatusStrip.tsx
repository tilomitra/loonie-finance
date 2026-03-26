import { formatCurrency } from '@/lib/utils'

interface StatusStripProps {
  netWorth: string
  totalAssets: string
  totalDebts: string
  savingsRate: number | null   // percentage, e.g. 35.5
  yearsToFire: number | null   // from fire plan result
  monthlyContributions: string // total monthly savings
}

interface StatCardProps {
  label: string
  value: string
  valueClassName?: string
}

function StatCard({ label, value, valueClassName }: StatCardProps) {
  return (
    <div className="flex-1 bg-surface rounded-lg border border-border py-3 px-4">
      <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className={`text-[17px] font-semibold tracking-tight ${valueClassName ?? 'text-text'}`}>
        {value}
      </div>
    </div>
  )
}

export function StatusStrip({
  netWorth,
  monthlyContributions,
  savingsRate,
  yearsToFire,
}: StatusStripProps) {
  const netWorthNum = parseFloat(netWorth)
  const netWorthFormatted = formatCurrency(netWorth)
  const netWorthColor = netWorthNum < 0 ? 'text-danger' : 'text-primary'

  const savingsRateDisplay =
    savingsRate !== null ? `${savingsRate.toFixed(1)}%` : '—'

  const yearsToFireDisplay =
    yearsToFire !== null ? `${Math.round(yearsToFire)} yrs` : '—'

  return (
    <div className="flex gap-3">
      <StatCard
        label="Net Worth"
        value={netWorthFormatted}
        valueClassName={netWorthColor}
      />
      <StatCard
        label="Monthly Savings"
        value={formatCurrency(monthlyContributions)}
      />
      <StatCard
        label="Savings Rate"
        value={savingsRateDisplay}
      />
      <StatCard
        label="Years to FIRE"
        value={yearsToFireDisplay}
      />
    </div>
  )
}
