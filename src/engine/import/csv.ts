/**
 * Small CSV parser. Supports quoted fields, escaped quotes (""), CRLF line ends,
 * a leading byte-order mark, and comma, semicolon or tab delimiters.
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(input)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.map(r => r.map(c => c.trim()))
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 20).join('\n')
  const counts = [',', '\t', ';'].map(d => ({ d, n: sample.split(d).length - 1 }))
  counts.sort((a, b) => b.n - a.n)
  return counts[0].n > 0 ? counts[0].d : ','
}

/** Parse a money cell such as "$1,234.56", "(12.00)", "1 234,56 $" or "CAD 99". Returns null if not a number. */
export function parseMoney(raw: string): number | null {
  if (!raw) return null
  let s = raw.trim()
  if (!s || s === '-' || s === '--') return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[A-Za-z$\s\u00A0]/g, '')
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  }
  // "1.234,56" or "1234,56" (French format) -> "1234.56"
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s) || /^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  if (!/^\d*\.?\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? (negative ? -n : n) : null
}
