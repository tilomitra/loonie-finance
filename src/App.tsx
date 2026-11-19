import { useEffect, useMemo, useRef, useState } from 'react'
import type { Plan } from '@/types'
import { useAccounts, usePlan, savePlan } from '@/db/hooks'
import { toFireInputs } from '@/lib/plan-inputs'
import { calculateFire } from '@/engine/fire/coast-fire'
import { PlanForm } from '@/components/PlanForm'
import { Results } from '@/components/Results'
import { AccountsPage } from '@/components/AccountsPage'
import { DataPage } from '@/components/DataPage'
import { cn } from '@/lib/utils'

type Tab = 'plan' | 'accounts' | 'data'
const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Coast FIRE' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'data', label: 'Backup' },
]

function useHashTab(): [Tab, (t: Tab) => void] {
  const read = (): Tab => {
    const h = window.location.hash.replace('#', '')
    return TABS.some(t => t.id === h) ? (h as Tab) : 'plan'
  }
  const [tab, setTab] = useState<Tab>(read)
  useEffect(() => {
    const onHash = () => setTab(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return [tab, (t: Tab) => { window.location.hash = t }]
}

function PlanPage({ saved, onGoToAccounts }: { saved: Plan; onGoToAccounts: () => void }) {
  const loaded = useAccounts()
  const accounts = useMemo(() => loaded ?? [], [loaded])
  const [plan, setPlan] = useState(saved)
  const timer = useRef<number | undefined>(undefined)

  const change = (next: Plan) => {
    setPlan(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => savePlan(next), 300)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const inputs = useMemo(() => toFireInputs(plan, accounts), [plan, accounts])
  const result = useMemo(() => calculateFire(inputs), [inputs])

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <PlanForm plan={plan} onChange={change} />
      <Results inputs={inputs} result={result} onGoToAccounts={onGoToAccounts} />
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useHashTab()
  const plan = usePlan()
  const accounts = useAccounts()

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold tracking-wide">LOONIE</div>
            <div className="text-[11px] text-text-secondary">Coast FIRE calculator for Canada · data stays in your browser</div>
          </div>
          <nav className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-3 py-1.5 text-[11px] uppercase tracking-widest cursor-pointer border',
                  tab === t.id ? 'border-text bg-text text-surface' : 'border-transparent text-text-secondary hover:text-text',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === 'plan' && plan && <PlanPage saved={plan} onGoToAccounts={() => setTab('accounts')} />}
        {tab === 'accounts' && accounts && <AccountsPage accounts={accounts} />}
        {tab === 'data' && <DataPage />}
      </main>
    </div>
  )
}
