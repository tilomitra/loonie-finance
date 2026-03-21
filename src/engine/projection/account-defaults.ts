import type { AccountType } from '@/types'

/** Default expected annual return rate (as decimal string percentage, e.g. '5.0' = 5%) */
export const DEFAULT_RETURN_RATES: Record<AccountType, string> = {
  'cash': '2.5',
  'tfsa': '5.0',
  'rrsp': '5.0',
  'fhsa': '5.0',
  'non-registered': '5.0',
  'crypto': '8.0',
  'property': '3.0',
  'pension': '4.0',
  'debt-mortgage': '0',
  'debt-loc': '0',
  'debt-credit': '0',
  'debt-other': '0',
}

/** Default annual volatility for Monte Carlo, by account type */
export const DEFAULT_VOLATILITIES: Record<AccountType, number> = {
  'cash': 0.01,
  'tfsa': 0.12,
  'rrsp': 0.12,
  'fhsa': 0.12,
  'non-registered': 0.12,
  'crypto': 0.50,
  'property': 0.12,
  'pension': 0.08,
  'debt-mortgage': 0,
  'debt-loc': 0,
  'debt-credit': 0,
  'debt-other': 0,
}
