import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAccounts, useUserProfile } from '@/db/hooks'
import { formatCurrency } from '@/lib/utils'
import { calculateFirePlan } from '@/engine/retirement/fire-plan'
import { estimateCppBenefitAllAges } from '@/engine/retirement/cpp-benefit'
import { estimateOasBenefit } from '@/engine/retirement/oas-benefit'
import { isDebtType } from '@/types'
import Decimal from 'decimal.js'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { Flame, TrendingUp, Coffee, Leaf, Crown, CheckCircle, AlertTriangle } from 'lucide-react'

const FIRE_ICONS: Record<string, typeof Flame> = {
  lean: Leaf,
  regular: Flame,
  fat: Crown,
  coast: TrendingUp,
  barista: Coffee,
}

const FIRE_COLORS: Record<string, string> = {
  lean: '#4A7C44',
  regular: '#B45309',
  fat: '#B91C1C',
  coast: '#2D5A27',
  barista: '#7C5C3E',
}

const TIMELINE_COLORS = {
  portfolioWithdrawal: '#3b82f6',
  postFireIncome: '#22c55e',
  spouseIncome: '#a855f7',
  cpp: '#f97316',
  oas: '#14b8a6',
}

function generateOptions(start: number, end: number): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = []
  for (let i = start; i <= end; i++) {
    opts.push({ value: String(i), label: String(i) })
  }
  return opts
}

