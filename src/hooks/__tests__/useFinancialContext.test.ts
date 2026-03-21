import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../useFinancialContext'
import type { Account, UserProfile } from '@/types'
import Decimal from 'decimal.js'

describe('buildSystemPrompt', () => {
  it('should include user profile data in the prompt', () => {
    const profile: UserProfile = {
      id: 'singleton',
      dateOfBirth: '1990-05-15',
      province: 'ON',
      annualIncome: '85000',
      yearsContributedCPP: 10,
      tfsaCumulativeContributions: '45000',
      rrspCumulativeContributions: '30000',
      fhsaCumulativeContributions: '8000',
      fhsaFirstHomeOwner: true,
      createdAt: 0,
      updatedAt: 0,
    }
    const accounts: Account[] = [
      {
        id: '1', name: 'TFSA', type: 'tfsa', balance: '25000', currency: 'CAD',
        institution: 'WS', expectedReturnRate: '5.0',
        contributionRoom: null, interestRate: null, notes: '', createdAt: 0, updatedAt: 0,
      },
      {
        id: '2', name: 'Mortgage', type: 'debt-mortgage', balance: '300000', currency: 'CAD',
        institution: 'TD', expectedReturnRate: '0',
        contributionRoom: null, interestRate: '4.8', notes: '', createdAt: 0, updatedAt: 0,
      },
    ]
    const netWorth = { netWorth: new Decimal(-275000), totalAssets: new Decimal(25000), totalDebts: new Decimal(300000) }

    const prompt = buildSystemPrompt(profile, accounts, netWorth)

    expect(prompt).toContain('Ontario')
    expect(prompt).toContain('85,000')
    expect(prompt).toContain('1990-05-15')
    expect(prompt).toContain('TFSA')
    expect(prompt).toContain('25,000')
    expect(prompt).toContain('Mortgage')
    expect(prompt).toContain('300,000')
    expect(prompt).toContain('Net Worth')
    expect(prompt).toContain('45,000')
    expect(prompt).toContain('Canadian personal finance')
  })

  it('should handle empty accounts and missing profile gracefully', () => {
    const prompt = buildSystemPrompt(undefined, [], {
      netWorth: new Decimal(0), totalAssets: new Decimal(0), totalDebts: new Decimal(0),
    })
    expect(prompt).toContain('Canadian personal finance')
    expect(prompt).toContain('No accounts')
    expect(prompt).toContain('No profile')
  })
})
