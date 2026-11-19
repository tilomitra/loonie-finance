import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FireResult } from '@/engine/fire/coast-fire'
import { formatCurrency } from '@/lib/utils'

interface Props {
  result: FireResult
  retirementAge: number
  coastAge: number | null
}

const compact = (n: number) =>
  new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1, style: 'currency', currency: 'CAD' }).format(n)

export function ProjectionChart({ result, retirementAge, coastAge }: Props) {
  const data = result.projection.map(p => ({
    age: p.age,
    keepSaving: Math.round(p.keepSaving.toNumber()),
    coastNow: Math.round(p.coastNow.toNumber()),
  }))
  const fireNumber = result.fireNumber.toNumber()

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="age" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={false} width={64} />
          <Tooltip
            formatter={(v, name) => [formatCurrency(String(v)), name === 'keepSaving' ? 'Keep investing' : 'Stop investing today']}
            labelFormatter={age => `Age ${age}`}
            contentStyle={{ fontSize: 12, border: '1px solid var(--color-border)', borderRadius: 0, background: 'var(--color-surface)' }}
          />
          <Legend formatter={v => (v === 'keepSaving' ? 'Keep investing until retirement' : 'Stop investing today (coast)')} wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={fireNumber} stroke="var(--color-achieved)" strokeDasharray="4 4"
            label={{ value: `FIRE number ${compact(fireNumber)}`, position: 'insideTopLeft', fontSize: 11, fill: 'var(--color-achieved)' }} />
          <ReferenceLine x={retirementAge} stroke="var(--color-text-secondary)" strokeDasharray="2 4"
            label={{ value: 'Retire', position: 'insideBottomRight', fontSize: 11, fill: 'var(--color-text-secondary)' }} />
          {coastAge !== null && coastAge > data[0]?.age && (
            <ReferenceLine x={coastAge} stroke="var(--color-warning)" strokeDasharray="2 4"
              label={{ value: 'Coast', position: 'insideBottomRight', fontSize: 11, fill: 'var(--color-warning)' }} />
          )}
          <Area type="monotone" dataKey="keepSaving" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.12} strokeWidth={2} />
          <Area type="monotone" dataKey="coastNow" stroke="var(--color-warning)" fill="var(--color-warning)" fillOpacity={0.08} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
