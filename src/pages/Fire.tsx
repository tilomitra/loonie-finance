import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAccounts, useUserProfile, useLifeEvents } from '@/db/hooks'
import { db } from '@/db/database'
import { calculateFirePlan } from '@/engine/retirement/fire-plan'
import { estimateCppBenefit } from '@/engine/retirement/cpp-benefit'
import { estimateOasBenefit } from '@/engine/retirement/oas-benefit'
import { isDebtType } from '@/types'
import Decimal from 'decimal.js'
import { ChevronDown, ChevronUp, Users } from 'lucide-react'
import { ProgressGauge } from '@/components/fire/ProgressGauge'
import { FireDetailBreakdown, type IncomeBreakdownData } from '@/components/fire/FireDetailBreakdown'
import { MilestoneTimeline } from '@/components/fire/MilestoneTimeline'
import { NextMilestone } from '@/components/fire/NextMilestone'
import { YearlyBreakdown } from '@/components/fire/YearlyBreakdown'
import { StatusStrip } from '@/components/fire/StatusStrip'
import { LifeEventsSection } from '@/components/fire/LifeEventsSection'

type ViewMode = 'self' | 'partner' | 'household'

const STORAGE_KEY = 'loonie-fire-settings'

const DEFAULT_PARAMS = {
  annualExpenses: '50000',
  postFireSpending: '50000',
  leanExpenses: '35000',
  fatExpenses: '80000',
  annualSavings: '30000',
  annualIncome: '85000',
  targetFireAge: 50,
  lifeExpectancy: 90,
  postFireIncome: '0',
  hasSpouse: false,
  spouseIncome: '0',
  spousePortfolio: '0',
  cppStartAge: 65,
  oasStartAge: 65,
  rrspStartAge: 65,
  yearsContributedCPP: 20,
  withdrawalRate: '0.04',
  inflationRate: '0.02',
  tfsaCumulativeContributions: '',
  rrspCumulativeContributions: '',
  fhsaCumulativeContributions: '',
  fhsaFirstHomeOwner: true,
}

type FireParams = typeof DEFAULT_PARAMS

function loadParams(): FireParams {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_PARAMS, ...parsed }
    }
  } catch {}
  return { ...DEFAULT_PARAMS }
}

function saveParams(params: FireParams) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(params))
}

const ACCENT = '#E8680C'
const ACHIEVED = '#6B8F71'

const FIRE_CONFIG = {
  barista: { label: 'Barista FIRE' },
  coast: { label: 'Coast FIRE' },
  lean: { label: 'Lean FIRE' },
  regular: { label: 'FIRE' },
  fat: { label: 'Fat FIRE' },
} as const

function fireColor(achieved: boolean) {
  return achieved ? ACHIEVED : ACCENT
}

function fireBg(achieved: boolean) {
  return achieved ? '#6B8F7108' : '#E8680C08'
}

