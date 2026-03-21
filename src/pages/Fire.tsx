import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useNetWorth, useUserProfile } from '@/db/hooks'
import { formatCurrency } from '@/lib/utils'
import { calculateAllFireTypes } from '@/engine/retirement/fire'
import { estimateCppBenefitAllAges } from '@/engine/retirement/cpp-benefit'
import { estimateOasBenefit } from '@/engine/retirement/oas-benefit'
import Decimal from 'decimal.js'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Flame, TrendingUp, Coffee, Leaf, Crown } from 'lucide-react'

const FIRE_ICONS = {
  lean: Leaf,
  regular: Flame,
  fat: Crown,
  coast: TrendingUp,
  barista: Coffee,
}

const FIRE_COLORS = {
  lean: '#4A7C44',
  regular: '#B45309',
  fat: '#B91C1C',
  coast: '#2D5A27',
  barista: '#7C5C3E',
}

export function Fire() {
  const { netWorth } = useNetWorth()
  const profile = useUserProfile()

  const [params, setParams] = useState({
    annualExpenses: '50000',
    leanExpenses: '35000',
    fatExpenses: '80000',
    annualSavings: '30000',
    portfolioIncome: '5000',
    retirementAge: 65,
    withdrawalRate: '0.04',
    realReturnRate: '0.07',
  })

  const currentAge = useMemo(() => {
    if (!profile?.dateOfBirth) return 30
    return new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
  }, [profile])

  const yearsToRetirement = Math.max(params.retirementAge - currentAge, 1)

  const fireResults = useMemo(() => {
    return calculateAllFireTypes({
      currentNetWorth: netWorth,
      annualExpenses: new Decimal(params.annualExpenses || '0'),
      leanExpenses: new Decimal(params.leanExpenses || '0'),
      fatExpenses: new Decimal(params.fatExpenses || '0'),
      annualSavings: new Decimal(params.annualSavings || '0'),
      yearsToRetirement,
      portfolioIncome: new Decimal(params.portfolioIncome || '0'),
      withdrawalRate: new Decimal(params.withdrawalRate || '0.04'),
      realReturnRate: new Decimal(params.realReturnRate || '0.07'),
    })
  }, [netWorth, params, yearsToRetirement])

  // CPP estimates
  const cppEstimates = useMemo(() => {
    return estimateCppBenefitAllAges(profile?.yearsContributedCPP || 20, 0.75)
  }, [profile])

  // OAS estimate
  const oasEstimate = useMemo(() => {
    return estimateOasBenefit(65, parseFloat(params.annualExpenses) || 50000)
  }, [params.annualExpenses])

  const chartData = fireResults.map(r => ({
    name: r.type.charAt(0).toUpperCase() + r.type.slice(1),
    target: r.targetNumber.toNumber(),
    current: netWorth.toNumber(),
    progress: r.progress.times(100).toNumber(),
  }))

  return (
    <div>
      <h1 className="font-serif text-2xl mb-8">FIRE Calculator</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Input Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Your Numbers</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <Input
              label="Annual Expenses"
              type="number"
              value={params.annualExpenses}
              onChange={e => setParams(p => ({ ...p, annualExpenses: e.target.value }))}
            />
            <Input
              label="Lean Expenses"
              type="number"
              value={params.leanExpenses}
              onChange={e => setParams(p => ({ ...p, leanExpenses: e.target.value }))}
            />
            <Input
              label="Fat Expenses"
              type="number"
              value={params.fatExpenses}
              onChange={e => setParams(p => ({ ...p, fatExpenses: e.target.value }))}
            />
            <Input
              label="Annual Savings"
              type="number"
              value={params.annualSavings}
              onChange={e => setParams(p => ({ ...p, annualSavings: e.target.value }))}
            />
            <Input
              label="Portfolio Income"
              type="number"
              value={params.portfolioIncome}
              onChange={e => setParams(p => ({ ...p, portfolioIncome: e.target.value }))}
            />
            <Input
              label="Retirement Age"
              type="number"
              value={params.retirementAge.toString()}
              onChange={e => setParams(p => ({ ...p, retirementAge: parseInt(e.target.value) || 65 }))}
            />
            <div>
              <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">Withdrawal Rate</label>
              <input
                type="range"
                min="0.03"
                max="0.05"
                step="0.005"
                value={params.withdrawalRate}
                onChange={e => setParams(p => ({ ...p, withdrawalRate: e.target.value }))}
                className="w-full mt-1"
              />
              <span className="text-[11px] text-text-secondary">{(parseFloat(params.withdrawalRate) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {/* FIRE Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {fireResults.map(result => {
              const Icon = FIRE_ICONS[result.type]
              const color = FIRE_COLORS[result.type]
              return (
                <Card key={result.type} className="relative overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 h-0.5 transition-all"
                    style={{
                      width: `${result.progress.times(100).toNumber()}%`,
                      backgroundColor: color,
                    }}
                  />
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.75} />
                    <span className="text-[12px] font-semibold capitalize">{result.type}</span>
                  </div>
                  <div className="text-lg font-semibold tracking-tight">
                    {formatCurrency(result.targetNumber.toString())}
                  </div>
                  <div className="text-[11px] text-text-secondary mt-1">
                    {result.isAchieved ? (
                      <span className="text-primary font-medium">Achieved!</span>
                    ) : result.yearsToFire !== null ? (
                      `${result.yearsToFire} years to go`
                    ) : (
                      'Not on track'
                    )}
                  </div>
                  <div className="text-[11px] text-text-secondary mt-0.5">
                    {result.progress.times(100).toFixed(1)}% complete
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Progress Chart */}
          <Card>
            <CardHeader>
              <CardTitle>FIRE Progress</CardTitle>
              <CardDescription>Current net worth vs target for each FIRE type</CardDescription>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                  <XAxis
                    type="number"
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}K`}
                    tick={{ fontSize: 11, fill: '#878787' }}
                  />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#878787' }} width={70} />
                  <Tooltip
                    formatter={(v) => formatCurrency(String(v))}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E8E8E4', fontSize: '13px', boxShadow: 'none' }}
                  />
                  <Bar dataKey="target" name="Target" fill="#E8E8E4" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill="#E8E8E4" />
                    ))}
                  </Bar>
                  <Bar dataKey="current" name="Current" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={Object.values(FIRE_COLORS)[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Government Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>CPP Estimates</CardTitle>
                <CardDescription>Estimated monthly benefit by claim age</CardDescription>
              </CardHeader>
              <div className="space-y-2">
                {cppEstimates.filter((_, i) => i % 2 === 0 || i === cppEstimates.length - 1).map(est => (
                  <div key={est.claimAge} className="flex justify-between text-[13px]">
                    <span className="text-text-secondary">Age {est.claimAge}</span>
                    <span className="font-medium">{formatCurrency(est.monthlyBenefit.toString())}/mo</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>OAS Estimate</CardTitle>
                <CardDescription>At age 65 with current income</CardDescription>
              </CardHeader>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Gross Monthly</span>
                  <span className="font-medium">{formatCurrency(oasEstimate.grossMonthlyBenefit.toString())}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Clawback</span>
                  <span className="font-medium text-danger">-{formatCurrency(oasEstimate.clawbackAmount.toString())}/mo</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-medium">Net Monthly</span>
                  <span className="font-semibold text-primary">{formatCurrency(oasEstimate.netMonthlyBenefit.toString())}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Net Annual</span>
                  <span className="font-medium">{formatCurrency(oasEstimate.netAnnualBenefit.toString())}/yr</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
