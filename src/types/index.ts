export type Province = 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT'

export type AccountType =
  | 'tfsa' | 'rrsp' | 'fhsa' | 'non-registered' | 'cash'
  | 'property' | 'crypto' | 'pension'
  | 'debt-mortgage' | 'debt-loc' | 'debt-credit' | 'debt-other'

export type Currency = 'CAD' | 'USD'

export interface AssetAllocation {
  stocks: number
  bonds: number
  cash: number
  other: number
}

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: string // decimal string
  currency: Currency
  institution: string
  assetAllocation: AssetAllocation
  contributionRoom: string | null
  interestRate: string | null
  notes: string
  createdAt: number
  updatedAt: number
}

export interface BalanceHistory {
  id: string
  accountId: string
  balance: string
  date: string // YYYY-MM-DD
  source: 'manual' | 'import'
}

export interface MonthlyContribution {
  accountId: string
  amount: string
}

export interface ScenarioAssumptions {
  inflationRate: string
  stockReturn: string
  bondReturn: string
  cashReturn: string
  salaryGrowthRate: string
  retirementAge: number
  lifeExpectancy: number
  cppStartAge: number
  oasStartAge: number
  province: Province
  annualIncome: string
  annualExpenses: string
  annualSavingsRate: string
  monthlyContributions: MonthlyContribution[]
}

export interface Scenario {
  id: string
  name: string
  isDefault: boolean
  assumptions: ScenarioAssumptions
  createdAt: number
  updatedAt: number
}

export interface UserProfile {
  id: string // always 'singleton'
  dateOfBirth: string // YYYY-MM-DD
  province: Province
  annualIncome: string
  yearsContributedCPP: number
  tfsaCumulativeContributions: string
  rrspCumulativeContributions: string
  fhsaCumulativeContributions: string
  fhsaFirstHomeOwner: boolean
  openaiApiKey?: string
  createdAt: number
  updatedAt: number
}

export interface Snapshot {
  id: string
  date: string
  netWorth: string
  totalAssets: string
  totalDebts: string
  accountBalances: { accountId: string; balance: string }[]
}

export type FireType = 'lean' | 'regular' | 'fat' | 'coast' | 'barista'

export interface ProjectionPoint {
  year: number
  age: number
  netWorth: string
  totalAssets: string
  totalDebts: string
  accountBreakdown: Record<string, string>
}

// Helper to check if an account type is a debt
export function isDebtType(type: AccountType): boolean {
  return type.startsWith('debt-')
}

// Helper to check if account is registered
export function isRegisteredType(type: AccountType): boolean {
  return type === 'tfsa' || type === 'rrsp' || type === 'fhsa'
}

// Display names for account types
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  'tfsa': 'TFSA',
  'rrsp': 'RRSP',
  'fhsa': 'FHSA',
  'non-registered': 'Non-Registered',
  'cash': 'Cash / Savings',
  'property': 'Real Estate',
  'crypto': 'Cryptocurrency',
  'pension': 'Pension',
  'debt-mortgage': 'Mortgage',
  'debt-loc': 'Line of Credit',
  'debt-credit': 'Credit Card',
  'debt-other': 'Other Debt',
}
