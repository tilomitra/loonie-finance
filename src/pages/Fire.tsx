import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAccounts, useUserProfile, useLifeEvents } from '@/db/hooks'
import { formatCurrency } from '@/lib/utils'
import { calculateFirePlan } from '@/engine/retirement/fire-plan'
import { calculateWithdrawalPlan } from '@/engine/retirement/withdrawal-sequence'
import { estimateCppBenefitAllAges } from '@/engine/retirement/cpp-benefit'
import { estimateOasBenefit } from '@/engine/retirement/oas-benefit'
import { isDebtType } from '@/types'
import Decimal from 'decimal.js'
import { AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { ProgressGauge } from '@/components/fire/ProgressGauge'
import { MilestoneTimeline } from '@/components/fire/MilestoneTimeline'
import { NextMilestone } from '@/components/fire/NextMilestone'
import { WithdrawalPlanView } from '@/components/fire/WithdrawalPlanView'

type ViewMode = 'self' | 'partner' | 'household'

const FIRE_CONFIG = {
  coast: { color: '#3b82f6', bg: '#eff6ff', label: 'Coast FIRE' },
  lean: { color: '#22c55e', bg: '#f0fdf4', label: 'Lean FIRE' },
  barista: { color: '#f97316', bg: '#fff7ed', label: 'Barista FIRE' },
  regular: { color: '#a855f7', bg: '#faf5ff', label: 'Regular FIRE' },
  fat: { color: '#ef4444', bg: '#fef2f2', label: 'Fat FIRE' },
} as const

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
  const lifeEvents = useLifeEvents()

  const [viewMode, setViewMode] = useState<ViewMode>('self')
  const [settingsOpen, setSettingsOpen] = useState(false)

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
    let assets = new Decimal(0)
    let debts = new Decimal(0)
    let rrsp = new Decimal(0)
    let weightedSum = new Decimal(0)
    let totalNonDebtBalance = new Decimal(0)

    for (const account of accounts) {
      const balance = new Decimal(account.balance || '0')
      if (isDebtType(account.type)) {
        debts = debts.plus(balance)
      } else {
        assets = assets.plus(balance)
        const rate = new Decimal(account.expectedReturnRate || '0').div(100)
        weightedSum = weightedSum.plus(balance.times(rate))
        totalNonDebtBalance = totalNonDebtBalance.plus(balance)
      }
      if (account.type === 'rrsp') {
        rrsp = rrsp.plus(balance)
      }
    }

    return {
      netWorth: assets.minus(debts),
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

  // Withdrawal plan
  const withdrawalPlan = useMemo(() => {
    if (accounts.length === 0) return null
    try {
      return calculateWithdrawalPlan({
        accounts,
        lifeEvents,
        selfProfile: {
          currentAge,
          province: profile?.province || 'ON',
          yearsContributedCPP: profile?.yearsContributedCPP || 20,
          cppStartAge: params.cppStartAge,
          oasStartAge: params.oasStartAge,
        },
        retirementAge: params.targetFireAge,
        lifeExpectancy: params.lifeExpectancy,
        annualExpenses: new Decimal(params.postFireSpending || '50000'),
        inflationRate: new Decimal(params.inflationRate || '0.02'),
        expectedReturnRate: weightedReturnRate,
      })
    } catch {
      return null
    }
  }, [accounts, lifeEvents, currentAge, profile, params, weightedReturnRate])

  // CPP estimates for benefit table
  const cppEstimates = useMemo(() => {
    return estimateCppBenefitAllAges(profile?.yearsContributedCPP || 20, 0.75)
  }, [profile])

  // OAS estimate
  const oasEstimate = useMemo(() => {
    return estimateOasBenefit(65, parseFloat(params.postFireSpending) || 50000)
  }, [params.postFireSpending])

  const rrspStartOptions = useMemo(() => {
    return generateOptions(Math.max(params.targetFireAge, currentAge + 1), 71)
  }, [params.targetFireAge, currentAge])

  // Determine "next" milestone — lowest progress < 1, not barista
  const nextMilestone = useMemo(() => {
    const candidates = plan.fireTypes
      .filter(t => t.type !== 'barista' && t.progress < 1 && t.effectiveNumber.gt(0))
      .sort((a, b) => b.progress - a.progress)
    return candidates[0] ?? plan.fireTypes.find(t => t.type === 'regular')!
  }, [plan])

  const currentTotal = plan.feasibility.currentTotal.toString()

  const sectionHeading = 'text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl">FIRE Progress</h1>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
          {(['self', 'partner', 'household'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all capitalize ${
                viewMode === mode
                  ? 'bg-text text-surface'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              {mode === 'self' ? 'My Progress' : mode === 'partner' ? 'Partner' : 'Household'}
            </button>
          ))}
        </div>
      </div>

      {/* Partner / Household coming soon */}
      {viewMode !== 'self' && (
        <Card className="mb-6">
          <div className="text-center py-10">
            <Users className="w-10 h-10 text-border mx-auto mb-3" strokeWidth={1.5} />
            <h3 className="font-serif text-lg mb-1">
              {viewMode === 'partner' ? 'Partner View' : 'Household View'} Coming Soon
            </h3>
            <p className="text-text-secondary text-[13px]">
              {viewMode === 'partner'
                ? 'Partner tracking will be available in a future update.'
                : 'Combined household projections are on the roadmap.'}
            </p>
          </div>
        </Card>
      )}

      {viewMode === 'self' && (
        <div className="space-y-5">
          {/* Collapsible Settings */}
          <Card>
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setSettingsOpen(v => !v)}
            >
              <span className="font-semibold text-[14px]">FIRE Settings</span>
              {settingsOpen
                ? <ChevronUp className="w-4 h-4 text-text-secondary" />
                : <ChevronDown className="w-4 h-4 text-text-secondary" />
              }
            </button>

            {settingsOpen && (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                {/* FIRE Goal */}
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

                {/* Spending & Saving */}
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

                {/* Income After FIRE */}
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

                {/* Government Benefits */}
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

                {/* RRSP Strategy */}
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

                {/* Assumptions */}
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
            )}
          </Card>

          {/* ── Next Milestone hero card ── */}
          <NextMilestone
            fireType={nextMilestone}
            currentAge={currentAge}
            currentTotal={currentTotal}
          />

          {/* ── All FIRE Milestones grid ── */}
          <div>
            <h2 className="font-serif text-lg mb-3">All FIRE Milestones</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {plan.fireTypes.map(result => {
                const cfg = FIRE_CONFIG[result.type as keyof typeof FIRE_CONFIG]
                const isNext = result.type === nextMilestone.type
                const isAchieved = result.progress >= 1
                const estimatedAge = result.yearsToFire !== null ? currentAge + result.yearsToFire : null

                if (result.type === 'barista') {
                  return (
                    <ProgressGauge
                      key={result.type}
                      name={cfg.label}
                      progress={0}
                      target={result.effectiveNumber.toString()}
                      estimatedAge={null}
                      color={cfg.color}
                      bgColor={cfg.bg}
                      isBaristaType
                      baristaLabel="income needed/yr"
                    />
                  )
                }

                return (
                  <ProgressGauge
                    key={result.type}
                    name={cfg.label}
                    progress={result.progress}
                    target={result.effectiveNumber.toString()}
                    estimatedAge={estimatedAge}
                    color={cfg.color}
                    bgColor={cfg.bg}
                    isNext={isNext}
                    isAchieved={isAchieved}
                  />
                )
              })}
            </div>
          </div>

          {/* ── Milestone Timeline ── */}
          <Card>
            <CardHeader>
              <CardTitle>Milestone Timeline</CardTitle>
              <CardDescription>When you are projected to reach each FIRE milestone</CardDescription>
            </CardHeader>
            <MilestoneTimeline
              milestones={plan.fireTypes
                .filter(t => t.type !== 'barista')
                .map(t => ({
                  name: FIRE_CONFIG[t.type as keyof typeof FIRE_CONFIG]?.label ?? t.type,
                  age: t.yearsToFire !== null ? currentAge + t.yearsToFire : null,
                  color: FIRE_CONFIG[t.type as keyof typeof FIRE_CONFIG]?.color ?? '#6b7280',
                  progress: t.progress,
                }))}
              currentAge={currentAge}
            />
          </Card>

          {/* ── Withdrawal Plan ── */}
          <Card>
            <CardHeader>
              <CardTitle>Tax-Optimal Withdrawal Plan</CardTitle>
              <CardDescription>Account balances and tax impact over retirement</CardDescription>
            </CardHeader>
            <WithdrawalPlanView plan={withdrawalPlan} accounts={accounts} />
          </Card>

          {/* ── CPP/OAS Recommendations ── */}
          {plan.benefitRecommendation && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Benefit Recommendation</CardTitle>
                </CardHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">CPP Age</span>
                      <span className="font-semibold">{plan.benefitRecommendation.recommendedCppAge}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">OAS Age</span>
                      <span className="font-semibold">{plan.benefitRecommendation.recommendedOasAge}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">CPP Monthly</span>
                      <span className="font-semibold">{formatCurrency(plan.benefitRecommendation.monthlyAtRecommended.toString())}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">CPP at 65</span>
                      <span className="font-medium">{formatCurrency(plan.benefitRecommendation.monthlyAt65.toString())}/mo</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-text-secondary">CPP Break-Even</span>
                      <span className="font-medium">Age {plan.benefitRecommendation.cppBreakEvenAge}</span>
                    </div>
                  </div>
                  <p className="text-[12px] text-text-secondary leading-relaxed">
                    {plan.benefitRecommendation.reasoning}
                  </p>
                </div>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>CPP Estimates</CardTitle>
                    <CardDescription>Monthly benefit by claim age</CardDescription>
                  </CardHeader>
                  <div className="space-y-1.5">
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
                  <div className="space-y-1.5 text-[13px]">
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
          )}

          {/* ── RRSP Meltdown Strategy ── */}
          <Card>
            <CardHeader>
              <CardTitle>RRSP Meltdown Strategy</CardTitle>
              <CardDescription>Early withdrawal vs deferred to age 71</CardDescription>
            </CardHeader>
            {rrspBalance.eq(0) ? (
              <p className="text-[13px] text-text-secondary">No RRSP accounts found</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
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
        </div>
      )}
    </div>
  )
}
