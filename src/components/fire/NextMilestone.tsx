import { formatCurrency } from '@/lib/utils'
import type { FireTypeResult } from '@/engine/retirement/fire-plan'

const FIRE_TYPE_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  coast: { color: '#3b82f6', bg: '#eff6ff', label: 'Coast FIRE' },
  lean: { color: '#22c55e', bg: '#f0fdf4', label: 'Lean FIRE' },
  barista: { color: '#f97316', bg: '#fff7ed', label: 'Barista FIRE' },
  regular: { color: '#a855f7', bg: '#faf5ff', label: 'Regular FIRE' },
  fat: { color: '#ef4444', bg: '#fef2f2', label: 'Fat FIRE' },
}

interface NextMilestoneProps {
  fireType: FireTypeResult
  currentAge: number
  currentTotal: string
}

export function NextMilestone({ fireType, currentAge, currentTotal }: NextMilestoneProps) {
  const meta = FIRE_TYPE_COLORS[fireType.type] ?? { color: '#6b7280', bg: '#f9fafb', label: fireType.type }
  const progress = Math.min(fireType.progress, 1)
  const pct = Math.round(progress * 100)
  const target = fireType.effectiveNumber.toString()
  const gap = fireType.effectiveNumber.minus(fireType.effectiveNumber.times(progress)).toDecimalPlaces(0).toString()
  const estimatedAge = fireType.yearsToFire !== null ? currentAge + fireType.yearsToFire : null

  return (
    <div
      className="rounded-xl border-2 p-6"
      style={{ borderColor: meta.color, backgroundColor: meta.bg }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-1">
            Next Milestone
          </div>
          <h2 className="font-serif text-2xl font-bold" style={{ color: meta.color }}>
            {meta.label}
          </h2>
          {estimatedAge && (
            <div className="text-[13px] text-text-secondary mt-0.5">
              Estimated at age <span className="font-semibold">{estimatedAge}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold tracking-tight" style={{ color: meta.color }}>
            {pct}%
          </div>
          <div className="text-[12px] text-text-secondary">complete</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-white/60 mb-5 overflow-hidden border border-white/40">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: meta.color }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">Progress</div>
          <div className="text-[15px] font-bold" style={{ color: meta.color }}>{pct}%</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">Portfolio</div>
          <div className="text-[15px] font-bold text-text">{formatCurrency(currentTotal)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">Target</div>
          <div className="text-[15px] font-bold text-text">{formatCurrency(target)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">Gap</div>
          <div className="text-[15px] font-bold text-text">
            {progress >= 1 ? <span style={{ color: meta.color }}>Achieved!</span> : formatCurrency(gap)}
          </div>
        </div>
      </div>
    </div>
  )
}
