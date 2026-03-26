import { formatCurrency } from '@/lib/utils'
import type { WithdrawalPlan } from '@/engine/retirement/withdrawal-sequence'
import type { Account } from '@/types'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

interface WithdrawalPlanViewProps {
  plan: WithdrawalPlan | null
  accounts: Account[]
}

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  tfsa: '#22c55e',
  rrsp: '#3b82f6',
  'non-registered': '#f97316',
  fhsa: '#a855f7',
  crypto: '#eab308',
  pension: '#6366f1',
}

export function WithdrawalPlanView({ plan, accounts }: WithdrawalPlanViewProps) {
  if (!plan || plan.years.length === 0) {
    return (
      <div className="text-center py-8 text-[13px] text-text-secondary">
        Set up your profile data to see your withdrawal plan.
      </div>
    )
  }

  // Build chart data — show every year
  const accountIds = accounts
    .filter(a => a.owner === 'self' || a.owner === undefined || a.owner === null)
    .map(a => a.id)

  const chartData = plan.years.map(year => {
    const row: Record<string, number> = { age: year.age }
    for (const id of accountIds) {
      const balance = year.accountBalances[id]
      row[id] = balance ? Math.max(balance.toNumber(), 0) : 0
    }
    return row
  })

  // Summary stats
  const firstDepletionAge = Object.values(plan.accountDepletionAges).length > 0
    ? Math.min(...Object.values(plan.accountDepletionAges))
    : null

  // Every-5-year table
  const tableRows = plan.years.filter((_, i) => i % 5 === 0 || i === plan.years.length - 1)

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">
            Lifetime Tax
          </div>
          <div className="text-[16px] font-bold text-text">
            {formatCurrency(plan.lifetimeTaxPaid.toString())}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">
            OAS Clawback
          </div>
          <div className="text-[16px] font-bold text-text">
            {plan.totalOasClawback.gt(0)
              ? formatCurrency(plan.totalOasClawback.toString())
              : 'None'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">
            First Depletion
          </div>
          <div className="text-[16px] font-bold text-text">
            {firstDepletionAge ? `Age ${firstDepletionAge}` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Balance chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
            <XAxis
              dataKey="age"
              tick={{ fontSize: 11, fill: '#878787' }}
              label={{ value: 'Age', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#878787' } }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#878787' }}
              tickFormatter={(v) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(v) => formatCurrency(String(Math.round(Number(v))))}
              labelFormatter={(age) => `Age ${age}`}
              contentStyle={{ borderRadius: '8px', border: '1px solid #E8E8E4', fontSize: '13px', boxShadow: 'none' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {accounts
              .filter(a => a.owner === 'self' || a.owner === undefined || a.owner === null)
              .map((account) => (
                <Area
                  key={account.id}
                  type="monotone"
                  dataKey={account.id}
                  name={account.name}
                  stackId="1"
                  stroke={ACCOUNT_TYPE_COLORS[account.type] ?? '#6b7280'}
                  fill={ACCOUNT_TYPE_COLORS[account.type] ?? '#6b7280'}
                  fillOpacity={0.3}
                />
              ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Year-by-year table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 px-2 font-semibold text-text-secondary">Age</th>
              <th className="py-2 px-2 font-semibold text-text-secondary text-right">Tax</th>
              <th className="py-2 px-2 font-semibold text-text-secondary text-right">OAS Clawback</th>
              <th className="py-2 px-2 font-semibold text-text-secondary text-right">After-Tax Income</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(year => (
              <tr key={year.age} className="border-b border-border/50 hover:bg-surface-alt transition-colors">
                <td className="py-1.5 px-2">{year.age}</td>
                <td className="py-1.5 px-2 text-right text-danger">{formatCurrency(year.totalTax.toString())}</td>
                <td className="py-1.5 px-2 text-right">
                  {year.oasClawback.gt(0)
                    ? <span className="text-amber-600 dark:text-amber-400">{formatCurrency(year.oasClawback.toString())}</span>
                    : <span className="text-text-secondary">—</span>
                  }
                </td>
                <td className="py-1.5 px-2 text-right font-medium">{formatCurrency(year.afterTaxIncome.toString())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
