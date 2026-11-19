export type Province = 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT'

export const PROVINCE_LABELS: Record<Province, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
}

/** Investment account types that matter for a Canadian FIRE plan. */
export type AccountType =
  | 'tfsa'
  | 'rrsp'
  | 'rrif'
  | 'lira'
  | 'fhsa'
  | 'resp'
  | 'non-registered'
  | 'cash'
  | 'pension'
  | 'other'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  tfsa: 'TFSA',
  rrsp: 'RRSP',
  rrif: 'RRIF',
  lira: 'LIRA / Locked-in',
  fhsa: 'FHSA',
  resp: 'RESP',
  'non-registered': 'Non-registered',
  cash: 'Cash / Savings',
  pension: 'Pension (DC)',
  other: 'Other',
}

/** Withdrawals from these accounts are fully taxable income. */
export function isTaxDeferred(type: AccountType): boolean {
  return type === 'rrsp' || type === 'rrif' || type === 'lira' || type === 'pension'
}

/** By default, money for a home or a child's education is not retirement money. */
export function includeInFireByDefault(type: AccountType): boolean {
  return type !== 'fhsa' && type !== 'resp'
}

export type Institution = 'wealthsimple' | 'td' | 'other'

export const INSTITUTION_LABELS: Record<Institution, string> = {
  wealthsimple: 'Wealthsimple',
  td: 'TD',
  other: 'Other',
}

export interface Account {
  id: string
  name: string
  institution: Institution
  type: AccountType
  /** Balance in CAD, as a decimal string. */
  balance: string
  /** Count this account toward the FIRE portfolio. */
  includeInFire: boolean
  /** Key used to match the same account on a later import (for example, the account number). */
  importKey?: string
  updatedAt: number
}

/** All plan inputs. Money values are in today's dollars, as decimal strings. */
export interface Plan {
  id: 'singleton'
  currentAge: number
  /** Age when you stop all work. */
  retirementAge: number
  lifeExpectancy: number
  province: Province
  /** After-tax yearly spending in retirement. */
  annualSpending: string
  /** Yearly amount you add to your investments while you work. */
  annualContribution: string
  /** Expected nominal yearly return, percent. */
  expectedReturn: string
  /** Expected yearly inflation, percent. */
  inflation: string
  /** Safe withdrawal rate, percent. */
  withdrawalRate: string
  /** Gross up spending for income tax on withdrawals. */
  includeTax: boolean
  /** Your CPP estimate at age 65, monthly, from My Service Canada Account. */
  cppAt65Monthly: string
  cppStartAge: number
  /** Years you will have lived in Canada after age 18, by age 65. */
  oasResidenceYears: number
  oasStartAge: number
  /** Defined-benefit pension, yearly, in today's dollars. */
  pensionAnnual: string
  pensionStartAge: number
  updatedAt: number
}
