import { useState } from 'react'
import Decimal from 'decimal.js'
import { Upload, X } from 'lucide-react'
import { parseBrokerageCsv } from '@/engine/import/brokerage'
import { upsertImportedAccounts, type AccountDraft } from '@/db/accounts'
import { ACCOUNT_TYPE_LABELS, INSTITUTION_LABELS, includeInFireByDefault, type AccountType } from '@/types'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { formatCurrency, cn } from '@/lib/utils'

export function ImportPanel() {
  const [usdToCad, setUsdToCad] = useState('1.38')
  const [drafts, setDrafts] = useState<AccountDraft[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const readFiles = async (files: FileList | File[]) => {
    setMessage(null)
    const rate = (() => { try { return new Decimal(usdToCad || '1') } catch { return new Decimal(1) } })()
    const next: AccountDraft[] = []
    const notes: string[] = []
    for (const file of Array.from(files)) {
      const text = await file.text()
      const res = parseBrokerageCsv(text, { usdToCad: rate, fileName: file.name })
      res.warnings.forEach(w => notes.push(`${file.name}: ${w}`))
      for (const a of res.accounts) {
        next.push({
          key: a.key,
          name: a.name,
          type: a.type,
          institution: a.institution,
          balance: a.balance.toDecimalPlaces(2).toString(),
          includeInFire: includeInFireByDefault(a.type),
        })
      }
    }
    setDrafts(prev => {
      const map = new Map(prev.map(d => [d.key, d]))
      next.forEach(d => map.set(d.key, d))
      return [...map.values()]
    })
    setWarnings(notes)
  }

  const edit = (key: string, changes: Partial<AccountDraft>) =>
    setDrafts(ds => ds.map(d => (d.key === key ? { ...d, ...changes } : d)))

  const save = async () => {
    const { added, updated } = await upsertImportedAccounts(drafts)
    setDrafts([])
    setWarnings([])
    setMessage(`Imported: ${added} new account${added === 1 ? '' : 's'}, ${updated} updated.`)
  }

  const pick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,text/csv,.txt'
    input.multiple = true
    input.onchange = () => input.files && readFiles(input.files)
    input.click()
  }

  return (
    <Card>
      <CardTitle>Import from Wealthsimple or TD</CardTitle>
      <div className="mt-3 grid gap-4 md:grid-cols-2 text-[12px] leading-relaxed">
        <div>
          <div className="font-semibold">Wealthsimple</div>
          <p className="text-text-secondary">
            On the Wealthsimple website, download the <em>holdings report</em> CSV from your documents or statements.
            One file covers all your accounts (TFSA, RRSP, FHSA, non-registered).
          </p>
        </div>
        <div>
          <div className="font-semibold">TD Direct Investing (WebBroker)</div>
          <p className="text-text-secondary">
            Open <em>Holdings</em> for each account and use <em>Export</em> to download a CSV. Import one file per account.
            For TD EasyWeb bank accounts, add the balance by hand below.
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-text-secondary">
        Menu names can change. Any CSV with an account column and a <em>Market Value</em>, <em>Value</em> or <em>Balance</em> column works.
        Files are read in your browser and never leave your device.
      </p>

      <div
        className={cn('mt-4 border border-dashed border-border p-6 text-center cursor-pointer transition-colors', dragging && 'bg-surface-alt border-accent')}
        onClick={pick}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); readFiles(e.dataTransfer.files) }}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && pick()}
      >
        <Upload className="mx-auto h-5 w-5 text-text-secondary" />
        <div className="mt-2 text-[12px]">Drop CSV files here, or click to choose</div>
      </div>

      <div className="mt-3 max-w-[200px]">
        <Field label="USD to CAD rate" value={usdToCad} step="0.01" onChange={setUsdToCad} hint="Used for holdings priced in USD. Set before you import." />
      </div>

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-warning">
          {warnings.map(w => <li key={w}>{w}</li>)}
        </ul>
      )}
      {message && <p className="mt-3 text-[12px] text-achieved">{message}</p>}

      {drafts.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-widest text-text-secondary mb-2">Check before import</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-text-secondary">
                  <th className="py-1 font-medium">Account</th>
                  <th className="py-1 font-medium">Type</th>
                  <th className="py-1 font-medium text-right">Balance (CAD)</th>
                  <th className="py-1 font-medium text-center">Count for FIRE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {drafts.map(d => (
                  <tr key={d.key} className="border-t border-border">
                    <td className="py-1.5 pr-2">
                      <input className="w-full border border-border px-2 py-1 bg-surface" value={d.name} onChange={e => edit(d.key, { name: e.target.value })} />
                      <div className="text-[10px] text-text-secondary mt-0.5">{INSTITUTION_LABELS[d.institution]}</div>
                    </td>
                    <td className="py-1.5 pr-2">
                      <select className="border border-border px-2 py-1 bg-surface" value={d.type}
                        onChange={e => { const type = e.target.value as AccountType; edit(d.key, { type, includeInFire: includeInFireByDefault(type) }) }}>
                        {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 text-right">{formatCurrency(d.balance)}</td>
                    <td className="py-1.5 text-center">
                      <input type="checkbox" checked={d.includeInFire} onChange={e => edit(d.key, { includeInFire: e.target.checked })} />
                    </td>
                    <td className="py-1.5 text-right">
                      <button className="p-1 text-text-secondary hover:text-danger cursor-pointer" aria-label="Remove" onClick={() => setDrafts(ds => ds.filter(x => x.key !== d.key))}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={save}>Import {drafts.length} account{drafts.length === 1 ? '' : 's'}</Button>
            <Button variant="ghost" onClick={() => setDrafts([])}>Cancel</Button>
          </div>
          <p className="mt-2 text-[11px] text-text-secondary">If you imported an account before, its balance is updated, not added twice.</p>
        </div>
      )}
    </Card>
  )
}
