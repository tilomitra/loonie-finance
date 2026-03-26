import { formatCurrency } from '@/lib/utils'
import type { FireType } from '@/engine/retirement/fire'

interface DetailStat {
  label: string
  value: string
  subtitle?: string
  highlight?: boolean
}

export interface IncomeBreakdownData {
  monthlyCpp: number
  monthlyOas: number
  withdrawalRate: number
  annualSpending: number // the spending level for this FIRE type
  portfolioAtRetirement: number // the effective FIRE number (portfolio needed)
}

interface FireDetailBreakdownProps {
  type: FireType
  label: string
  color: string
  bgColor: string
  currentPortfolio: string
  targetNumber: string
  progress: number
  yearsToFire: number | null
  requiredAtRetirement?: string // for coast FIRE
  incomeBreakdown?: IncomeBreakdownData
}

const FIRE_DESCRIPTIONS: Record<FireType, string> = {
  coast: 'The amount you need today so your portfolio grows to your retirement target with no further contributions.',
  lean: 'The portfolio needed to cover minimal expenses in retirement using the safe withdrawal rate.',
  regular: 'The portfolio needed to fully cover your planned retirement expenses.',
  fat: 'The portfolio needed to cover an elevated, comfortable retirement lifestyle.',
  barista: 'The annual part-time income needed to cover expenses while letting investments grow.',
}

export function FireDetailBreakdown({
  type,
  label,
  currentPortfolio,
  targetNumber,
  progress,
  yearsToFire,
  requiredAtRetirement,
  incomeBreakdown,
}: FireDetailBreakdownProps) {
  const pct = Math.min(Math.round(progress * 100), 100)
  const estimatedYear = yearsToFire !== null ? new Date().getFullYear() + yearsToFire : null
  const isAchieved = progress >= 1

  const stats: DetailStat[] = []

  stats.push({
    label: 'Current Portfolio',
    value: formatCurrency(currentPortfolio),
  })

  if (type === 'coast' && requiredAtRetirement) {
    stats.push({
      label: 'Required at Retirement',
      value: formatCurrency(requiredAtRetirement),
      subtitle: 'Based on expenses & withdrawal rate',
    })
  }

  if (type === 'barista') {
    stats.push({
      label: 'Income Needed',
      value: formatCurrency(targetNumber),
      subtitle: 'Annual part-time income to cover gap',
      highlight: true,
    })
  } else {
    stats.push({
      label: type === 'coast' ? `${label} Number Today` : `${label} Target`,
      value: formatCurrency(targetNumber),
      highlight: true,
    })

    stats.push({
      label: `${label} Year`,
      value: isAchieved ? 'Achieved!' : estimatedYear ? String(estimatedYear) : 'N/A',
      subtitle: isAchieved
        ? 'You have reached this milestone'
        : estimatedYear
          ? 'When you can reach this milestone'
          : 'Not achievable at current savings rate',
    })

    stats.push({
      label: `Years Until ${label}`,
      value: isAchieved ? '0' : yearsToFire !== null ? String(yearsToFire) : 'N/A',
    })
  }

  // Compute income breakdown rows
  const incomeRows = incomeBreakdown ? computeIncomeRows(incomeBreakdown) : null

  return (
    <div className="border border-border p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text">
          Your {label} Results
        </h3>
        {!['barista'].includes(type) && (
          <span className="text-[11px] font-medium text-accent tabular-nums">
            {pct}% complete
          </span>
        )}
      </div>
      <p className="text-[11px] text-text-secondary mb-4">
        {FIRE_DESCRIPTIONS[type]}
      </p>

      <div
        className="grid gap-0 border border-border divide-x divide-border"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`p-3 text-center ${
              stat.highlight ? 'bg-accent/5' : ''
            }`}
          >
            <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">
              {stat.label}
            </div>
            <div
              className={`text-[16px] font-bold tracking-tight tabular-nums ${
                stat.highlight ? 'text-accent' : 'text-text'
              }`}
            >
              {stat.value}
            </div>
            {stat.subtitle && (
              <div className="text-[10px] text-text-secondary mt-1 leading-tight">
                {stat.subtitle}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Income Breakdown Table */}
      {incomeRows && (
        <div className="mt-5">
          <h4 className="text-[11px] font-semibold uppercase tracking-widest text-text mb-3">
            Monthly Retirement Income Breakdown
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="border border-border overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-surface-alt">
                      <th className="text-left py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Income Source</th>
                      <th className="text-right py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Monthly</th>
                      <th className="text-right py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Yearly</th>
                      <th className="text-right py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeRows.rows.map((row) => (
                      <tr
                        key={row.label}
                        className={row.isTotal ? 'font-semibold bg-surface-alt' : row.isSubtotal ? 'font-medium border-t border-border' : ''}
                      >
                        <td className="py-1.5 px-3">{row.label}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{formatCurrency(String(Math.round(row.monthly)))}/mo</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{formatCurrency(String(Math.round(row.yearly)))}/yr</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{row.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="border border-border p-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-2">Notes</div>
              <ul className="text-[11px] text-text-secondary space-y-1.5 list-disc pl-3.5 leading-relaxed">
                {incomeRows.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface IncomeRow {
  label: string
  monthly: number
  yearly: number
  pct: string
  isSubtotal?: boolean
  isTotal?: boolean
}

function computeIncomeRows(data: IncomeBreakdownData): { rows: IncomeRow[]; notes: string[] } {
  const { monthlyCpp, monthlyOas, withdrawalRate, portfolioAtRetirement } = data

  const monthlyGovt = monthlyCpp + monthlyOas
  const monthlyPortfolioWithdrawal = portfolioAtRetirement > 0
    ? (portfolioAtRetirement * withdrawalRate) / 12
    : 0
  const totalMonthly = monthlyGovt + monthlyPortfolioWithdrawal

  const pct = (val: number) => totalMonthly > 0 ? ((val / totalMonthly) * 100).toFixed(1) : '0.0'

  const rows: IncomeRow[] = [
    { label: 'CPP', monthly: monthlyCpp, yearly: monthlyCpp * 12, pct: pct(monthlyCpp) },
    { label: 'OAS', monthly: monthlyOas, yearly: monthlyOas * 12, pct: pct(monthlyOas) },
    { label: 'Government Benefits', monthly: monthlyGovt, yearly: monthlyGovt * 12, pct: pct(monthlyGovt), isSubtotal: true },
    { label: 'Portfolio Withdrawal', monthly: monthlyPortfolioWithdrawal, yearly: monthlyPortfolioWithdrawal * 12, pct: pct(monthlyPortfolioWithdrawal) },
    { label: 'Total Monthly Income', monthly: totalMonthly, yearly: totalMonthly * 12, pct: '100.0', isTotal: true },
  ]

  const govtPct = pct(monthlyGovt)
  const portfolioPct = pct(monthlyPortfolioWithdrawal)

  const notes: string[] = [
    `Portfolio withdrawal is based on a ${(withdrawalRate * 100).toFixed(1)}% annual withdrawal rate.`,
    `Target portfolio of ${formatCurrency(String(Math.round(portfolioAtRetirement)))} provides ${formatCurrency(String(Math.round(monthlyPortfolioWithdrawal * 12)))}/yr in income.`,
    `Government benefits make up ${govtPct}% of retirement income.`,
    `Portfolio withdrawals provide the remaining ${portfolioPct}%.`,
  ]

  return { rows, notes }
}
