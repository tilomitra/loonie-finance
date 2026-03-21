import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import Decimal from 'decimal.js'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: string | Decimal, currency: string = 'CAD'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value.toNumber()
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function formatCurrencyPrecise(value: string | Decimal, currency: string = 'CAD'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value.toNumber()
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatPercent(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return `${(num * 100).toFixed(1)}%`
}

export function generateId(): string {
  return crypto.randomUUID()
}
