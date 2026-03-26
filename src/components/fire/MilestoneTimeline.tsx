interface MilestoneDot {
  name: string
  age: number | null
  color: string
  progress: number
}

interface MilestoneTimelineProps {
  milestones: MilestoneDot[]
  currentAge: number
}

/**
 * Group milestones that are too close together on the timeline,
 * then stagger their labels vertically to avoid overlap.
 */
function assignLabelRows(
  items: { name: string; age: number; pct: number; progress: number }[]
): { name: string; age: number; pct: number; progress: number; row: number }[] {
  if (items.length === 0) return []

  // Group items whose percentage positions are within 8% of each other
  const THRESHOLD = 8
  const groups: typeof items[] = []
  let currentGroup = [items[0]]

  for (let i = 1; i < items.length; i++) {
    if (items[i].pct - currentGroup[0].pct <= THRESHOLD) {
      currentGroup.push(items[i])
    } else {
      groups.push(currentGroup)
      currentGroup = [items[i]]
    }
  }
  groups.push(currentGroup)

  // Assign row indices within each group (0 = closest to track, 1+ = staggered down)
  return groups.flatMap(group =>
    group.map((item, i) => ({ ...item, row: i }))
  )
}

export function MilestoneTimeline({ milestones, currentAge }: MilestoneTimelineProps) {
  // Only show milestones that have a projected age (not barista, not unreachable)
  const reachable = milestones
    .filter(m => m.age !== null)
    .sort((a, b) => (a.age ?? 999) - (b.age ?? 999))

  if (reachable.length === 0) {
    return (
      <div className="text-center py-4 text-[12px] text-text-secondary">
        Set up your FIRE parameters to see your milestone timeline.
      </div>
    )
  }

  const minAge = currentAge
  const maxAge = Math.max(...reachable.map(m => m.age ?? 0)) + 5

  const toPercent = (age: number) =>
    Math.min(Math.max(((age - minAge) / (maxAge - minAge)) * 100, 2), 98)

  const currentPct = toPercent(currentAge)

  // Check if "Now" label overlaps with the first milestone
  const items = reachable.map(m => ({
    name: m.name,
    age: m.age!,
    pct: toPercent(m.age!),
    progress: m.progress,
  }))

  const rowItems = assignLabelRows(items)

  // Check if "Now" label is too close to first milestone group
  const nowOverlaps = rowItems.length > 0 && Math.abs(currentPct - rowItems[0].pct) < 8
  const maxRow = Math.max(0, ...rowItems.map(r => r.row))
  // If "Now" overlaps, push it below all milestone rows
  const nowRow = nowOverlaps ? maxRow + 1 : 0

  const ROW_HEIGHT = 28 // px per staggered row

  return (
    <div className="relative pt-6" style={{ paddingBottom: `${(Math.max(maxRow, nowRow) + 1) * ROW_HEIGHT + 16}px` }}>
      {/* Track line */}
      <div className="relative h-[2px] bg-border mx-4">
        {/* Progress fill up to current age */}
        <div
          className="absolute top-0 left-0 h-full bg-text"
          style={{ width: `${currentPct}%` }}
        />

        {/* Current age marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-text border-2 border-surface z-10"
          style={{ left: `${currentPct}%` }}
          title={`Now (Age ${currentAge})`}
        />
        <div
          className="absolute -translate-x-1/2 text-center"
          style={{ left: `${currentPct}%`, top: `${8 + nowRow * ROW_HEIGHT}px` }}
        >
          <div className="text-[10px] text-text-secondary font-medium whitespace-nowrap uppercase tracking-wide">
            Now ({currentAge})
          </div>
        </div>

        {/* Milestone dots + labels */}
        {rowItems.map((m) => {
          const isAchieved = m.progress >= 1
          return (
            <div key={m.name}>
              {/* Dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 border-2 border-surface z-10 transition-all"
                style={{
                  left: `${m.pct}%`,
                  backgroundColor: isAchieved ? '#0D9488' : '#8A8A8A',
                }}
                title={`${m.name} FIRE at age ${m.age}`}
              />

              {/* Connector line from dot to staggered label */}
              {m.row > 0 && (
                <div
                  className="absolute w-px bg-border"
                  style={{
                    left: `${m.pct}%`,
                    top: '8px',
                    height: `${m.row * ROW_HEIGHT - 4}px`,
                  }}
                />
              )}

              {/* Label */}
              <div
                className="absolute -translate-x-1/2 text-center"
                style={{ left: `${m.pct}%`, top: `${8 + m.row * ROW_HEIGHT}px` }}
              >
                <div className={`text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${isAchieved ? 'text-accent' : 'text-text-secondary'}`}>
                  {m.name}
                </div>
                <div className="text-[10px] text-text-secondary whitespace-nowrap tabular-nums">
                  Age {m.age}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
