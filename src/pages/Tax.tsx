import { useState, useMemo, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useUserProfile } from '@/db/hooks'
import { formatCurrency } from '@/lib/utils'
import { calculateTotalTax } from '@/engine/tax/calculate-tax'
import { FEDERAL_TAX_2026, PROVINCIAL_TAX_2026 } from '@/engine/constants/tax-brackets-2026'
import Decimal from 'decimal.js'
import type { Province } from '@/types'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'

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

const PIE_COLORS = ['#2D5A27', '#4A7C44', '#B45309']

export function Tax() {
  const profile = useUserProfile()
  const [income, setIncome] = useState(profile?.annualIncome || '100000')
  const [province, setProvince] = useState<Province>(profile?.province || 'ON')

  useEffect(() => {
    if (profile?.annualIncome) setIncome(profile.annualIncome)
    if (profile?.province) setProvince(profile.province)
  }, [profile?.annualIncome, profile?.province])

  const taxResult = useMemo(() => {
    const inc = new Decimal(income || '0')
    return calculateTotalTax(inc, province)
  }, [income, province])

  const takeHome = new Decimal(income || '0').minus(taxResult.totalTax)

  const pieData = [
    { name: 'Federal Tax', value: taxResult.federalTax.toNumber() },
    { name: 'Provincial Tax', value: taxResult.provincialTax.toNumber() },
    { name: 'Take Home', value: takeHome.toNumber() },
  ]

  // Bracket visualization
  const federalBrackets = FEDERAL_TAX_2026.brackets.map(b => ({
    range: `$${(b.min / 1000).toFixed(0)}K${b.max === Infinity ? '+' : `-$${(b.max / 1000).toFixed(0)}K`}`,
    rate: (b.rate * 100).toFixed(1),
    rateNum: b.rate * 100,
  }))

  const provSystem = PROVINCIAL_TAX_2026[province]
  const provincialBrackets = provSystem?.brackets.map(b => ({
    range: `$${(b.min / 1000).toFixed(0)}K${b.max === Infinity ? '+' : `-$${(b.max / 1000).toFixed(0)}K`}`,
    rate: (b.rate * 100).toFixed(1),
    rateNum: b.rate * 100,
  })) || []

  return (
    <div>
      <h1 className="font-serif text-2xl mb-8">Tax Estimator <span className="text-text-secondary font-sans text-sm font-normal">2026</span></h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Income</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Annual Income"
              type="number"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="e.g., 100000"
            />
            <Select
              label="Province"
              value={province}
              onChange={(e) => setProvince(e.target.value as Province)}
              options={provinceOptions}
            />
          </div>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Federal Tax</div>
              <div className="text-lg font-semibold text-primary mt-1 tracking-tight">{formatCurrency(taxResult.federalTax.toString())}</div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Provincial Tax</div>
              <div className="text-lg font-semibold text-primary-light mt-1 tracking-tight">{formatCurrency(taxResult.provincialTax.toString())}</div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Total Tax</div>
              <div className="text-lg font-semibold text-danger mt-1 tracking-tight">{formatCurrency(taxResult.totalTax.toString())}</div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Take Home</div>
              <div className="text-lg font-semibold mt-1 tracking-tight">{formatCurrency(takeHome.toString())}</div>
            </Card>
          </div>

          {/* Rates */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Effective Rate</div>
              <div className="text-2xl font-semibold mt-1 tracking-tight">{(taxResult.effectiveRate.times(100).toNumber()).toFixed(1)}%</div>
            </Card>
            <Card>
              <div className="text-[11px] uppercase tracking-widest text-text-secondary font-medium">Marginal Rate</div>
              <div className="text-2xl font-semibold mt-1 tracking-tight">{(taxResult.marginalRate.times(100).toNumber()).toFixed(1)}%</div>
            </Card>
          </div>

          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Income Breakdown</CardTitle>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(1)}%)`}
                    labelLine={{ stroke: '#E8E8E4' }}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatCurrency(String(v))}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E8E8E4', fontSize: '13px', boxShadow: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Bracket Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Federal Brackets</CardTitle>
              </CardHeader>
              <div className="space-y-0.5">
                {federalBrackets.map(b => (
                  <div key={b.range} className="flex justify-between text-[13px] py-1.5 px-2 -mx-2 rounded hover:bg-surface-alt transition-colors">
                    <span className="text-text-secondary">{b.range}</span>
                    <span className="font-medium">{b.rate}%</span>
                  </div>
                ))}
                <div className="flex justify-between text-[13px] py-1.5 px-2 -mx-2 border-t border-border mt-2 pt-2">
                  <span className="text-text-secondary">Basic Personal Amount</span>
                  <span className="font-medium">{formatCurrency(FEDERAL_TAX_2026.basicPersonalAmount.toString())}</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Provincial Brackets ({province})</CardTitle>
              </CardHeader>
              <div className="space-y-0.5">
                {provincialBrackets.map(b => (
                  <div key={b.range} className="flex justify-between text-[13px] py-1.5 px-2 -mx-2 rounded hover:bg-surface-alt transition-colors">
                    <span className="text-text-secondary">{b.range}</span>
                    <span className="font-medium">{b.rate}%</span>
                  </div>
                ))}
                {provSystem && (
                  <div className="flex justify-between text-[13px] py-1.5 px-2 -mx-2 border-t border-border mt-2 pt-2">
                    <span className="text-text-secondary">Basic Personal Amount</span>
                    <span className="font-medium">{formatCurrency(provSystem.basicPersonalAmount.toString())}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
