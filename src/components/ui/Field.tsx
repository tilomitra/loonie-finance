import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  hint?: ReactNode
  prefix?: string
  suffix?: string
  value: string | number
  onChange: (value: string) => void
  step?: string
  min?: number
  max?: number
  className?: string
}

/** A numeric input with a label, an optional prefix ($) or suffix (%), and a hint. */
export function Field({ label, hint, prefix, suffix, value, onChange, step, min, max, className }: FieldProps) {
  const id = `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-[11px] font-medium text-text-secondary uppercase tracking-widest">
        {label}
      </label>
      <div className="flex items-center border border-border bg-surface focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/30">
        {prefix && <span className="pl-3 text-[12px] text-text-secondary">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="w-full min-w-0 px-3 py-2 bg-transparent text-text text-[12px] focus:outline-none"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={e => onChange(e.target.value)}
        />
        {suffix && <span className="pr-3 text-[12px] text-text-secondary">{suffix}</span>}
      </div>
      {hint && <p className="text-[11px] text-text-secondary leading-snug">{hint}</p>}
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer select-none">
      <input type="checkbox" className="mt-0.5 accent-[var(--color-achieved)]" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>
        <span className="block text-[12px] text-text">{label}</span>
        {hint && <span className="block text-[11px] text-text-secondary leading-snug">{hint}</span>}
      </span>
    </label>
  )
}
