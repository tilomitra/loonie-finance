import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import Decimal from 'decimal.js'
import type { Account } from '@/types'
import { isDebtType } from '@/types'

interface YearlyBreakdownProps {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  accounts: Account[]
  annualSavings: Decimal
  annualExpenses: Decimal
  inflationRate: Decimal
  fireTargets: {
    type: string
    label: string
    effectiveNumber: Decimal
  }[]
}

interface ProjectionRow {
  year: number
  age: number
  totalAssets: Decimal
  totalDebts: Decimal
  netWorth: Decimal
  fireNumber: Decimal
  status: string
}

export function YearlyBreakdown({
  currentAge,
  retirementAge,
  lifeExpectancy,
  accounts,
  annualSavings,
  annualExpenses,
  inflationRate,
  fireTargets,
}: YearlyBreakdownProps) {
  const regularTarget = fireTargets.find(t => t.type === 'regular')

  // Compute weighted return rate from asset accounts
  const weightedReturnRate = useMemo(() => {
    let weightedSum = new Decimal(0)
    let totalAssetBalance = new Decimal(0)
    for (const account of accounts) {
      if (!isDebtType(account.type)) {
        const bal = new Decimal(account.balance || '0')
        const rate = new Decimal(account.expectedReturnRate || '0').div(100)
        weightedSum = weightedSum.plus(bal.times(rate))
        totalAssetBalance = totalAssetBalance.plus(bal)
      }
    }
    return totalAssetBalance.gt(0) ? weightedSum.div(totalAssetBalance) : new Decimal(0.05)
  }, [accounts])

  const realReturn = weightedReturnRate.minus(inflationRate)

  const projection = useMemo(() => {
    const rows: ProjectionRow[] = []
    const startYear = new Date().getFullYear()

    // Initialize per-account balances
    const balances: Record<string, Decimal> = {}
    for (const account of accounts) {
      balances[account.id] = new Decimal(account.balance || '0')
    }

    // Distribute annual savings proportionally across asset accounts by balance
    const assetAccounts = accounts.filter(a => !isDebtType(a.type))
    const debtAccounts = accounts.filter(a => isDebtType(a.type))

    let fireAchievedYear: number | null = null

    for (let i = 0; i <= lifeExpectancy - currentAge; i++) {
      const age = currentAge + i
      const year = startYear + i

      // Sum assets and debts from per-account balances
      let totalAssets = new Decimal(0)
      let totalDebts = new Decimal(0)
      for (const account of accounts) {
        const bal = balances[account.id]
        if (isDebtType(account.type)) {
          totalDebts = totalDebts.plus(bal)
        } else {
          totalAssets = totalAssets.plus(bal)
        }
      }
      const netWorth = totalAssets.minus(totalDebts)

      // FIRE number for this year = target / (1+realReturn)^yearsLeft
      const yearsLeft = retirementAge - age
      const fireNumber = regularTarget
        ? regularTarget.effectiveNumber.div(realReturn.plus(1).pow(yearsLeft))
        : new Decimal(0)

      const isAchieved = netWorth.gte(fireNumber)
      if (isAchieved && fireAchievedYear === null && i > 0) {
        fireAchievedYear = year
      }

      const isRetired = age >= retirementAge

      let status: string
      if (i === 0) {
        status = 'Starting Point'
      } else if (age === retirementAge) {
        status = 'Retirement'
      } else if (isRetired) {
        status = 'Retired'
      } else if (isAchieved && year === fireAchievedYear) {
        status = 'FIRE Achieved!'
      } else if (isAchieved) {
        status = 'Coasting'
      } else {
        status = 'Building'
      }

      rows.push({
        year,
        age,
        totalAssets: totalAssets.toDecimalPlaces(0),
        totalDebts: totalDebts.toDecimalPlaces(0),
        netWorth: netWorth.toDecimalPlaces(0),
        fireNumber: fireNumber.toDecimalPlaces(0),
        status,
      })

      // Advance each account one year
      // Assets: compound with own return rate
      const totalAssetBal = assetAccounts.reduce(
        (sum, a) => sum.plus(balances[a.id]), new Decimal(0)
      )
      for (const account of assetAccounts) {
        const bal = balances[account.id]
        const returnRate = new Decimal(account.expectedReturnRate || '0').div(100)
        const weight = totalAssetBal.gt(0)
          ? bal.div(totalAssetBal)
          : new Decimal(1).div(assetAccounts.length || 1)

        if (isRetired) {
          // Post-retirement: withdraw expenses proportionally, no contributions
          const withdrawal = annualExpenses.times(weight)
          balances[account.id] = Decimal.max(bal.minus(withdrawal).times(returnRate.plus(1)), new Decimal(0))
        } else {
          // Pre-retirement: contribute savings proportionally
          const contrib = annualSavings.times(weight)
          balances[account.id] = bal.plus(contrib).times(returnRate.plus(1))
        }
      }

      // Debts: accrue interest, subtract annual payments, floor at zero
      for (const account of debtAccounts) {
        const bal = balances[account.id]
        if (bal.lte(0)) continue
        const interestRate = new Decimal(account.interestRate || '0').div(100)
        const interest = bal.times(interestRate)
        const annualPayment = new Decimal(account.monthlyPayment || '0').times(12)
        balances[account.id] = Decimal.max(bal.plus(interest).minus(annualPayment), new Decimal(0))
      }
    }

    return rows
  }, [currentAge, retirementAge, lifeExpectancy, accounts, annualSavings, annualExpenses, realReturn, regularTarget])

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Year</th>
              <th className="text-left py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Age</th>
              <th className="text-right py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Assets</th>
              <th className="text-right py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Debts</th>
              <th className="text-right py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Net Worth</th>
              <th className="text-right py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">FIRE #</th>
              <th className="text-left py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody>
            {projection.map((row) => {
              const isHighlight = row.status === 'FIRE Achieved!'
              const isRetirement = row.status === 'Retirement'
              return (
                <tr
                  key={row.year}
                  className={`border-b border-border/50 ${
                    isHighlight
                      ? 'bg-accent/5 font-semibold'
                      : isRetirement
                        ? 'bg-surface-alt font-semibold'
                        : ''
                  }`}
                >
                  <td className="py-1.5 px-3 tabular-nums">{row.year}</td>
                  <td className="py-1.5 px-3 tabular-nums">{row.age}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{formatCurrency(row.totalAssets.toString())}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-blue-500">{row.totalDebts.gt(0) ? formatCurrency(row.totalDebts.toString()) : '—'}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums font-medium">{formatCurrency(row.netWorth.toString())}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{formatCurrency(row.fireNumber.toString())}</td>
                  <td className={`py-1.5 px-3 ${isHighlight ? 'text-accent' : ''}`}>{row.status}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
