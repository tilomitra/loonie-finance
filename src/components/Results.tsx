import { useMemo } from 'react'
import Decimal from 'decimal.js'
import { calculateFire, type FireInputs, type FireResult } from '@/engine/fire/coast-fire'
import { Card, CardTitle } from '@/components/ui/Card'
import { ProjectionChart } from '@/components/ProjectionChart'
import { formatCurrency, cn } from '@/lib/utils'

interface Props {
  inputs: FireInputs
  result: FireResult
  onGoToAccounts: () => void
}

const money = (d: Decimal) => formatCurrency(d)

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="border border-border p-4">
      <div className="text-[10px] uppercase tracking-widest text-text-secondary">{label}</div>
      <div className={cn('mt-1 text-[18px] font-semibold', tone === 'good' && 'text-achieved', tone === 'warn' && 'text-warning')}>{value}</div>
      {note && <div className="mt-1 text-[11px] text-text-secondary leading-snug">{note}</div>}
    </div>
  )
}

export function Results({ inputs, result, onGoToAccounts }: Props) {
  const { currentAge, retirementAge, portfolio } = inputs
  const yearsToCoast = result.coastAge === null ? null : result.coastAge - currentAge

  const headline = result.isFire
    ? { text: 'You can retire today.', tone: 'text-achieved' }
    : result.isCoastFire
      ? { text: 'You have reached Coast FIRE.', tone: 'text-achieved' }
      : result.coastAge !== null
        ? { text: `You reach Coast FIRE at age ${result.coastAge}${yearsToCoast ? ` (in ${yearsToCoast} year${yearsToCoast === 1 ? '' : 's'})` : ''}.`, tone: 'text-text' }
        : { text: `You do not reach Coast FIRE before age ${retirementAge} with these inputs.`, tone: 'text-warning' }

  const sensitivity = useMemo(() => {
    return [-2, -1, 0, 1, 2].map(delta => {
      const nominalReturn = inputs.nominalReturn.plus(delta / 100)
      const r = calculateFire({ ...inputs, nominalReturn })
      return { pct: nominalReturn.times(100).toFixed(1), coastNumber: r.coastNumber, coastAge: r.coastAge, fireNumber: r.fireNumber }
    })
  }, [inputs])

  const progressPct = result.coastProgress.times(100).toNumber()

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-[10px] uppercase tracking-widest text-text-secondary">Coast FIRE status</div>
        <h2 className={cn('mt-2 text-[20px] font-semibold leading-tight', headline.tone)}>{headline.text}</h2>
        <p className="mt-2 text-[12px] text-text-secondary leading-relaxed">
          Coast FIRE means your investments can grow, with no more contributions, to the amount you need at {retirementAge}.
          After that point, you only need to earn enough to pay your costs.
        </p>
        {portfolio.isZero() && (
          <p className="mt-3 text-[12px]">
            Your portfolio is $0.{' '}
            <button className="underline cursor-pointer" onClick={onGoToAccounts}>Add or import your Wealthsimple and TD accounts</button>.
          </p>
        )}
        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-text-secondary">
            <span>{money(portfolio)} invested</span>
            <span>{money(result.coastNumber)} coast number</span>
          </div>
          <div className="mt-1 h-2 w-full bg-surface-alt border border-border">
            <div className={cn('h-full', result.isCoastFire ? 'bg-achieved' : 'bg-accent')} style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">{progressPct.toFixed(0)}% of the way to Coast FIRE</div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat label="Coast number today" value={money(result.coastNumber)} tone={result.isCoastFire ? 'good' : undefined}
          note={`Grows to your FIRE number by ${retirementAge} at ${result.realReturn.times(100).toFixed(2)}% real return.`} />
        <Stat label={`FIRE number at ${retirementAge}`} value={money(result.fireNumber)}
          note={result.bridgeAmount.gt(0) ? `Includes ${money(result.bridgeAmount)} to bridge the years before benefits start.` : 'In today’s dollars.'} />
        <Stat label="Coast age" value={result.coastAge === null ? 'Not reached' : String(result.coastAge)} tone={result.coastAge === null ? 'warn' : undefined}
          note="Earliest age you can stop investing." />
        <Stat label="Full FIRE age" value={result.fireAge === null ? 'Not reached' : String(result.fireAge)}
          note="If you keep investing and retire as soon as you can." />
        <Stat label="Income needed while coasting" value={`${money(result.coastWorkIncome)}/yr`}
          note={inputs.includeTax ? 'Pre-tax pay that covers your spending (income tax only).' : 'Covers your spending.'} />
        <Stat label="Benefits from 65+" value={`${money(result.fullGuaranteedIncome)}/yr`}
          note={`CPP ${money(result.cppAnnual)} + OAS ${money(result.oasAnnual)}${inputs.pensionAnnual.gt(0) ? ` + pension ${money(inputs.pensionAnnual)}` : ''}.`} />
      </div>

      <Card>
        <CardTitle>Projection (today's dollars)</CardTitle>
        <p className="mt-1 mb-3 text-[11px] text-text-secondary">
          After {retirementAge}, withdrawals pay your spending less CPP, OAS and pension.{' '}
          {result.depletionAgeCoastNow === null
            ? 'If you stop investing today, the money lasts to the end of the plan.'
            : `If you stop investing today, the money runs out at ${result.depletionAgeCoastNow}.`}{' '}
          {result.depletionAgeKeepSaving === null
            ? 'If you keep investing, it lasts to the end of the plan.'
            : `If you keep investing, it runs out at ${result.depletionAgeKeepSaving}.`}
        </p>
        <ProjectionChart result={result} retirementAge={retirementAge} coastAge={result.coastAge} />
      </Card>

      <Card>
        <CardTitle>What if returns are different?</CardTitle>
        <table className="mt-3 w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-text-secondary">
              <th className="py-1 font-medium">Return</th>
              <th className="py-1 font-medium text-right">Coast number</th>
              <th className="py-1 font-medium text-right">FIRE number</th>
              <th className="py-1 font-medium text-right">Coast age</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.map((s, i) => (
              <tr key={s.pct} className={cn('border-t border-border', i === 2 && 'font-semibold')}>
                <td className="py-1.5">{s.pct}%</td>
                <td className="py-1.5 text-right">{money(s.coastNumber)}</td>
                <td className="py-1.5 text-right">{money(s.fireNumber)}</td>
                <td className="py-1.5 text-right">{s.coastAge ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-text-secondary leading-snug">
          The FIRE number changes with the return because the bridge years before CPP and OAS are discounted at the real return.
          Estimates only. Not financial advice.
        </p>
      </Card>
    </div>
  )
}
