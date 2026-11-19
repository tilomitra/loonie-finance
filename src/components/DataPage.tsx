import { useState } from 'react'
import { Download, Upload, Trash2 } from 'lucide-react'
import { db } from '@/db/database'
import type { Account, Plan } from '@/types'
import { Card, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Backup {
  app: 'loonie-fire'
  version: 1
  exportedAt: string
  plan: Plan[]
  accounts: Account[]
}

export function DataPage() {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const exportData = async () => {
    const data: Backup = {
      app: 'loonie-fire',
      version: 1,
      exportedAt: new Date().toISOString(),
      plan: await db.plan.toArray(),
      accounts: await db.accounts.toArray(),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `loonie-fire-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus({ ok: true, text: 'Backup downloaded.' })
  }

  const importData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const data = JSON.parse(await file.text()) as Backup
        if (data.app !== 'loonie-fire' || !Array.isArray(data.accounts) || !Array.isArray(data.plan)) {
          throw new Error('This is not a Loonie FIRE backup file.')
        }
        await db.transaction('rw', db.accounts, db.plan, async () => {
          await db.accounts.clear()
          await db.plan.clear()
          await db.accounts.bulkAdd(data.accounts)
          await db.plan.bulkAdd(data.plan)
        })
        setStatus({ ok: true, text: `Restored ${data.accounts.length} accounts and your plan.` })
      } catch (err) {
        setStatus({ ok: false, text: err instanceof Error ? err.message : String(err) })
      }
    }
    input.click()
  }

  const reset = async () => {
    if (!confirm('Delete all accounts and reset the plan? You cannot undo this.')) return
    await db.accounts.clear()
    await db.plan.clear()
    setStatus({ ok: true, text: 'All data deleted.' })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardTitle>Backup</CardTitle>
        <CardDescription>All data stays in this browser (IndexedDB). Download a backup to move it to another device.</CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={exportData}><Download className="h-3.5 w-3.5" /> Download backup</Button>
          <Button variant="secondary" onClick={importData}><Upload className="h-3.5 w-3.5" /> Restore backup</Button>
        </div>
        {status && <p className={`mt-3 text-[12px] ${status.ok ? 'text-achieved' : 'text-danger'}`}>{status.text}</p>}
      </Card>
      <Card>
        <CardTitle>Delete all data</CardTitle>
        <CardDescription>Removes your accounts and plan from this browser.</CardDescription>
        <div className="mt-4">
          <Button variant="danger" onClick={reset}><Trash2 className="h-3.5 w-3.5" /> Delete all data</Button>
        </div>
      </Card>
    </div>
  )
}