export function Fire() {
  const accounts = useAccounts()
  const profile = useUserProfile()

  const [params, setParams] = useState({
    annualExpenses: '50000',
    postFireSpending: '50000',
    leanExpenses: '35000',
    fatExpenses: '80000',
    annualSavings: '30000',
    targetFireAge: 50,
    lifeExpectancy: 90,
    postFireIncome: '0',
    hasSpouse: false,
    spouseIncome: '0',
    spousePortfolio: '0',
    cppStartAge: 65,
    oasStartAge: 65,
    rrspStartAge: 65,
    withdrawalRate: '0.04',
    inflationRate: '0.02',
  })

  const currentAge = useMemo(() => {
    if (!profile?.dateOfBirth) return 30
    return new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
  }, [profile])

  const { netWorth, rrspBalance, weightedReturnRate } = useMemo(() => {
    let totalAssets = new Decimal(0)
    let totalDebts = new Decimal(0)
    let rrsp = new Decimal(0)
    let weightedSum = new Decimal(0)
    let totalNonDebtBalance = new Decimal(0)

    for (const account of accounts) {
      const balance = new Decimal(account.balance || '0')
      if (isDebtType(account.type)) {
        totalDebts = totalDebts.plus(balance)
      } else {
        totalAssets = totalAssets.plus(balance)
        const rate = new Decimal(account.expectedReturnRate || '0').div(100)
        weightedSum = weightedSum.plus(balance.times(rate))
        totalNonDebtBalance = totalNonDebtBalance.plus(balance)
      }
      if (account.type === 'rrsp') {
        rrsp = rrsp.plus(balance)
      }
    }

    return {
      netWorth: totalAssets.minus(totalDebts),
      rrspBalance: rrsp,
      weightedReturnRate: totalNonDebtBalance.gt(0)
        ? weightedSum.div(totalNonDebtBalance)
        : new Decimal(0.05),
    }
  }, [accounts])

  const plan = useMemo(() => {
    return calculateFirePlan({
      currentAge,
      targetFireAge: params.targetFireAge,
      lifeExpectancy: params.lifeExpectancy,
      currentNetWorth: netWorth,
      annualSavings: new Decimal(params.annualSavings || '0'),
      currentAnnualExpenses: new Decimal(params.annualExpenses || '0'),
      postFireAnnualSpending: new Decimal(params.postFireSpending || '0'),
      leanExpenses: new Decimal(params.leanExpenses || '0'),
      fatExpenses: new Decimal(params.fatExpenses || '0'),
      postFireAnnualIncome: new Decimal(params.postFireIncome || '0'),
      hasSpouse: params.hasSpouse,
      spouseAnnualIncome: new Decimal(params.spouseIncome || '0'),
      spousePortfolio: new Decimal(params.spousePortfolio || '0'),
      cppStartAge: params.cppStartAge,
      oasStartAge: params.oasStartAge,
      rrspWithdrawalStartAge: params.rrspStartAge,
      rrspBalance,
      withdrawalRate: new Decimal(params.withdrawalRate || '0.04'),
      inflationRate: new Decimal(params.inflationRate || '0.02'),
      expectedReturnRate: weightedReturnRate,
      yearsContributedCPP: profile?.yearsContributedCPP || 20,
      province: profile?.province || 'ON',
    })
  }, [currentAge, params, netWorth, rrspBalance, weightedReturnRate, profile])

  // CPP estimates for benefit table
  const cppEstimates = useMemo(() => {
    return estimateCppBenefitAllAges(profile?.yearsContributedCPP || 20, 0.75)
  }, [profile])

  // OAS estimate for benefit table
  const oasEstimate = useMemo(() => {
    return estimateOasBenefit(65, parseFloat(params.postFireSpending) || 50000)
  }, [params.postFireSpending])

  // Chart data from income timeline
  const chartData = useMemo(() => {
    return plan.incomeTimeline.map(year => ({
      age: year.age,
      'Portfolio Withdrawal': year.portfolioWithdrawal.toNumber(),
      'Post-FIRE Income': year.postFireIncome.toNumber(),
      'Spouse Income': year.spouseIncome.toNumber(),
      CPP: year.cppIncome.toNumber(),
      OAS: year.oasIncome.toNumber(),
    }))
  }, [plan])

  const rrspStartOptions = useMemo(() => {
    return generateOptions(Math.max(params.targetFireAge, currentAge + 1), 71)
  }, [params.targetFireAge, currentAge])

  const sectionHeading = 'text-[13px] font-semibold text-text-secondary uppercase tracking-wide mb-2'

  return (
    <div>
      <h1 className="font-serif text-2xl mb-8">FIRE Calculator</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Panel — Inputs */}
        <Card className="lg:col-span-1">
          <div className="space-y-5">
            {/* Section 1: FIRE Goal */}
            <div>
              <h3 className={sectionHeading}>FIRE Goal</h3>
              <div className="space-y-3">
                <Input
                  label="Target FIRE Age"
                  type="number"
                  value={params.targetFireAge.toString()}
                  onChange={e => setParams(p => ({ ...p, targetFireAge: parseInt(e.target.value) || 50 }))}
                />
                <Input
                  label="Life Expectancy"
                  type="number"
                  value={params.lifeExpectancy.toString()}
                  onChange={e => setParams(p => ({ ...p, lifeExpectancy: parseInt(e.target.value) || 90 }))}
                />
              </div>
            </div>

            {/* Section 2: Spending & Saving */}
            <div>
              <h3 className={sectionHeading}>Spending & Saving</h3>
              <div className="space-y-3">
                <Input
                  label="Current Expenses"
                  type="number"
                  value={params.annualExpenses}
                  onChange={e => setParams(p => ({ ...p, annualExpenses: e.target.value }))}
                />
                <Input
                  label="Post-FIRE Spending"
                  type="number"
                  value={params.postFireSpending}
                  onChange={e => setParams(p => ({ ...p, postFireSpending: e.target.value }))}
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
              </div>
            </div>

            {/* Section 3: Income After FIRE */}
            <div>
              <h3 className={sectionHeading}>Income After FIRE</h3>
              <div className="space-y-3">
                <Input
                  label="Post-FIRE Income"
                  type="number"
                  value={params.postFireIncome}
                  onChange={e => setParams(p => ({ ...p, postFireIncome: e.target.value }))}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="has-spouse"
                    checked={params.hasSpouse}
                    onChange={e => setParams(p => ({ ...p, hasSpouse: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <label htmlFor="has-spouse" className="text-[12px] font-medium text-text-secondary uppercase tracking-wide">
                    Include Spouse
                  </label>
                </div>
                {params.hasSpouse && (
                  <>
                    <Input
                      label="Spouse Income"
                      type="number"
                      value={params.spouseIncome}
                      onChange={e => setParams(p => ({ ...p, spouseIncome: e.target.value }))}
                    />
                    <Input
                      label="Spouse Portfolio"
                      type="number"
                      value={params.spousePortfolio}
                      onChange={e => setParams(p => ({ ...p, spousePortfolio: e.target.value }))}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Section 4: Government Benefits */}
            <div>
              <h3 className={sectionHeading}>Government Benefits</h3>
              <div className="space-y-3">
                <Select
                  label="CPP Start Age"
                  value={String(params.cppStartAge)}
                  onChange={e => setParams(p => ({ ...p, cppStartAge: parseInt(e.target.value) }))}
                  options={generateOptions(60, 70)}
                />
                <Select
                  label="OAS Start Age"
                  value={String(params.oasStartAge)}
                  onChange={e => setParams(p => ({ ...p, oasStartAge: parseInt(e.target.value) }))}
                  options={generateOptions(65, 70)}
                />
                {plan.benefitRecommendation && (
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5 text-[11px] text-text-secondary leading-relaxed">
                    Recommended: CPP at {plan.benefitRecommendation.recommendedCppAge}, OAS at {plan.benefitRecommendation.recommendedOasAge}
                  </div>
                )}
              </div>
            </div>

            {/* Section 5: RRSP Strategy */}
            <div>
              <h3 className={sectionHeading}>RRSP Strategy</h3>
              <div className="space-y-3">
                <Select
                  label="Withdrawal Start Age"
                  value={String(params.rrspStartAge)}
                  onChange={e => setParams(p => ({ ...p, rrspStartAge: parseInt(e.target.value) }))}
                  options={rrspStartOptions}
                />
              </div>
            </div>

            {/* Section 6: Assumptions */}
            <div>
              <h3 className={sectionHeading}>Assumptions</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
                    Withdrawal Rate
                  </label>
                  <input
                    type="range"
                    min="0.03"
                    max="0.05"
                    step="0.005"
                    value={params.withdrawalRate}
                    onChange={e => setParams(p => ({ ...p, withdrawalRate: e.target.value }))}
                    className="w-full mt-1"
                  />
                  <span className="text-[11px] text-text-secondary">
                    {(parseFloat(params.withdrawalRate) * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
                    Inflation Rate
                  </label>
                  <input
                    type="range"
                    min="0.01"
                    max="0.05"
                    step="0.005"
                    value={params.inflationRate}
                    onChange={e => setParams(p => ({ ...p, inflationRate: e.target.value }))}
                    className="w-full mt-1"
                  />
                  <span className="text-[11px] text-text-secondary">
                    {(parseFloat(params.inflationRate) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Right Panel — Results */}
        <div className="lg:col-span-3 space-y-4">
          {/* 1. Feasibility Banner */}
          {plan.feasibility.isOnTrack ? (
            <div className="rounded-lg border p-4 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div>
                <div className="text-[14px] font-semibold text-emerald-800 dark:text-emerald-200">
                  On track for FIRE at age {params.targetFireAge}
                </div>
                <div className="text-[12px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Target: {formatCurrency(plan.feasibility.effectiveFireNumber.toString())} | Current: {formatCurrency(plan.feasibility.currentTotal.toString())}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border p-4 flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <div className="text-[14px] font-semibold text-amber-800 dark:text-amber-200">
                  Gap: {formatCurrency(plan.feasibility.gap.toString())} needed
                </div>
                <div className="text-[12px] text-amber-700 dark:text-amber-300 mt-0.5">
                  Target: {formatCurrency(plan.feasibility.effectiveFireNumber.toString())} | Current: {formatCurrency(plan.feasibility.currentTotal.toString())} | Projected FIRE age: {plan.feasibility.projectedFireAge}
                </div>
              </div>
            </div>
          )}

          {/* 2. Enhanced FIRE Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {plan.fireTypes.map(result => {
              const Icon = FIRE_ICONS[result.type]
              const color = FIRE_COLORS[result.type]
              return (
                <Card key={result.type} className="relative overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 h-0.5 transition-all"
                    style={{
                      width: `${Math.min(result.progress * 100, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.75} />
                    <span className="text-[12px] font-semibold capitalize">{result.type}</span>
                  </div>
                  {result.type === 'barista' ? (
                    <>
                      <div className="text-lg font-semibold tracking-tight">
                        {formatCurrency(result.effectiveNumber.toString())}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-1">
                        income needed/yr
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-semibold tracking-tight">
                        {formatCurrency(result.effectiveNumber.toString())}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-1">
                        {result.progress >= 1 ? (
                          <span className="text-primary font-medium">Achieved!</span>
                        ) : result.yearsToFire !== null ? (
                          `${result.yearsToFire} years to go`
                        ) : (
                          'Not on track'
                        )}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-0.5">
                        {(result.progress * 100).toFixed(1)}% complete
                      </div>
                    </>
                  )}
                </Card>
              )
            })}
          </div>

          {/* 3. Income Timeline Stacked Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Income Timeline</CardTitle>
              <CardDescription>Projected income sources from FIRE age to life expectancy</CardDescription>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                  <XAxis
                    dataKey="age"
                    tick={{ fontSize: 11, fill: '#878787' }}
                    label={{ value: 'Age', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#878787' }}
                  />
                  <YAxis
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}K`}
                    tick={{ fontSize: 11, fill: '#878787' }}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(String(Math.round(Number(v))))}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E8E8E4', fontSize: '13px', boxShadow: 'none' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <ReferenceLine x={params.cppStartAge} stroke="#f97316" strokeDasharray="3 3" label={{ value: 'CPP', fontSize: 10, fill: '#f97316' }} />
                  <ReferenceLine x={params.oasStartAge} stroke="#14b8a6" strokeDasharray="3 3" label={{ value: 'OAS', fontSize: 10, fill: '#14b8a6' }} />
                  <Area type="monotone" dataKey="Portfolio Withdrawal" stackId="1" stroke={TIMELINE_COLORS.portfolioWithdrawal} fill={TIMELINE_COLORS.portfolioWithdrawal} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Post-FIRE Income" stackId="1" stroke={TIMELINE_COLORS.postFireIncome} fill={TIMELINE_COLORS.postFireIncome} fillOpacity={0.6} />
                  {params.hasSpouse && (
                    <Area type="monotone" dataKey="Spouse Income" stackId="1" stroke={TIMELINE_COLORS.spouseIncome} fill={TIMELINE_COLORS.spouseIncome} fillOpacity={0.6} />
                  )}
                  <Area type="monotone" dataKey="CPP" stackId="1" stroke={TIMELINE_COLORS.cpp} fill={TIMELINE_COLORS.cpp} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="OAS" stackId="1" stroke={TIMELINE_COLORS.oas} fill={TIMELINE_COLORS.oas} fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 4. RRSP Strategy Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>RRSP Strategy Comparison</CardTitle>
              <CardDescription>Early withdrawal vs deferred to age 71</CardDescription>
            </CardHeader>
            {rrspBalance.eq(0) ? (
              <p className="text-[13px] text-text-secondary">No RRSP accounts found</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {/* Early column */}
                  <div className={`rounded-lg border p-4 ${plan.rrspComparison.recommendEarly ? 'border-primary' : 'border-border'}`}>
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary mb-3">
                      Early (Age {plan.rrspComparison.early.startAge})
                      {plan.rrspComparison.recommendEarly && (
                        <span className="ml-2 text-primary text-[11px] normal-case">Recommended</span>
                      )}
                    </div>
                    <div className="space-y-2 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Balance at Start</span>
                        <span className="font-medium">{formatCurrency(plan.rrspComparison.early.balanceAtStart.toString())}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Annual Withdrawal</span>
                        <span className="font-medium">{formatCurrency(plan.rrspComparison.early.annualWithdrawal.toString())}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Marginal Tax Rate</span>
                        <span className="font-medium">{plan.rrspComparison.early.marginalTaxRate.times(100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2">
                        <span className="font-medium">Total After-Tax</span>
                        <span className="font-semibold">{formatCurrency(plan.rrspComparison.early.totalAfterTaxIncome.toString())}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deferred column */}
                  <div className={`rounded-lg border p-4 ${!plan.rrspComparison.recommendEarly ? 'border-primary' : 'border-border'}`}>
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary mb-3">
                      Deferred (Age {plan.rrspComparison.deferred.startAge})
                      {!plan.rrspComparison.recommendEarly && (
                        <span className="ml-2 text-primary text-[11px] normal-case">Recommended</span>
                      )}
                    </div>
                    <div className="space-y-2 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Balance at Start</span>
                        <span className="font-medium">{formatCurrency(plan.rrspComparison.deferred.balanceAtStart.toString())}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Annual Withdrawal</span>
                        <span className="font-medium">{formatCurrency(plan.rrspComparison.deferred.annualWithdrawal.toString())}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Marginal Tax Rate</span>
                        <span className="font-medium">{plan.rrspComparison.deferred.marginalTaxRate.times(100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2">
                        <span className="font-medium">Total After-Tax</span>
                        <span className="font-semibold">{formatCurrency(plan.rrspComparison.deferred.totalAfterTaxIncome.toString())}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {plan.rrspComparison.oasClawbackWarning && (
                  <div className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Deferred RRSP withdrawals may trigger OAS clawback due to high annual income.
                  </div>
                )}
              </>
            )}
          </Card>

          {/* 5. CPP/OAS Recommendation + Benefit Tables */}
          {plan.benefitRecommendation && (
            <Card>
              <CardHeader>
                <CardTitle>Benefit Recommendation</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Recommended CPP Age</span>
                    <span className="font-semibold">{plan.benefitRecommendation.recommendedCppAge}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Recommended OAS Age</span>
                    <span className="font-semibold">{plan.benefitRecommendation.recommendedOasAge}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">CPP at Recommended</span>
                    <span className="font-semibold">{formatCurrency(plan.benefitRecommendation.monthlyAtRecommended.toString())}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">CPP at 65</span>
                    <span className="font-medium">{formatCurrency(plan.benefitRecommendation.monthlyAt65.toString())}/mo</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-text-secondary">CPP Break-Even Age</span>
                    <span className="font-medium">{plan.benefitRecommendation.cppBreakEvenAge}</span>
                  </div>
                </div>
                <p className="text-[12px] text-text-secondary leading-relaxed">
                  {plan.benefitRecommendation.reasoning}
                </p>
              </div>
            </Card>
          )}

          {/* Benefit Tables */}
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
