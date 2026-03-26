import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import Decimal from 'decimal.js'

interface YearlyBreakdownProps {
  currentAge: number
  retirementAge: number
  currentPortfolio: Decimal
  annualContributions: Decimal
  expectedReturnRate: Decimal // nominal
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
  totalPortfolio: Decimal
  totalContributions: Decimal
  growthFromReturns: Decimal
  fireNumber: Decimal
  status: string
}

export function YearlyBreakdown({
  currentAge,
  retirementAge,
  currentPortfolio,
  annualContributions,
  expectedReturnRate,
  inflationRate,
  fireTargets,
}: YearlyBreakdownProps) {
  const regularTarget = fireTargets.find(t => t.type === 'regular')
  const realReturn = expectedReturnRate.minus(inflationRate)

  const projection = useMemo(() => {
    const rows: ProjectionRow[] = []
    const startYear = new Date().getFullYear()
    let portfolio = currentPortfolio
    let totalContributions = new Decimal(0)
    let growthFromReturns = new Decimal(0)
    let fireAchievedYear: number | null = null

    for (let i = 0; i <= retirementAge - currentAge; i++) {
      const age = currentAge + i
      const year = startYear + i

      // FIRE number for this year = target / (1+realReturn)^yearsLeft
      const yearsLeft = retirementAge - age
      const fireNumber = regularTarget
        ? regularTarget.effectiveNumber.div(realReturn.plus(1).pow(yearsLeft))
        : new Decimal(0)

      const isAchieved = portfolio.gte(fireNumber)
      if (isAchieved && fireAchievedYear === null && i > 0) {
        fireAchievedYear = year
      }

      let status: string
      if (i === 0) {
        status = 'Starting Point'
      } else if (isAchieved && year === fireAchievedYear) {
        status = 'FIRE Achieved!'
      } else if (age === retirementAge) {
        status = 'Retirement'
      } else if (isAchieved) {
        status = 'Coasting'
      } else {
        status = 'Building'
      }

      rows.push({
        year,
        age,
        totalPortfolio: portfolio.toDecimalPlaces(0),
        totalContributions: totalContributions.toDecimalPlaces(0),
        growthFromReturns: growthFromReturns.toDecimalPlaces(0),
        fireNumber: fireNumber.toDecimalPlaces(0),
        status,
      })

      // Compute next year: beginning-of-year contributions, full year returns
      const yearContributions = annualContributions
      const annualReturn = portfolio.plus(yearContributions).times(realReturn)
      portfolio = portfolio.plus(yearContributions).plus(annualReturn)
      totalContributions = totalContributions.plus(yearContributions)
      growthFromReturns = growthFromReturns.plus(annualReturn)
    }

    return rows
  }, [currentAge, retirementAge, currentPortfolio, annualContributions, realReturn, regularTarget])

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Year</th>
              <th className="text-left py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Age</th>
              <th className="text-right py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Portfolio</th>
              <th className="text-right py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Contributions</th>
              <th className="text-right py-2 px-3 font-semibold text-text-secondary text-[10px] uppercase tracking-widest">Returns</th>
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
                  <td className="py-1.5 px-3 text-right tabular-nums">{formatCurrency(row.totalPortfolio.toString())}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{formatCurrency(row.totalContributions.toString())}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{formatCurrency(row.growthFromReturns.toString())}</td>
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
