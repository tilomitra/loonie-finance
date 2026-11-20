import Decimal from 'decimal.js'
import type { AccountType, Institution } from '@/types'
import { parseCsv, parseMoney } from './csv'

/**
 * Turn a holdings or balances CSV into account totals.
 *
 * Supported:
 * - Wealthsimple "Holdings report" CSV (one row per holding, with Account Name / Account Type /
 *   Account Number / Market Value / Market Value Currency columns).
 * - TD WebBroker holdings CSV (an account line above the table, then Symbol / Description /
 *   Quantity / Book Cost / Market Value columns).
 * - Any CSV with an account column and a value or balance column.
 *
 * Holdings are summed per account. USD values are converted with `usdToCad`.
 */
export interface ImportedAccount {
  key: string
  name: string
  type: AccountType
  institution: Institution
  balance: Decimal
  holdingCount: number
  /** True if some USD values were converted to CAD. */
  convertedUsd: boolean
}

export interface ImportResult {
  institution: Institution
  accounts: ImportedAccount[]
  warnings: string[]
}

export interface ImportOptions {
  usdToCad: Decimal
  fileName?: string
  /** Override the institution detection. */
  institution?: Institution
}

const VALUE_HEADERS = [
  'market value (cad)',
  'market value cad',
  'total market value (cad)',
  'market value',
  'total market value',
  'market value ($)',
  'current value',
  'total value',
  'value (cad)',
  'value',
  'balance (cad)',
  'balance',
  'current balance',
  'amount',
]

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

function findColumn(headers: string[], candidates: (string | RegExp)[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => (typeof c === 'string' ? h === c : c.test(h)))
    if (idx >= 0) return idx
  }
  return -1
}

/** Guess the account type from free text such as "Self-directed TFSA" or "RSP - 12345". */
export function inferAccountType(text: string): AccountType {
  const t = ` ${text.toLowerCase()} `
  if (/rrif|\brif\b/.test(t)) return 'rrif'
  if (/\blira\b|locked[- ]in|\blrsp\b|\blif\b/.test(t)) return 'lira'
  if (/fhsa|first home/.test(t)) return 'fhsa'
  if (/\bresp\b|education/.test(t)) return 'resp'
  if (/tfsa|tax[- ]free/.test(t)) return 'tfsa'
  if (/rrsp|\brsp\b|retirement savings|spousal/.test(t)) return 'rrsp'
  if (/\bpension\b|\bdc plan\b|\bgrsp\b|group rrsp/.test(t)) return 'pension'
  if (/non[- ]?registered|non[- ]?reg|margin|cash account|personal|individual|joint|taxable|corporate/.test(t)) return 'non-registered'
  if (/chequing|checking|savings|\bhisa\b|\bcash\b/.test(t)) return 'cash'
  if (/crypto/.test(t)) return 'other'
  return 'non-registered'
}

export function detectInstitution(text: string, headers: string[], fileName = ''): Institution {
  const all = `${text.slice(0, 2000)} ${fileName}`.toLowerCase()
  if (all.includes('wealthsimple') || headers.includes('account classification') || headers.includes('position direction')) {
    return 'wealthsimple'
  }
  if (/\btd\b|webbroker|direct investing|waterhouse|easyweb/.test(all) || headers.includes('loan value') || headers.includes('change today $')) {
    return 'td'
  }
  return 'other'
}

function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const cells = rows[i].map(norm).filter(Boolean)
    if (cells.length < 2) continue
    if (cells.some(c => VALUE_HEADERS.includes(c))) return i
  }
  return -1
}

function isTotalRow(cells: string[]): boolean {
  return cells.slice(0, 3).some(c => /^(grand )?total|^sub-?total|^cash total/i.test(c.trim()))
}

/** Text above the table often names the account (TD WebBroker does this). */
function preambleAccount(rows: string[][], headerRow: number): { text: string; number: string } {
  const lines = rows.slice(0, headerRow).map(r => r.filter(Boolean).join(' ')).filter(Boolean)
  const text = lines.join(' ')
  const accountLine = lines.find(l => /account/i.test(l)) ?? ''
  const numMatch = accountLine.match(/([0-9]{2,}[0-9A-Z-]*)/i)
  return { text, number: numMatch ? numMatch[1] : '' }
}

