import { z } from 'zod'

export const ProvinceSchema = z.enum(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])

export const AccountSchema = z.object({
  name: z.string(),
  type: z.enum([
    'tfsa', 'rrsp', 'fhsa', 'non-registered', 'cash', 'property', 'crypto', 'pension',
    'debt-mortgage', 'debt-loc', 'debt-credit', 'debt-other',
  ]),
  balance: z.string(),
  owner: z.enum(['self', 'partner', 'joint']).optional().default('self'),
})

export const PartnerProfileSchema = z.object({
  name: z.string(),
  dateOfBirth: z.string(),
  province: ProvinceSchema,
  annualIncome: z.string(),
  yearsContributedCPP: z.number().min(0).max(47),
  cppStartAge: z.number().min(60).max(70).default(65),
  oasStartAge: z.number().min(65).max(70).default(65),
  tfsaCumulativeContributions: z.string().default('0'),
  rrspCumulativeContributions: z.string().default('0'),
}).optional()

export const OnboardingResultSchema = z.object({
  userProfile: z.object({
    dateOfBirth: z.string(),
    province: ProvinceSchema,
    annualIncome: z.string(),
    yearsContributedCPP: z.number().min(0).max(47),
    tfsaCumulativeContributions: z.string().default('0'),
    rrspCumulativeContributions: z.string().default('0'),
    fhsaCumulativeContributions: z.string().default('0'),
    fhsaFirstHomeOwner: z.boolean().default(true),
  }),
  partnerProfile: PartnerProfileSchema,
  accounts: z.array(AccountSchema),
})

export type OnboardingResult = z.infer<typeof OnboardingResultSchema>
export type OnboardingAccount = z.infer<typeof AccountSchema>
