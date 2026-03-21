import Decimal from 'decimal.js'
import { TFSA_ANNUAL_LIMITS, TFSA_MINIMUM_AGE } from '../constants/tfsa'

export interface TfsaRoomResult {
  totalRoom: Decimal
  usedRoom: Decimal
  availableRoom: Decimal
  yearlyBreakdown: { year: number; limit: number; eligible: boolean }[]
}

/**
 * Calculate TFSA contribution room
 * @param birthYear - Year the person was born
 * @param cumulativeContributions - Total lifetime contributions (as decimal string)
 * @param currentYear - Current year (defaults to 2026)
 */
export function calculateTfsaRoom(
  birthYear: number,
  cumulativeContributions: string,
  currentYear: number = 2026
): TfsaRoomResult {
  const yearTurned18 = birthYear + TFSA_MINIMUM_AGE
  // TFSA started in 2009
  const firstEligibleYear = Math.max(2009, yearTurned18)

  let totalRoom = new Decimal(0)
  const yearlyBreakdown: { year: number; limit: number; eligible: boolean }[] = []

  for (let year = 2009; year <= currentYear; year++) {
    const limit = TFSA_ANNUAL_LIMITS[year] || 0
    const eligible = year >= firstEligibleYear
    yearlyBreakdown.push({ year, limit, eligible })
    if (eligible && limit > 0) {
      totalRoom = totalRoom.plus(limit)
    }
  }

  const usedRoom = new Decimal(cumulativeContributions || '0')
  const availableRoom = Decimal.max(totalRoom.minus(usedRoom), 0)

  return { totalRoom, usedRoom, availableRoom, yearlyBreakdown }
}
