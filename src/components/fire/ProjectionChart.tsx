import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  LineChart,
} from 'recharts'
import { runMonteCarloSimulation, type MonteCarloResult } from '@/engine/projection/monte-carlo'
import { projectNetWorth, projectNetWorthWithEvents } from '@/engine/projection/project-net-worth'
import type { Account, ScenarioAssumptions, LifeEvent } from '@/types'

const ACCOUNT_COLORS = [
  '#2D5A27', '#1a6b8a', '#8b5cf6', '#d97706', '#dc2626',
  '#0891b2', '#65a30d', '#c026d3', '#ea580c', '#475569',
]

interface ProjectionChartProps {
  accounts: Account[]
  assumptions: ScenarioAssumptions
  currentAge: number
  lifeEvents?: LifeEvent[]
  partnerAge?: number
}

export function ProjectionChart({
  accounts,
  assumptions,
  currentAge,
  lifeEvents,
  partnerAge,
}: ProjectionChartProps) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [iterations, setIterations] = useState(1000)

  const projectionData = useMemo(() => {
    if (accounts.length === 0) return []

    const hasEvents = lifeEvents && lifeEvents.length > 0

    const points = hasEvents
      ? projectNetWorthWithEvents({
          accounts,
          assumptions,
          currentAge,
          startYear: new Date().getFullYear(),
          lifeEvents,
          partnerAge,
        })
      : projectNetWorth({
          accounts,
          assumptions,
          currentAge,
          startYear: new Date().getFullYear(),
        })

    return points.map(p => {
      const row: Record<string, number> = {
        age: p.age,
        year: p.year,
        netWorth: p.netWorth.toNumber(),
        assets: p.totalAssets.toNumber(),
        debts: p.totalDebts.toNumber(),
      }
      for (const account of accounts) {
        row[`account_${account.id}`] = (p.accountBreakdown[account.id] ?? p.netWorth).toNumber()
      }
      return row
    })
  }, [accounts, assumptions, currentAge, lifeEvents, partnerAge])

  const mcChartData = useMemo(() => {
    if (!monteCarloResult) return []

    return monteCarloResult.percentiles.p5.map((point, i) => {
      const p5 = monteCarloResult.percentiles.p5[i].netWorth
      const p25 = monteCarloResult.percentiles.p25[i].netWorth
      const p75 = monteCarloResult.percentiles.p75[i].netWorth
      const p95 = monteCarloResult.percentiles.p95[i].netWorth
      const p50 = monteCarloResult.percentiles.p50[i].netWorth

      const detPoint = projectionData.find(d => d.age === point.age)

      return {
        age: point.age,
        p5,
        band_lower: p25 - p5,
        band_middle: p75 - p25,
        band_upper: p95 - p75,
        median: p50,
        deterministic: detPoint?.netWorth ?? null,
      }
    })
  }, [monteCarloResult, projectionData])

  const handleRunMonteCarlo = () => {
    setIsRunning(true)
    setTimeout(() => {
      const result = runMonteCarloSimulation({
        accounts,
        assumptions,
        currentAge,
        startYear: new Date().getFullYear(),
        iterations,
      })
      setMonteCarloResult(result)
      setIsRunning(false)
    }, 10)
  }

  return (
    <div className="space-y-4">
      {/* Main projection chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Net Worth Projection</CardTitle>
              <CardDescription>
                Projected growth from age {currentAge} to {assumptions.lifeExpectancy}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                variant={!showBreakdown ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setShowBreakdown(false)}
              >
                Net Worth
              </Button>
              <Button
                variant={showBreakdown ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setShowBreakdown(true)}
              >
                By Account
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            {showBreakdown ? (
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 11, fill: '#878787' }}
                  label={{ value: 'Age', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#878787' } }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#878787' }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(v) => formatCurrency(String(v))}
                  labelFormatter={(age) => `Age ${age}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E8E8E4', fontSize: '13px', boxShadow: 'none' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {accounts.map((account, i) => (
                  <Line
                    key={account.id}
                    type="monotone"
                    dataKey={`account_${account.id}`}
                    name={account.name}
                    stroke={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            ) : (
              <AreaChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 11, fill: '#878787' }}
                  label={{ value: 'Age', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#878787' } }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#878787' }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(v) => formatCurrency(String(v))}
                  labelFormatter={(age) => `Age ${age}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E8E8E4', fontSize: '13px', boxShadow: 'none' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="assets"
                  name="Assets"
                  stackId="1"
                  stroke="#4A7C44"
                  fill="#4A7C44"
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  name="Net Worth"
                  stroke="#2D5A27"
                  fill="#2D5A27"
                  fillOpacity={0.08}
                  strokeWidth={2}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Monte Carlo */}
      <Card>
        <CardHeader>
          <CardTitle>Monte Carlo Simulation</CardTitle>
          <CardDescription>Regime-aware projection with confidence bands</CardDescription>
        </CardHeader>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex gap-1">
            {[500, 1000, 5000].map((n) => (
              <Button
                key={n}
                variant={iterations === n ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => { setIterations(n); setMonteCarloResult(null) }}
              >
                {n.toLocaleString()}
              </Button>
            ))}
          </div>
          <Button onClick={handleRunMonteCarlo} disabled={isRunning} size="sm">
            {isRunning ? 'Running...' : 'Run Simulation'}
          </Button>
        </div>

        {mcChartData.length > 0 && monteCarloResult && (
          <>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mcChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                  <XAxis
                    dataKey="age"
                    tick={{ fontSize: 11, fill: '#878787' }}
                    label={{ value: 'Age', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#878787' } }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#878787' }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    formatter={(v, name) => {
                      const labels: Record<string, string> = {
                        median: 'Median (p50)',
                        deterministic: 'Deterministic',
                      }
                      const num = typeof v === 'number' ? v : 0
                      const nameStr = String(name ?? '')
                      return [formatCurrency(String(Math.round(num))), labels[nameStr] || nameStr]
                    }}
                    labelFormatter={(age) => `Age ${age}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E8E8E4', fontSize: '13px', boxShadow: 'none' }}
                  />

                  {/* Invisible base at p5 */}
                  <Area
                    type="monotone"
                    dataKey="p5"
                    stackId="mc"
                    fill="transparent"
                    stroke="none"
                  />
                  {/* Lower band: p5 to p25 */}
                  <Area
                    type="monotone"
                    dataKey="band_lower"
                    stackId="mc"
                    fill="#2D5A27"
                    fillOpacity={0.08}
                    stroke="none"
                    name="5th-25th percentile"
                  />
                  {/* Middle band: p25 to p75 */}
                  <Area
                    type="monotone"
                    dataKey="band_middle"
                    stackId="mc"
                    fill="#2D5A27"
                    fillOpacity={0.15}
                    stroke="none"
                    name="25th-75th percentile"
                  />
                  {/* Upper band: p75 to p95 */}
                  <Area
                    type="monotone"
                    dataKey="band_upper"
                    stackId="mc"
                    fill="#2D5A27"
                    fillOpacity={0.08}
                    stroke="none"
                    name="75th-95th percentile"
                  />

                  {/* Median line */}
                  <Line
                    type="monotone"
                    dataKey="median"
                    stroke="#2D5A27"
                    strokeWidth={2}
                    dot={false}
                    name="median"
                  />
                  {/* Deterministic overlay */}
                  <Line
                    type="monotone"
                    dataKey="deterministic"
                    stroke="#878787"
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    dot={false}
                    name="deterministic"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Success Rate</div>
                <div className="text-lg font-semibold tracking-tight mt-0.5">
                  {(monteCarloResult.successRate * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Median Final</div>
                <div className="text-lg font-semibold tracking-tight mt-0.5">
                  {formatCurrency(String(Math.round(monteCarloResult.median[monteCarloResult.median.length - 1]?.netWorth ?? 0)))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Worst Case (5th)</div>
                <div className="text-lg font-semibold tracking-tight mt-0.5 text-danger">
                  {formatCurrency(String(Math.round(monteCarloResult.percentiles.p5[monteCarloResult.percentiles.p5.length - 1]?.netWorth ?? 0)))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Best Case (95th)</div>
                <div className="text-lg font-semibold tracking-tight mt-0.5 text-primary">
                  {formatCurrency(String(Math.round(monteCarloResult.percentiles.p95[monteCarloResult.percentiles.p95.length - 1]?.netWorth ?? 0)))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-text-secondary/60 mt-3">
              Based on {monteCarloResult.iterations.toLocaleString()} simulations with regime-switching market model. Darker bands represent more likely outcomes.
            </p>
          </>
        )}
      </Card>

      {/* Year-by-year table */}
      <Card>
        <CardHeader>
          <CardTitle>Year-by-Year Breakdown</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Age</th>
                <th className="text-left py-2 px-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Year</th>
                <th className="text-right py-2 px-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Assets</th>
                <th className="text-right py-2 px-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Debts</th>
                <th className="text-right py-2 px-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Net Worth</th>
              </tr>
            </thead>
            <tbody>
              {projectionData
                .filter((_, i) => i % 5 === 0 || i === projectionData.length - 1)
                .map((row) => (
                  <tr key={row.age} className="border-b border-border/50 hover:bg-surface-alt transition-colors">
                    <td className="py-2 px-2">{row.age}</td>
                    <td className="py-2 px-2">{row.year}</td>
                    <td className="py-2 px-2 text-right text-primary">{formatCurrency(row.assets.toString())}</td>
                    <td className="py-2 px-2 text-right text-danger">{formatCurrency(row.debts.toString())}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatCurrency(row.netWorth.toString())}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
