import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAccounts, useUserProfile, useScenarios } from '@/db/hooks'
import { db } from '@/db/database'
import { formatCurrency, generateId } from '@/lib/utils'
import { projectNetWorth } from '@/engine/projection/project-net-worth'
import type { ScenarioAssumptions, Province } from '@/types'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line } from 'recharts'
import { Plus, TrendingUp } from 'lucide-react'
import { runMonteCarloSimulation, type MonteCarloResult } from '@/engine/projection/monte-carlo'

const provinceOptions = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'NW Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'PEI' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
]

const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  inflationRate: '0.02',
  salaryGrowthRate: '0.03',
  retirementAge: 65,
  lifeExpectancy: 90,
  cppStartAge: 65,
  oasStartAge: 65,
  province: 'ON',
  annualIncome: '80000',
  annualExpenses: '50000',
  annualSavingsRate: '0.20',
  monthlyContributions: [],
}

export function Projections() {
  const accounts = useAccounts()
  const profile = useUserProfile()
  const scenarios = useScenarios()

  const [assumptions, setAssumptions] = useState<ScenarioAssumptions>(DEFAULT_ASSUMPTIONS)
  const [scenarioName, setScenarioName] = useState('Base Scenario')
  const [mcIterations, setMcIterations] = useState(1000)
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null)
  const [mcRunning, setMcRunning] = useState(false)

  const currentAge = useMemo(() => {
    if (!profile?.dateOfBirth) return 30
    const birthYear = new Date(profile.dateOfBirth).getFullYear()
    return new Date().getFullYear() - birthYear
  }, [profile])

  const projectionData = useMemo(() => {
    if (accounts.length === 0) return []

    const points = projectNetWorth({
      accounts,
      assumptions,
      currentAge,
      startYear: new Date().getFullYear(),
    })

    return points.map(p => ({
      age: p.age,
      year: p.year,
      netWorth: p.netWorth.toNumber(),
      assets: p.totalAssets.toNumber(),
      debts: p.totalDebts.toNumber(),
    }))
  }, [accounts, assumptions, currentAge])

  const handleSaveScenario = async () => {
    const id = generateId()
    await db.scenarios.add({
      id,
      name: scenarioName,
      isDefault: scenarios.length === 0 ? true : false,
      assumptions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const updateAssumption = <K extends keyof ScenarioAssumptions>(
    key: K,
    value: ScenarioAssumptions[K]
  ) => {
    setAssumptions(prev => ({ ...prev, [key]: value }))
  }

  const handleRunMonteCarlo = () => {
    setMcRunning(true)
    setTimeout(() => {
      const result = runMonteCarloSimulation({
        accounts,
        assumptions,
        currentAge,
        startYear: new Date().getFullYear(),
        iterations: mcIterations,
      })
      setMcResult(result)
      setMcRunning(false)
    }, 10)
  }

  const mcChartData = useMemo(() => {
    if (!mcResult) return []

    return mcResult.percentiles.p5.map((point, i) => {
      const p5 = mcResult.percentiles.p5[i].netWorth
      const p25 = mcResult.percentiles.p25[i].netWorth
      const p75 = mcResult.percentiles.p75[i].netWorth
      const p95 = mcResult.percentiles.p95[i].netWorth
      const p50 = mcResult.percentiles.p50[i].netWorth

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
  }, [mcResult, projectionData])

  if (accounts.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-2xl mb-8">Projections</h1>
        <Card>
          <div className="text-center py-12">
            <TrendingUp className="w-10 h-10 text-border mx-auto mb-3" strokeWidth={1.5} />
            <h3 className="font-serif text-lg mb-1">Add accounts first</h3>
            <p className="text-text-secondary text-[13px]">
              Add your accounts to start projecting your net worth growth.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl">Net Worth Projections</h1>
        <div className="flex items-center gap-2">
          <Input
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Scenario name"
            className="w-48"
          />
          <Button onClick={handleSaveScenario} size="sm">
            <Plus className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Assumptions Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
            <CardDescription>Adjust your projection parameters</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">Inflation</label>
              <input
                type="range"
                min="0"
                max="0.06"
                step="0.005"
                value={assumptions.inflationRate}
                onChange={(e) => updateAssumption('inflationRate', e.target.value)}
                className="w-full mt-1"
              />
              <span className="text-[11px] text-text-secondary">{(parseFloat(assumptions.inflationRate) * 100).toFixed(1)}%</span>
            </div>
            <Input
              label="Retirement Age"
              type="number"
              value={assumptions.retirementAge.toString()}
              onChange={(e) => updateAssumption('retirementAge', parseInt(e.target.value) || 65)}
            />
            <Input
              label="Life Expectancy"
              type="number"
              value={assumptions.lifeExpectancy.toString()}
              onChange={(e) => updateAssumption('lifeExpectancy', parseInt(e.target.value) || 90)}
            />
            <Input
              label="Annual Income"
              type="number"
              value={assumptions.annualIncome}
              onChange={(e) => updateAssumption('annualIncome', e.target.value)}
            />
            <Input
              label="Annual Expenses"
              type="number"
              value={assumptions.annualExpenses}
              onChange={(e) => updateAssumption('annualExpenses', e.target.value)}
            />
            <Select
              label="Province"
              value={assumptions.province}
              onChange={(e) => updateAssumption('province', e.target.value as Province)}
              options={provinceOptions}
            />
          </div>
        </Card>

        {/* Chart */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Net Worth Projection</CardTitle>
              <CardDescription>
                Projected growth from age {currentAge} to {assumptions.lifeExpectancy}
              </CardDescription>
            </CardHeader>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
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
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Monte Carlo Simulation */}
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
                    variant={mcIterations === n ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => { setMcIterations(n); setMcResult(null) }}
                  >
                    {n.toLocaleString()}
                  </Button>
                ))}
              </div>
              <Button onClick={handleRunMonteCarlo} disabled={mcRunning} size="sm">
                {mcRunning ? 'Running...' : 'Run Simulation'}
              </Button>
            </div>

            {mcChartData.length > 0 && (
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
                      {(mcResult!.successRate * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Median Final</div>
                    <div className="text-lg font-semibold tracking-tight mt-0.5">
                      {formatCurrency(String(Math.round(mcResult!.median[mcResult!.median.length - 1]?.netWorth ?? 0)))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Worst Case (5th)</div>
                    <div className="text-lg font-semibold tracking-tight mt-0.5 text-danger">
                      {formatCurrency(String(Math.round(mcResult!.percentiles.p5[mcResult!.percentiles.p5.length - 1]?.netWorth ?? 0)))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Best Case (95th)</div>
                    <div className="text-lg font-semibold tracking-tight mt-0.5 text-primary">
                      {formatCurrency(String(Math.round(mcResult!.percentiles.p95[mcResult!.percentiles.p95.length - 1]?.netWorth ?? 0)))}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-text-secondary/60 mt-3">
                  Based on {mcResult!.iterations.toLocaleString()} simulations with regime-switching market model. Darker bands represent more likely outcomes.
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
                  {projectionData.filter((_, i) => i % 5 === 0 || i === projectionData.length - 1).map((row) => (
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
      </div>
    </div>
  )
}
