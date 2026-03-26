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
    <div className="flex-1 border border-border py-3 px-4">
      <div className="text-[10px] font-medium text-text-secondary uppercase tracking-widest mb-1">
        {label}
      </div>
      <div className={`text-[15px] font-semibold tabular-nums ${valueClassName ?? 'text-text'}`}>
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
  const netWorthColor = netWorthNum < 0 ? 'text-danger' : 'text-text'

  const savingsRateDisplay =
    savingsRate !== null ? `${savingsRate.toFixed(1)}%` : '—'

  const yearsToFireDisplay =
    yearsToFire !== null ? `${Math.round(yearsToFire)} yrs` : '—'

  return (
    <div className="flex gap-0 border border-border divide-x divide-border">
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
