import { formatCurrency } from '@/lib/utils'
import type { FireTypeResult } from '@/engine/retirement/fire-plan'

const FIRE_TYPE_LABELS: Record<string, string> = {
  coast: 'Coast FIRE',
  lean: 'Lean FIRE',
  barista: 'Barista FIRE',
  regular: 'FIRE',
  fat: 'Fat FIRE',
}

interface NextMilestoneProps {
  fireType: FireTypeResult
  currentAge: number
  currentTotal: string
}

export function NextMilestone({ fireType, currentAge, currentTotal }: NextMilestoneProps) {
  const label = FIRE_TYPE_LABELS[fireType.type] ?? fireType.type
  const progress = Math.min(fireType.progress, 1)
  const pct = Math.round(progress * 100)
  const target = fireType.effectiveNumber.toString()
  const gap = fireType.effectiveNumber.minus(fireType.effectiveNumber.times(progress)).toDecimalPlaces(0).toString()
  const estimatedAge = fireType.yearsToFire !== null ? currentAge + fireType.yearsToFire : null

  const isAchieved = progress >= 1
  const accentColor = isAchieved ? 'text-achieved' : 'text-accent'
  const accentBg = isAchieved ? 'bg-achieved' : 'bg-accent'

  return (
    <div className="border border-border p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary mb-1">
            Next Milestone
          </div>
          <h2 className="text-[18px] font-bold text-text uppercase tracking-wide">
            {label}
          </h2>
          {estimatedAge && (
            <div className="text-[12px] text-text-secondary mt-0.5">
              Estimated at age <span className="font-semibold text-text">{estimatedAge}</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className={`text-[32px] font-bold tracking-tight tabular-nums ${accentColor}`}>
            {pct}%
          </div>
          <div className="text-[10px] text-text-secondary uppercase tracking-widest">complete</div>
        </div>
      </div>

      {/* Progress bar — segmented blocks like the inspiration */}
      <div className="flex gap-[2px] mb-5">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 ${
              i < Math.round(pct / 5)
                ? accentBg
                : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-0 border border-border divide-x divide-border">
        <div className="py-2.5 px-3">
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">Progress</div>
          <div className={`text-[14px] font-bold tabular-nums ${accentColor}`}>{pct}%</div>
        </div>
        <div className="py-2.5 px-3">
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">Portfolio</div>
          <div className="text-[14px] font-bold text-text tabular-nums">{formatCurrency(currentTotal)}</div>
        </div>
        <div className="py-2.5 px-3">
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">Target</div>
          <div className="text-[14px] font-bold text-text tabular-nums">{formatCurrency(target)}</div>
        </div>
        <div className="py-2.5 px-3">
          <div className="text-[10px] uppercase tracking-widest text-text-secondary font-medium mb-0.5">Gap</div>
          <div className="text-[14px] font-bold text-text tabular-nums">
            {isAchieved ? <span className="text-achieved">Achieved!</span> : formatCurrency(gap)}
          </div>
        </div>
      </div>
    </div>
  )
}
