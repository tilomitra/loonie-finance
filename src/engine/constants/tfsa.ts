// TFSA annual contribution limits by year
export const TFSA_ANNUAL_LIMITS: Record<number, number> = {
  2009: 5000,
  2010: 5000,
  2011: 5000,
  2012: 5000,
  2013: 5500,
  2014: 5500,
  2015: 10000,
  2016: 5500,
  2017: 5500,
  2018: 5500,
  2019: 6000,
  2020: 6000,
  2021: 6000,
  2022: 6000,
  2023: 6500,
  2024: 7000,
  2025: 7000,
  2026: 7000,
}

// Minimum age to open a TFSA
export const TFSA_MINIMUM_AGE = 18

// Total cumulative room for someone eligible since 2009
export const TFSA_CUMULATIVE_MAX_2026 = Object.values(TFSA_ANNUAL_LIMITS).reduce((a, b) => a + b, 0)