const FIRE_ORDER: (keyof typeof FIRE_CONFIG)[] = ['barista', 'coast', 'lean', 'regular', 'fat']

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
  const [selectedFireType, setSelectedFireType] = useState<string | null>(null)

  const [params, setParams] = useState<FireParams>(loadParams)
  const [draft, setDraft] = useState<FireParams>(loadParams)
  const [isDirty, setIsDirty] = useState(false)
  const profileSeeded = useRef(false)

  // Seed profile fields into draft on first profile load (if not already in localStorage)
  useEffect(() => {
    if (profile && !profileSeeded.current) {
      profileSeeded.current = true
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        // No saved FIRE settings — seed from profile
        const seeded: Partial<FireParams> = {
          annualIncome: profile.annualIncome || DEFAULT_PARAMS.annualIncome,
          yearsContributedCPP: profile.yearsContributedCPP || DEFAULT_PARAMS.yearsContributedCPP,
          tfsaCumulativeContributions: profile.tfsaCumulativeContributions || '',
          rrspCumulativeContributions: profile.rrspCumulativeContributions || '',
          fhsaCumulativeContributions: profile.fhsaCumulativeContributions || '',
          fhsaFirstHomeOwner: profile.fhsaFirstHomeOwner ?? true,
        }
        setDraft(d => ({ ...d, ...seeded }))
        setParams(p => ({ ...p, ...seeded }))
      }
    }
  }, [profile])

  const updateDraft = useCallback((updater: (prev: FireParams) => FireParams) => {
    setDraft(prev => {
      const next = updater(prev)
      setIsDirty(true)
      return next
    })
  }, [])

  const handleCalculate = useCallback(() => {
    setParams(draft)
    saveParams(draft)
    setIsDirty(false)

    // Sync profile fields back to Dexie so other features (AI advisor, contribution room) stay current
    if (profile) {
      const now = Date.now()
      db.userProfile.put({
        ...profile,
        annualIncome: draft.annualIncome,
        yearsContributedCPP: draft.yearsContributedCPP,
        tfsaCumulativeContributions: draft.tfsaCumulativeContributions,
        rrspCumulativeContributions: draft.rrspCumulativeContributions,
        fhsaCumulativeContributions: draft.fhsaCumulativeContributions,
        fhsaFirstHomeOwner: draft.fhsaFirstHomeOwner,
        updatedAt: now,
      })
    }
  }, [draft, profile])

  const currentAge = useMemo(() => {
    if (!profile?.dateOfBirth) return 30
    return new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
  }, [profile])

  const { netWorth, totalAssets, totalDebts, rrspBalance, weightedReturnRate } = useMemo(() => {
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
      totalAssets: assets,
      totalDebts: debts,
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
      currentNetWorth: totalAssets,
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
      yearsContributedCPP: params.yearsContributedCPP,
      province: profile?.province || 'ON',
    })
  }, [currentAge, params, netWorth, rrspBalance, weightedReturnRate, profile])



  // CPP/OAS monthly estimates for income breakdown
  const govtBenefits = useMemo(() => {
    const cpp = estimateCppBenefit(params.cppStartAge, profile?.yearsContributedCPP || 20, 0.75)
    const oas = estimateOasBenefit(params.oasStartAge, parseFloat(params.postFireSpending) || 50000)
    return {
      monthlyCpp: cpp.monthlyBenefit.toNumber(),
      monthlyOas: oas.netMonthlyBenefit.toNumber(),
    }
  }, [params.cppStartAge, params.oasStartAge, params.postFireSpending, profile])

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

  // StatusStrip derived values
  const savingsRate = useMemo(() => {
    const income = parseFloat(params.annualExpenses) + parseFloat(params.annualSavings || '0')
    if (income <= 0) return null
    return (parseFloat(params.annualSavings || '0') / income) * 100
  }, [params.annualExpenses, params.annualSavings])

  const yearsToFire = useMemo(() => {
    return plan.fireTypes.find(t => t.type === 'regular')?.yearsToFire ?? null
  }, [plan])

  const monthlyContributions = useMemo(() => {
    return new Decimal(params.annualSavings || '0').div(12).toString()
  }, [params.annualSavings])


  const sectionHeading = 'text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[14px] font-bold uppercase tracking-widest">FIRE Progress</h1>

        {/* View toggle */}
        <div className="flex items-center gap-0 border border-border">
          {(['self', 'partner', 'household'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-[11px] font-medium transition-all uppercase tracking-wide border-r border-border last:border-r-0 ${
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

      {/* Status Strip */}
      <div className="mb-6">
        <StatusStrip
          netWorth={netWorth.toString()}
          totalAssets={totalAssets.toString()}
          totalDebts={totalDebts.toString()}
          savingsRate={savingsRate}
          yearsToFire={yearsToFire}
          monthlyContributions={monthlyContributions}
        />
      </div>

      {/* Partner / Household coming soon */}
      {viewMode !== 'self' && (
        <Card className="mb-6">
          <div className="text-center py-10">
            <Users className="w-10 h-10 text-border mx-auto mb-3" strokeWidth={1.5} />
            <h3 className="text-[13px] font-semibold uppercase tracking-widest mb-1">
              {viewMode === 'partner' ? 'Partner View' : 'Household View'} Coming Soon
            </h3>
            <p className="text-text-secondary text-[12px]">
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
              <span className="text-[11px] font-semibold uppercase tracking-widest">FIRE Settings</span>
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
                      value={draft.targetFireAge.toString()}
                      onChange={e => updateDraft(p => ({ ...p, targetFireAge: parseInt(e.target.value) || 50 }))}
                    />
                    <Input
                      label="Life Expectancy"
                      type="number"
                      value={draft.lifeExpectancy.toString()}
                      onChange={e => updateDraft(p => ({ ...p, lifeExpectancy: parseInt(e.target.value) || 90 }))}
                    />
                  </div>
                </div>

                {/* Income & CPP */}
                <div>
                  <h3 className={sectionHeading}>Income & CPP</h3>
                  <div className="space-y-3">
                    <Input
                      label="Annual Income"
                      type="number"
                      value={draft.annualIncome}
                      onChange={e => updateDraft(p => ({ ...p, annualIncome: e.target.value }))}
                      placeholder="e.g., 85000"
                    />
                    <Input
                      label="Years Contributed to CPP"
                      type="number"
                      value={draft.yearsContributedCPP.toString()}
                      onChange={e => updateDraft(p => ({ ...p, yearsContributedCPP: parseInt(e.target.value) || 0 }))}
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
                      value={draft.annualExpenses}
                      onChange={e => updateDraft(p => ({ ...p, annualExpenses: e.target.value }))}
                    />
                    <Input
                      label="Post-FIRE Spending"
                      type="number"
                      value={draft.postFireSpending}
                      onChange={e => updateDraft(p => ({ ...p, postFireSpending: e.target.value }))}
                    />
                    <Input
                      label="Lean Expenses"
                      type="number"
                      value={draft.leanExpenses}
                      onChange={e => updateDraft(p => ({ ...p, leanExpenses: e.target.value }))}
                    />
                    <Input
                      label="Fat Expenses"
                      type="number"
                      value={draft.fatExpenses}
                      onChange={e => updateDraft(p => ({ ...p, fatExpenses: e.target.value }))}
                    />
                    <Input
                      label="Annual Savings"
                      type="number"
                      value={draft.annualSavings}
                      onChange={e => updateDraft(p => ({ ...p, annualSavings: e.target.value }))}
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
                      value={draft.postFireIncome}
                      onChange={e => updateDraft(p => ({ ...p, postFireIncome: e.target.value }))}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="has-spouse"
                        checked={draft.hasSpouse}
                        onChange={e => updateDraft(p => ({ ...p, hasSpouse: e.target.checked }))}
                        className="rounded border-border"
                      />
                      <label htmlFor="has-spouse" className="text-[12px] font-medium text-text-secondary uppercase tracking-wide">
                        Include Spouse
                      </label>
                    </div>
                    {draft.hasSpouse && (
                      <>
                        <Input
                          label="Spouse Income"
                          type="number"
                          value={draft.spouseIncome}
                          onChange={e => updateDraft(p => ({ ...p, spouseIncome: e.target.value }))}
                        />
                        <Input
                          label="Spouse Portfolio"
                          type="number"
                          value={draft.spousePortfolio}
                          onChange={e => updateDraft(p => ({ ...p, spousePortfolio: e.target.value }))}
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
                      value={String(draft.cppStartAge)}
                      onChange={e => updateDraft(p => ({ ...p, cppStartAge: parseInt(e.target.value) }))}
                      options={generateOptions(60, 70)}
                    />
                    <Select
                      label="OAS Start Age"
                      value={String(draft.oasStartAge)}
                      onChange={e => updateDraft(p => ({ ...p, oasStartAge: parseInt(e.target.value) }))}
                      options={generateOptions(65, 70)}
                    />
                    {plan.benefitRecommendation && (
                      <div className="border border-border p-2.5 text-[10px] text-text-secondary leading-relaxed">
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
                      value={String(draft.rrspStartAge)}
                      onChange={e => updateDraft(p => ({ ...p, rrspStartAge: parseInt(e.target.value) }))}
                      options={rrspStartOptions}
                    />
                  </div>
                </div>

                {/* Registered Accounts */}
                <div>
                  <h3 className={sectionHeading}>Registered Accounts</h3>
                  <div className="space-y-3">
                    <Input
                      label="TFSA Cumulative Contributions"
                      type="number"
                      value={draft.tfsaCumulativeContributions}
                      onChange={e => updateDraft(p => ({ ...p, tfsaCumulativeContributions: e.target.value }))}
                      placeholder="e.g., 75000"
                    />
                    <Input
                      label="RRSP Cumulative Contributions"
                      type="number"
                      value={draft.rrspCumulativeContributions}
                      onChange={e => updateDraft(p => ({ ...p, rrspCumulativeContributions: e.target.value }))}
                      placeholder="e.g., 50000"
                    />
                    <Input
                      label="FHSA Cumulative Contributions"
                      type="number"
                      value={draft.fhsaCumulativeContributions}
                      onChange={e => updateDraft(p => ({ ...p, fhsaCumulativeContributions: e.target.value }))}
                      placeholder="e.g., 8000"
                    />
                    <label className="flex items-center gap-2 text-[11px] uppercase tracking-wide">
                      <input
                        type="checkbox"
                        checked={draft.fhsaFirstHomeOwner}
                        onChange={e => updateDraft(p => ({ ...p, fhsaFirstHomeOwner: e.target.checked }))}
                      />
                      First-time home buyer (FHSA eligible)
                    </label>
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
                        value={draft.withdrawalRate}
                        onChange={e => updateDraft(p => ({ ...p, withdrawalRate: e.target.value }))}
                        className="w-full mt-1"
                      />
                      <span className="text-[11px] text-text-secondary">
                        {(parseFloat(draft.withdrawalRate) * 100).toFixed(1)}%
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
                        value={draft.inflationRate}
                        onChange={e => updateDraft(p => ({ ...p, inflationRate: e.target.value }))}
                        className="w-full mt-1"
                      />
                      <span className="text-[11px] text-text-secondary">
                        {(parseFloat(draft.inflationRate) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Calculate Button */}
                <div className="sm:col-span-2 lg:col-span-3 pt-2">
                  <button
                    onClick={handleCalculate}
                    disabled={!isDirty}
                    className={`w-full py-2.5 text-[11px] font-semibold uppercase tracking-widest transition-all ${
                      isDirty
                        ? 'bg-text text-surface hover:opacity-90'
                        : 'bg-border text-text-secondary cursor-not-allowed'
                    }`}
                  >
                    {isDirty ? 'Calculate' : 'Up to date'}
                  </button>
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
            <h2 className="text-[11px] font-semibold uppercase tracking-widest mb-3">All FIRE Milestones</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border border-border divide-x divide-border">
              {FIRE_ORDER.map(type => plan.fireTypes.find(t => t.type === type)!).map(result => {
                const cfg = FIRE_CONFIG[result.type as keyof typeof FIRE_CONFIG]
                const isNext = result.type === nextMilestone.type
                const isAchieved = result.progress >= 1
                const estimatedAge = result.yearsToFire !== null ? currentAge + result.yearsToFire : null
                const handleClick = () => setSelectedFireType(
                  selectedFireType === result.type ? null : result.type
                )

                if (result.type === 'barista') {
                  return (
                    <ProgressGauge
                      key={result.type}
                      name={cfg.label}
                      progress={0}
                      target={result.effectiveNumber.toString()}
                      estimatedAge={null}
                      color={fireColor(false)}
                      bgColor={fireBg(false)}
                      isBaristaType
                      baristaLabel="income needed/yr"
                      isSelected={selectedFireType === result.type}
                      onClick={handleClick}
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
                    color={fireColor(isAchieved)}
                    bgColor={fireBg(isAchieved)}
                    isNext={isNext}
                    isAchieved={isAchieved}
                    isSelected={selectedFireType === result.type}
                    onClick={handleClick}
                  />
                )
              })}
            </div>

            {/* ── Expanded detail breakdown ── */}
            {selectedFireType && (() => {
              const result = plan.fireTypes.find(t => t.type === selectedFireType)
              if (!result) return null
              const cfg = FIRE_CONFIG[result.type as keyof typeof FIRE_CONFIG]
              const isAchieved = result.progress >= 1
              const regularTarget = plan.fireTypes.find(t => t.type === 'regular')
              const wr = parseFloat(params.withdrawalRate) || 0.04

              // Map FIRE type to the spending level & portfolio for income breakdown
              const spendingByType: Record<string, number> = {
                lean: parseFloat(params.leanExpenses) || 0,
                regular: parseFloat(params.postFireSpending) || 0,
                fat: parseFloat(params.fatExpenses) || 0,
                coast: parseFloat(params.postFireSpending) || 0,
                barista: parseFloat(params.postFireSpending) || 0,
              }
              // For coast, the portfolio at retirement is the regular target (what it grows to)
              const portfolioByType: Record<string, number> = {
                lean: plan.fireTypes.find(t => t.type === 'lean')?.effectiveNumber.toNumber() || 0,
                regular: regularTarget?.effectiveNumber.toNumber() || 0,
                fat: plan.fireTypes.find(t => t.type === 'fat')?.effectiveNumber.toNumber() || 0,
                coast: regularTarget?.effectiveNumber.toNumber() || 0,
                barista: regularTarget?.effectiveNumber.toNumber() || 0,
              }

              const incomeBreakdown: IncomeBreakdownData = {
                monthlyCpp: govtBenefits.monthlyCpp,
                monthlyOas: govtBenefits.monthlyOas,
                withdrawalRate: wr,
                annualSpending: spendingByType[result.type] ?? 0,
                portfolioAtRetirement: portfolioByType[result.type] ?? 0,
              }

              return (
                <div className="mt-3">
                  <FireDetailBreakdown
                    type={result.type}
                    label={cfg.label}
                    color={fireColor(isAchieved)}
                    bgColor={fireBg(isAchieved)}
                    currentPortfolio={currentTotal}
                    targetNumber={result.effectiveNumber.toString()}
                    progress={result.progress}
                    yearsToFire={result.yearsToFire}
                    requiredAtRetirement={result.type === 'coast' ? regularTarget?.effectiveNumber.toString() : undefined}
                    incomeBreakdown={incomeBreakdown}
                  />
                </div>
              )
            })()}
          </div>

          {/* ── Milestone Timeline ── */}
          <Card>
            <CardHeader>
              <CardTitle>Milestone Timeline</CardTitle>
              <CardDescription>When you are projected to reach each FIRE milestone</CardDescription>
            </CardHeader>
            <MilestoneTimeline
              milestones={FIRE_ORDER
                .filter(type => type !== 'barista')
                .map(type => plan.fireTypes.find(t => t.type === type)!)
                .map(t => ({
                  name: FIRE_CONFIG[t.type as keyof typeof FIRE_CONFIG]?.label ?? t.type,
                  age: t.yearsToFire !== null ? currentAge + t.yearsToFire : null,
                  color: fireColor(t.progress >= 1),
                  progress: t.progress,
                }))}
              currentAge={currentAge}
            />
          </Card>


          {/* ── Yearly Breakdown ── */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Growth Projection</CardTitle>
              <CardDescription>Year-by-year breakdown from now to retirement</CardDescription>
            </CardHeader>
            <YearlyBreakdown
              currentAge={currentAge}
              retirementAge={params.targetFireAge}
              currentPortfolio={totalAssets}
              annualContributions={new Decimal(params.annualSavings || '0')}
              expectedReturnRate={weightedReturnRate}
              inflationRate={new Decimal(params.inflationRate || '0.02')}
              fireTargets={plan.fireTypes.map(t => ({
                type: t.type,
                label: FIRE_CONFIG[t.type as keyof typeof FIRE_CONFIG]?.label ?? t.type,
                effectiveNumber: t.effectiveNumber,
              }))}
            />
          </Card>

          {/* ── Life Events ── */}
          <LifeEventsSection lifeEvents={lifeEvents} />

        </div>
      )}
    </div>
  )
}
