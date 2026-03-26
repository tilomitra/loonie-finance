import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { db } from '@/db/database'
import { generateId } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import type { LifeEvent } from '@/types'
import { ChevronDown, ChevronUp, Plus, Trash2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

interface LifeEventsSectionProps {
  lifeEvents: LifeEvent[]
}

const TYPE_CONFIG = {
  income: {
    label: 'Income',
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
  },
  expense: {
    label: 'Expense',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
  'one-time': {
    label: 'One-time',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
  },
} as const

const EVENT_ICONS: Record<LifeEvent['type'], string> = {
  income: '💰',
  expense: '💸',
  'one-time': '⚡',
}

const DEFAULT_FORM = {
  name: '',
  type: 'expense' as LifeEvent['type'],
  amount: '',
  startAge: '',
  endAge: '',
  person: 'self' as LifeEvent['person'],
}

export function LifeEventsSection({ lifeEvents }: LifeEventsSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    if (!form.amount || isNaN(parseFloat(form.amount))) {
      setError('Enter a valid amount')
      return
    }
    if (!form.startAge || isNaN(parseInt(form.startAge))) {
      setError('Enter a valid start age')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const event: LifeEvent = {
        id: generateId(),
        name: form.name.trim(),
        type: form.type,
        amount: form.amount,
        startAge: parseInt(form.startAge),
        endAge: form.type !== 'one-time' && form.endAge ? parseInt(form.endAge) : undefined,
        person: form.person,
      }
      await db.lifeEvents.add(event)
      setForm(DEFAULT_FORM)
      setAddOpen(false)
    } catch {
      setError('Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await db.lifeEvents.delete(id)
    setDeleteConfirmId(null)
  }

  const handleClose = () => {
    setAddOpen(false)
    setForm(DEFAULT_FORM)
    setError(null)
  }

  return (
    <div className="bg-surface rounded-lg border border-border">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-5"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[14px]">Life Events</span>
          {lifeEvents.length > 0 && (
            <span className="text-[11px] bg-surface-alt border border-border rounded-full px-2 py-0.5 text-text-secondary font-medium">
              {lifeEvents.length}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-text-secondary" />
          : <ChevronDown className="w-4 h-4 text-text-secondary" />
        }
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border pt-4">
          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add Event
            </Button>
            <Link to="/onboarding">
              <Button size="sm" variant="secondary">
                <Sparkles className="w-3.5 h-3.5" />
                Add with AI
              </Button>
            </Link>
          </div>

          {/* Events grid */}
          {lifeEvents.length === 0 ? (
            <p className="text-[13px] text-text-secondary py-6 text-center">
              No life events yet. Add income streams, expenses, or one-time events that will affect your projection.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {lifeEvents.map(event => {
                const cfg = TYPE_CONFIG[event.type]
                const icon = EVENT_ICONS[event.type]
                const isOneTime = event.type === 'one-time'

                return (
                  <div
                    key={event.id}
                    className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border} relative`}
                  >
                    {/* Delete button */}
                    <button
                      className="absolute top-2 right-2 p-1 rounded-md text-text-secondary/50 hover:text-danger hover:bg-white/50 transition-colors"
                      onClick={() => setDeleteConfirmId(event.id)}
                      title="Delete event"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    <div className="text-xl mb-2">{icon}</div>

                    <div className="font-semibold text-[13px] text-text pr-5 mb-1 leading-tight">
                      {event.name}
                    </div>

                    {/* Type badge */}
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${cfg.color} mb-2`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>

                    <div className="text-[13px] font-semibold text-text">
                      {formatCurrency(event.amount)}
                      <span className="text-[11px] font-normal text-text-secondary ml-0.5">
                        {isOneTime ? ' total' : '/mo'}
                      </span>
                    </div>

                    <div className="text-[11px] text-text-secondary mt-1">
                      Age {event.startAge}
                      {!isOneTime && event.endAge ? `–${event.endAge}` : isOneTime ? '' : '+'}
                    </div>

                    {/* Person tag */}
                    <div className="mt-2">
                      <span className="text-[10px] bg-white/60 border border-white/40 rounded px-1.5 py-0.5 text-text-secondary font-medium capitalize">
                        {event.person}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Event Dialog */}
      <Dialog open={addOpen} onClose={handleClose} title="Add Life Event">
        <div className="space-y-4">
          <Input
            label="Event Name"
            placeholder="e.g. Rental Income, Car Purchase"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />

          <Select
            label="Type"
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as LifeEvent['type'] }))}
            options={[
              { value: 'income', label: 'Income (recurring)' },
              { value: 'expense', label: 'Expense (recurring)' },
              { value: 'one-time', label: 'One-time event' },
            ]}
          />

          <Input
            label={form.type === 'one-time' ? 'Total Amount' : 'Monthly Amount'}
            type="number"
            placeholder="0"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Age"
              type="number"
              placeholder="30"
              value={form.startAge}
              onChange={e => setForm(f => ({ ...f, startAge: e.target.value }))}
            />
            {form.type !== 'one-time' && (
              <Input
                label="End Age (optional)"
                type="number"
                placeholder="65"
                value={form.endAge}
                onChange={e => setForm(f => ({ ...f, endAge: e.target.value }))}
              />
            )}
          </div>

          <Select
            label="Person"
            value={form.person}
            onChange={e => setForm(f => ({ ...f, person: e.target.value as LifeEvent['person'] }))}
            options={[
              { value: 'self', label: 'Self' },
              { value: 'partner', label: 'Partner' },
              { value: 'joint', label: 'Joint' },
            ]}
          />

          {error && (
            <p className="text-[12px] text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving...' : 'Add Event'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Life Event"
      >
        <p className="text-[13px] text-text-secondary mb-5">
          Are you sure you want to delete this life event? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