export function parseBrokerageCsv(csvText: string, options: ImportOptions): ImportResult {
  const warnings: string[] = []
  const rows = parseCsv(csvText)
  const headerRow = findHeaderRow(rows)
  if (headerRow < 0) {
    return {
      institution: options.institution ?? 'other',
      accounts: [],
      warnings: ['No value column found. The file needs a column named "Market Value", "Value" or "Balance".'],
    }
  }

  const headers = rows[headerRow].map(norm)
  const institution = options.institution ?? detectInstitution(csvText, headers, options.fileName)

  const valueCol = findColumn(headers, VALUE_HEADERS)
  const valueHeader = headers[valueCol]
  const currencyCol = findColumn(headers, ['market value currency', 'currency', 'value currency', 'balance currency', /currency/])
  const accountNameCol = findColumn(headers, ['account name', 'account nickname', 'account', 'account description', 'nickname'])
  const accountTypeCol = findColumn(headers, ['account type', 'account classification', 'type', 'plan type'])
  const accountNumberCol = findColumn(headers, ['account number', 'account #', 'account no', 'account no.', 'account id'])
  const symbolCol = findColumn(headers, ['symbol', 'ticker', 'security'])
  const valueIsCad = /cad/.test(valueHeader)
  // TD WebBroker puts the account currency above the table, not in a column.
  const preambleIsUsd = currencyCol < 0 && /\busd\b|u\.s\. dollar/i.test(rows.slice(0, headerRow).flat().join(' '))

  const preamble = preambleAccount(rows, headerRow)
  const fallbackText = `${preamble.text} ${options.fileName ?? ''}`
  const groups = new Map<string, ImportedAccount>()
  let skippedUsd = false

  for (const raw of rows.slice(headerRow + 1)) {
    if (raw.every(c => !c)) continue
    if (isTotalRow(raw)) continue
    // A second header line or a new section ends nothing, but must not be counted.
    if (raw.map(norm).some(c => VALUE_HEADERS.includes(c))) continue

    const value = parseMoney(raw[valueCol] ?? '')
    if (value === null) continue

    const currency = currencyCol >= 0 ? (raw[currencyCol] ?? '').toUpperCase() : preambleIsUsd ? 'USD' : ''
    let cad = new Decimal(value)
    let converted = false
    if (!valueIsCad && currency.includes('USD')) {
      cad = cad.times(options.usdToCad)
      converted = true
      skippedUsd = true
    }

    const accName = accountNameCol >= 0 ? raw[accountNameCol] : ''
    const accType = accountTypeCol >= 0 ? raw[accountTypeCol] : ''
    const accNum = accountNumberCol >= 0 ? raw[accountNumberCol] : ''
    const key = accNum || accName || accType || preamble.number || 'default'

    let acc = groups.get(key)
    if (!acc) {
      const typeText = [accType, accName].filter(Boolean).join(' ') || fallbackText
      const type = inferAccountType(typeText)
      const label = accName || accType
      const name = label ? withInstitution(institution, label) : defaultName(institution, type, accNum || preamble.number)
      acc = {
        key: `${institution}:${key === 'default' ? type : key}`,
        name,
        type,
        institution,
        balance: new Decimal(0),
        holdingCount: 0,
        convertedUsd: false,
      }
      groups.set(key, acc)
    }
    acc.balance = acc.balance.plus(cad)
    acc.holdingCount += symbolCol >= 0 && !raw[symbolCol] ? 0 : 1
    acc.convertedUsd = acc.convertedUsd || converted
  }

  if (skippedUsd) warnings.push(`USD values were converted to CAD at ${options.usdToCad.toString()}.`)
  if (accountNameCol < 0 && accountTypeCol < 0 && accountNumberCol < 0 && !preamble.number && groups.size > 0) {
    warnings.push('The file has no account column, so all rows were added to one account. Check the account type.')
  }
  if (groups.size === 0) warnings.push('No rows with a value were found.')

  return { institution, accounts: [...groups.values()], warnings }
}

function institutionName(institution: Institution): string {
  return institution === 'wealthsimple' ? 'Wealthsimple' : institution === 'td' ? 'TD' : 'Imported'
}

function withInstitution(institution: Institution, label: string): string {
  if (institution === 'other') return label
  const inst = institutionName(institution)
  return label.toLowerCase().includes(inst.toLowerCase()) ? label : `${inst} ${label}`
}

function defaultName(institution: Institution, type: AccountType, number: string): string {
  const inst = institutionName(institution)
  const label: Record<AccountType, string> = {
    tfsa: 'TFSA', rrsp: 'RRSP', rrif: 'RRIF', lira: 'LIRA', fhsa: 'FHSA', resp: 'RESP',
    'non-registered': 'Non-registered', cash: 'Cash', pension: 'Pension', other: 'Account',
  }
  return `${inst} ${label[type]}${number ? ` (${number})` : ''}`
}
