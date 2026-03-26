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
}

export function ProgressGauge({
  name,
  progress,
  target,
  estimatedAge,
  color,
  bgColor,
  isNext = false,
  isAchieved = false,
  isBaristaType = false,
  baristaLabel,
}: ProgressGaugeProps) {
  const pct = Math.min(Math.round(progress * 100), 100)

  return (
    <div
      className={cn(
        'rounded-lg border p-4 relative overflow-hidden transition-all',
        isNext
          ? 'border-2 shadow-sm'
          : 'border-border bg-surface'
      )}
      style={isNext ? { borderColor: color, backgroundColor: `${bgColor}` } : {}}
    >
      {isNext && (
        <span
          className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{ backgroundColor: color, color: '#fff' }}
        >
          Next
        </span>
      )}

      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[13px] font-semibold capitalize">{name}</span>
      </div>

      {isBaristaType ? (
        <div>
          <div className="text-xl font-bold tracking-tight" style={{ color }}>
            {formatCurrency(target)}
          </div>
          <div className="text-[11px] text-text-secondary mt-0.5">{baristaLabel ?? 'income needed/yr'}</div>
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold tracking-tight mb-1" style={{ color }}>
            {pct}%
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-border mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-text-secondary">Target</span>
              <span className="font-medium">{formatCurrency(target)}</span>
            </div>
            {isAchieved ? (
              <div className="text-[11px] font-semibold" style={{ color }}>
                Achieved!
              </div>
            ) : estimatedAge !== null ? (
              <div className="flex justify-between text-[11px]">
                <span className="text-text-secondary">Est. Age</span>
                <span className="font-medium">{estimatedAge}</span>
              </div>
            ) : (
              <div className="text-[11px] text-text-secondary">Not on track</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
