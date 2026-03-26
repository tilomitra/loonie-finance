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

  return (
    <div className="relative pt-6 pb-10">
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
          className="absolute top-3 -translate-x-1/2 text-[10px] text-text-secondary font-medium whitespace-nowrap uppercase tracking-wide"
          style={{ left: `${currentPct}%` }}
        >
          Now ({currentAge})
        </div>

        {/* Milestone dots */}
        {reachable.map((m) => {
          const pct = toPercent(m.age!)
          const isAchieved = m.progress >= 1
          return (
            <div key={m.name}>
              {/* Dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 border-2 border-surface z-10 transition-all"
                style={{
                  left: `${pct}%`,
                  backgroundColor: isAchieved ? '#E8680C' : '#8A8A8A',
                }}
                title={`${m.name} FIRE at age ${m.age}`}
              />

              {/* Label below */}
              <div
                className="absolute top-4 -translate-x-1/2 text-center"
                style={{ left: `${pct}%` }}
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
