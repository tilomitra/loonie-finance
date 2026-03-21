import Decimal from 'decimal.js'
import { RRSP_ANNUAL_LIMITS, RRSP_CONTRIBUTION_RATE } from '../constants/rrsp'

export interface RrspRoomResult {
  currentYearNewRoom: Decimal
  estimatedTotalRoom: Decimal
  usedRoom: Decimal
  availableRoom: Decimal
}

/**
 * Calculate RRSP contribution room for the current year
 * @param previousYearIncome - Earned income from previous year
 * @param cumulativeContributions - Total lifetime RRSP contributions
 * @param currentYear - Defaults to 2026
 */
export function calculateRrspRoom(
  previousYearIncome: string,
  cumulativeContributions: string,
  currentYear: number = 2026
): RrspRoomResult {
  const income = new Decimal(previousYearIncome || '0')
  const annualLimit = RRSP_ANNUAL_LIMITS[currentYear] || RRSP_ANNUAL_LIMITS[2026]

  // New room = 18% of previous year earned income, capped at annual maximum
  const currentYearNewRoom = Decimal.min(
    income.times(RRSP_CONTRIBUTION_RATE),
    annualLimit
  )

  // Simplified: without full history, we estimate total room as new room
  // In practice, unused room carries forward
  const usedRoom = new Decimal(cumulativeContributions || '0')
  const estimatedTotalRoom = currentYearNewRoom
  const availableRoom = Decimal.max(estimatedTotalRoom.minus(usedRoom), 0)

  return { currentYearNewRoom, estimatedTotalRoom, usedRoom, availableRoom }
}

/**
 * Calculate the tax refund from an RRSP contribution
 */
export function calculateRrspTaxRefund(
  contribution: Decimal,
  marginalTaxRate: Decimal
): Decimal {
  return contribution.times(marginalTaxRate)
}
