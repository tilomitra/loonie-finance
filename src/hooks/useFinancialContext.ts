import { useAccounts, useUserProfile, useNetWorth } from '@/db/hooks'
import { formatCurrency } from '@/lib/utils'
import { ACCOUNT_TYPE_LABELS, isDebtType } from '@/types'
import type { Account, UserProfile } from '@/types'
import type Decimal from 'decimal.js'

const PROVINCE_NAMES: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',
}

export function buildSystemPrompt(
  profile: UserProfile | undefined,
  accounts: Account[],
  netWorth: { netWorth: Decimal; totalAssets: Decimal; totalDebts: Decimal }
): string {
  const profileSection = profile
    ? `Province: ${PROVINCE_NAMES[profile.province] ?? profile.province}
Annual Income: ${formatCurrency(profile.annualIncome || '0')}
Date of Birth: ${profile.dateOfBirth || 'Not set'}
Years Contributed to CPP: ${profile.yearsContributedCPP}`
    : 'No profile data configured yet.'

  const accountLines = accounts.length > 0
    ? accounts.map(a => {
        const type = ACCOUNT_TYPE_LABELS[a.type]
        const debt = isDebtType(a.type) ? ' (debt)' : ''
        const rate = a.interestRate ? ` @ ${a.interestRate}%` : ''
        return `- ${a.name} (${type}${debt}): ${formatCurrency(a.balance || '0')}${rate}`
      }).join('\n')
    : 'No accounts configured yet.'

  const contributionSection = profile
    ? `TFSA Cumulative Contributions: ${formatCurrency(profile.tfsaCumulativeContributions || '0')} (Lifetime max: $109,000)
RRSP Cumulative Contributions: ${formatCurrency(profile.rrspCumulativeContributions || '0')}
FHSA Cumulative Contributions: ${formatCurrency(profile.fhsaCumulativeContributions || '0')} (Lifetime max: $40,000)
First-Time Home Buyer: ${profile.fhsaFirstHomeOwner ? 'Yes' : 'No'}`
    : 'No profile data configured yet.'

  return `You are a knowledgeable Canadian personal finance advisor embedded in Loonie Finance, a personal finance app. You have access to the user's real financial data shown below.

Give specific, actionable advice based on their actual numbers. When relevant, cite current Canadian tax rules, contribution limits, and rates. Use web search for current interest rates, market data, or recent policy changes.

Always note that you are not a licensed financial advisor and your advice is for informational purposes.

=== USER FINANCIAL PROFILE ===
${profile ? profileSection : 'No profile configured yet.'}

=== ACCOUNTS ===
${accountLines}

=== NET WORTH ===
Total Assets: ${formatCurrency(netWorth.totalAssets.toString())}
Total Debts: ${formatCurrency(netWorth.totalDebts.toString())}
Net Worth: ${formatCurrency(netWorth.netWorth.toString())}

=== CONTRIBUTION ROOM ===
${contributionSection}`
}

export function useFinancialContext(): string {
  const profile = useUserProfile()
  const accounts = useAccounts()
  const netWorth = useNetWorth()
  return buildSystemPrompt(profile, accounts, netWorth)
}
