import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { parseBrokerageCsv, inferAccountType } from '../brokerage'
import { parseCsv, parseMoney } from '../csv'

import wealthsimpleCsv from './fixtures/wealthsimple-holdings.csv?raw'
import tdCsv from './fixtures/td-webbroker-holdings.csv?raw'

const FIXTURES: Record<string, string> = {
  'wealthsimple-holdings.csv': wealthsimpleCsv,
  'td-webbroker-holdings.csv': tdCsv,
}
const fixture = (name: string) => FIXTURES[name]
const usdToCad = new Decimal('1.40')

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and CRLF', () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n1,2,3')).toEqual([['a', 'b,c', 'd "e"'], ['1', '2', '3']])
  })
  it('detects tab delimiters', () => {
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseMoney', () => {
  it.each([
    ['$1,234.56', 1234.56],
    ['(12.00)', -12],
    ['-5', -5],
    ['1 234,56 $', 1234.56],
    ['CAD 99', 99],
    ['', null],
    ['--', null],
    ['abc', null],
  ])('%s -> %s', (raw, expected) => {
    expect(parseMoney(raw)).toBe(expected)
  })
})

describe('inferAccountType', () => {
  it.each([
    ['Self-directed TFSA', 'tfsa'],
    ['RSP - 12AB34', 'rrsp'],
    ['Spousal RRSP', 'rrsp'],
    ['Personal', 'non-registered'],
    ['Margin account', 'non-registered'],
    ['FHSA', 'fhsa'],
    ['LIRA', 'lira'],
    ['RRIF', 'rrif'],
    ['Family RESP', 'resp'],
    ['Wealthsimple Cash', 'cash'],
  ])('%s -> %s', (text, type) => {
    expect(inferAccountType(text)).toBe(type)
  })
})

describe('Wealthsimple holdings report', () => {
  const result = parseBrokerageCsv(fixture('wealthsimple-holdings.csv'), { usdToCad })

  it('detects Wealthsimple', () => {
    expect(result.institution).toBe('wealthsimple')
  })

  it('sums holdings per account and converts USD', () => {
    const byType = Object.fromEntries(result.accounts.map(a => [a.type, a]))
    expect(result.accounts).toHaveLength(4)
    expect(byType.tfsa.balance.toNumber()).toBe(50500)
    expect(byType.tfsa.holdingCount).toBe(2)
    expect(byType.rrsp.balance.toNumber()).toBe(21000) // 15,000 USD * 1.40
    expect(byType.rrsp.convertedUsd).toBe(true)
    expect(byType['non-registered'].balance.toNumber()).toBe(6400)
    expect(byType.fhsa.balance.toNumber()).toBe(10650)
    expect(byType.tfsa.key).toBe('wealthsimple:HQ1234567CAD')
    expect(byType.tfsa.name).toBe('Wealthsimple TFSA')
  })
})

describe('TD WebBroker holdings', () => {
  const result = parseBrokerageCsv(fixture('td-webbroker-holdings.csv'), { usdToCad })

  it('detects TD from the account line', () => {
    expect(result.institution).toBe('td')
  })

  it('makes one RRSP account and skips the total row', () => {
    expect(result.accounts).toHaveLength(1)
    const [acc] = result.accounts
    expect(acc.type).toBe('rrsp')
    expect(acc.balance.toNumber()).toBeCloseTo(90401.05, 2)
    expect(acc.name).toContain('12AB34')
    expect(result.warnings).toEqual([])
  })

  it('converts a USD account named above the table', () => {
    const usd = fixture('td-webbroker-holdings.csv').replace('(CAD)', '(USD)')
    const [acc] = parseBrokerageCsv(usd, { usdToCad }).accounts
    expect(acc.balance.toNumber()).toBeCloseTo(90401.05 * 1.4, 2)
  })
})

describe('Generic balances CSV', () => {
  it('reads an account and balance list', () => {
    const csv = 'Account,Balance\nTD TFSA,"$12,000"\nTD RRSP,8000\nTD Chequing,1500\n'
    const result = parseBrokerageCsv(csv, { usdToCad, fileName: 'balances.csv' })
    expect(result.accounts.map(a => [a.type, a.balance.toNumber()])).toEqual([
      ['tfsa', 12000],
      ['rrsp', 8000],
      ['cash', 1500],
    ])
  })

  it('reports a file without a value column', () => {
    const result = parseBrokerageCsv('Date,Description\n2026-01-01,Coffee', { usdToCad })
    expect(result.accounts).toHaveLength(0)
    expect(result.warnings[0]).toMatch(/No value column/)
  })
})
