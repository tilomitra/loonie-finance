import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

interface ProgressGaugeProps {
  name: string
  progress: number
  target: string
  estimatedAge: number | null
  color: string
  bgColor: string
  isNext?: boolean
  isAchieved?: boolean
  isBaristaType?: boolean
  baristaLabel?: string
  isSelected?: boolean
  onClick?: () => void
}

export function ProgressGauge({
  name,
  progress,
  target,
  estimatedAge,
  isNext = false,
  isAchieved = false,
  isBaristaType = false,
  baristaLabel,
  isSelected = false,
  onClick,
}: ProgressGaugeProps) {
  const pct = Math.min(Math.round(progress * 100), 100)

  return (
    <div
      className={cn(
        'border p-4 relative transition-all cursor-pointer',
        isSelected
          ? 'border-accent bg-accent/5'
          : isNext
            ? 'border-text bg-surface'
            : 'border-border bg-surface hover:border-text-secondary'
      )}
      onClick={onClick}
    >
      {isNext && !isSelected && (
        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-text text-surface">
          Next
        </span>
      )}

      <div className="mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary">{name}</span>
      </div>

      {isBaristaType ? (
        <div>
          <div className="text-[18px] font-bold tracking-tight text-accent tabular-nums">
            {formatCurrency(target)}
          </div>
          <div className="text-[10px] text-text-secondary mt-0.5 uppercase tracking-wide">{baristaLabel ?? 'income needed/yr'}</div>
        </div>
      ) : (
        <>
          <div className="text-[22px] font-bold tracking-tight mb-2 tabular-nums text-text">
            {pct}%
          </div>

          {/* Progress bar — segmented */}
          <div className="flex gap-[1px] mb-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 ${
                  i < Math.round(pct / 10)
                    ? isAchieved ? 'bg-achieved' : 'bg-accent'
                    : 'bg-border'
                }`}
              />
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-text-secondary uppercase tracking-wide">Target</span>
              <span className="font-medium tabular-nums">{formatCurrency(target)}</span>
            </div>
            {isAchieved ? (
              <div className="text-[10px] font-semibold text-achieved uppercase tracking-wide">
                Achieved
              </div>
            ) : estimatedAge !== null ? (
              <div className="flex justify-between text-[10px]">
                <span className="text-text-secondary uppercase tracking-wide">Est. Age</span>
                <span className="font-medium tabular-nums">{estimatedAge}</span>
              </div>
            ) : (
              <div className="text-[10px] text-text-secondary">Not on track</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
