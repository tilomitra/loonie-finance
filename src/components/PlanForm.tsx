import type { Plan, Province } from '@/types'
import { PROVINCE_LABELS } from '@/types'
import { Card, CardTitle } from '@/components/ui/Card'
import { Field, Toggle } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'

interface Props {
  plan: Plan
  onChange: (plan: Plan) => void
}

const int = (v: string) => (v === '' ? 0 : Math.round(Number(v)))
const ageOptions = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ value: String(from + i), label: String(from + i) }))

export function PlanForm({ plan, onChange }: Props) {
  const set = <K extends keyof Plan>(key: K, value: Plan[K]) => onChange({ ...plan, [key]: value })

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle className="mb-4">You</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age today" value={plan.currentAge} onChange={v => set('currentAge', int(v))} min={16} max={100} />
          <Field label="Retire fully at" value={plan.retirementAge} onChange={v => set('retirementAge', int(v))} min={plan.currentAge} max={100}
            hint="Age you stop all work." />
          <Field label="Plan to age" value={plan.lifeExpectancy} onChange={v => set('lifeExpectancy', int(v))} min={plan.retirementAge + 1} max={110} />
          <Select
            label="Province"
            value={plan.province}
            onChange={e => set('province', e.target.value as Province)}
            options={Object.entries(PROVINCE_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-4">Spending and saving</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Spending in retirement" prefix="$" suffix="/yr" value={plan.annualSpending} step="1000"
            onChange={v => set('annualSpending', v)} hint="After tax, in today's dollars." />
          <Field label="You invest" prefix="$" suffix="/yr" value={plan.annualContribution} step="1000"
            onChange={v => set('annualContribution', v)} hint="Until you coast or retire." />
        </div>
        <div className="mt-3">
          <Toggle label="Include income tax" checked={plan.includeTax} onChange={v => set('includeTax', v)}
            hint="Grosses up RRSP/RRIF withdrawals, CPP, OAS and pension for 2026 federal and provincial tax." />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-4">Market assumptions</CardTitle>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Return" suffix="%" step="0.1" value={plan.expectedReturn} onChange={v => set('expectedReturn', v)} hint="Nominal, per year." />
          <Field label="Inflation" suffix="%" step="0.1" value={plan.inflation} onChange={v => set('inflation', v)} />
          <Field label="Withdrawal rate" suffix="%" step="0.1" value={plan.withdrawalRate} onChange={v => set('withdrawalRate', v)} hint="3.5–4% is common." />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-4">Government benefits and pension</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CPP at 65" prefix="$" suffix="/mo" step="10" value={plan.cppAt65Monthly} onChange={v => set('cppAt65Monthly', v)}
            hint={<>From your <a className="underline" href="https://www.canada.ca/en/employment-social-development/services/my-account.html" target="_blank" rel="noreferrer">My Service Canada Account</a>. 2026 max: $1,364.60. Early retirement lowers it.</>} />
          <Select label="Start CPP at" value={String(plan.cppStartAge)} onChange={e => set('cppStartAge', Number(e.target.value))} options={ageOptions(60, 70)} />
          <Field label="Years in Canada after 18" value={plan.oasResidenceYears} min={0} max={40} onChange={v => set('oasResidenceYears', int(v))}
            hint="By age 65. 40 years gives full OAS; under 10 gives none." />
          <Select label="Start OAS at" value={String(plan.oasStartAge)} onChange={e => set('oasStartAge', Number(e.target.value))} options={ageOptions(65, 70)} />
          <Field label="DB pension" prefix="$" suffix="/yr" step="1000" value={plan.pensionAnnual} onChange={v => set('pensionAnnual', v)} hint="Defined-benefit only. 0 if none." />
          <Field label="Pension starts at" value={plan.pensionStartAge} min={50} max={75} onChange={v => set('pensionStartAge', int(v))} />
        </div>
      </Card>
    </div>
  )
}
