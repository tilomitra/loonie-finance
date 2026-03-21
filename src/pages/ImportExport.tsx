import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { db } from '@/db/database'
import { Download, Upload, Trash2, AlertTriangle } from 'lucide-react'

interface ExportData {
  version: 1
  exportedAt: string
  accounts: unknown[]
  balanceHistory: unknown[]
  scenarios: unknown[]
  userProfile: unknown[]
  snapshots: unknown[]
}

export function ImportExport() {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [importing, setImporting] = useState(false)

  const handleExport = async () => {
    try {
      const data: ExportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts: await db.accounts.toArray(),
        balanceHistory: await db.balanceHistory.toArray(),
        scenarios: await db.scenarios.toArray(),
        userProfile: await db.userProfile.toArray(),
        snapshots: await db.snapshots.toArray(),
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `loonie-finance-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      setStatus({ type: 'success', message: 'Data exported successfully!' })
    } catch (err) {
      setStatus({ type: 'error', message: `Export failed: ${err}` })
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setImporting(true)
      try {
        const text = await file.text()
        const data = JSON.parse(text) as ExportData

        if (!data.version || !data.accounts) {
          throw new Error('Invalid file format')
        }

        // Clear existing data
        await db.accounts.clear()
        await db.balanceHistory.clear()
        await db.scenarios.clear()
        await db.userProfile.clear()
        await db.snapshots.clear()

        // Import new data
        if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts as never[])
        if (data.balanceHistory?.length) await db.balanceHistory.bulkAdd(data.balanceHistory as never[])
        if (data.scenarios?.length) await db.scenarios.bulkAdd(data.scenarios as never[])
        if (data.userProfile?.length) await db.userProfile.bulkAdd(data.userProfile as never[])
        if (data.snapshots?.length) await db.snapshots.bulkAdd(data.snapshots as never[])

        setStatus({ type: 'success', message: `Imported ${data.accounts.length} accounts, ${data.balanceHistory?.length || 0} history entries, ${data.scenarios?.length || 0} scenarios.` })
      } catch (err) {
        setStatus({ type: 'error', message: `Import failed: ${err}` })
      } finally {
        setImporting(false)
      }
    }
    input.click()
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure? This will delete ALL your data permanently.')) return
    if (!confirm('This cannot be undone. Proceed?')) return

    try {
      await db.accounts.clear()
      await db.balanceHistory.clear()
      await db.scenarios.clear()
      await db.userProfile.clear()
      await db.snapshots.clear()
      setStatus({ type: 'success', message: 'All data cleared.' })
    } catch (err) {
      setStatus({ type: 'error', message: `Clear failed: ${err}` })
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl mb-8">Import / Export</h1>

      {status && (
        <div className={`mb-6 p-4 rounded-lg border text-[13px] ${
          status.type === 'success'
            ? 'bg-primary/5 border-primary/15 text-primary'
            : 'bg-danger/5 border-danger/15 text-danger'
        }`}>
          {status.message}
        </div>
      )}

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
            <CardDescription>Download all your data as a JSON file for backup.</CardDescription>
          </CardHeader>
          <Button onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />
            Export to JSON
          </Button>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import Data</CardTitle>
            <CardDescription>
              Import from a previously exported JSON file. This will replace all current data.
            </CardDescription>
          </CardHeader>
          <Button onClick={handleImport} variant="secondary" disabled={importing}>
            <Upload className="w-3.5 h-3.5" />
            {importing ? 'Importing...' : 'Import from JSON'}
          </Button>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-danger flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently delete all data from this browser. Export first if you want a backup.
            </CardDescription>
          </CardHeader>
          <Button variant="danger" onClick={handleClearAll}>
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Data
          </Button>
        </Card>
      </div>

      <div className="mt-8 p-4 bg-surface rounded-lg border border-border">
        <h3 className="text-[12px] font-medium uppercase tracking-wide text-text-secondary mb-2">About Your Data</h3>
        <ul className="text-[13px] text-text-secondary space-y-1.5">
          <li>All data is stored locally in your browser using IndexedDB.</li>
          <li>No data is ever sent to any server.</li>
          <li>Clearing browser data or using incognito mode will erase your data.</li>
          <li>Regular exports are recommended for backup.</li>
        </ul>
      </div>
    </div>
  )
}
