import Decimal from 'decimal.js'
import { FHSA_ANNUAL_LIMIT, FHSA_LIFETIME_LIMIT } from '../constants/fhsa'

export interface FhsaRoomResult {
  annualLimit: Decimal
  lifetimeLimit: Decimal
  usedRoom: Decimal
  availableAnnual: Decimal
  availableLifetime: Decimal
}

/**
 * Calculate FHSA contribution room
 */
export function calculateFhsaRoom(
  cumulativeContributions: string,
  isFirstTimeHomeBuyer: boolean
): FhsaRoomResult {
  const usedRoom = new Decimal(cumulativeContributions || '0')
  const lifetimeLimit = new Decimal(FHSA_LIFETIME_LIMIT)
  const annualLimit = new Decimal(FHSA_ANNUAL_LIMIT)

  if (!isFirstTimeHomeBuyer) {
    return {
      annualLimit: new Decimal(0),
      lifetimeLimit,
      usedRoom,
      availableAnnual: new Decimal(0),
      availableLifetime: new Decimal(0),
    }
  }

  const availableLifetime = Decimal.max(lifetimeLimit.minus(usedRoom), 0)
  const availableAnnual = Decimal.min(annualLimit, availableLifetime)

  return { annualLimit, lifetimeLimit, usedRoom, availableAnnual, availableLifetime }
}
