import { describe, it, expect } from 'vitest'
import { calculateTfsaRoom } from '../tfsa'
import { calculateRrspRoom, calculateRrspTaxRefund } from '../rrsp'
import { calculateFhsaRoom } from '../fhsa'
import Decimal from 'decimal.js'

describe('TFSA Room', () => {
  it('should calculate max room for someone eligible since 2009', () => {
    // Born 1990, turned 18 in 2008, eligible from 2009
    const result = calculateTfsaRoom(1990, '0', 2026)
    // Sum of all limits from 2009-2026 = 109000
    expect(result.totalRoom.toNumber()).toBe(109000)
    expect(result.availableRoom.toNumber()).toBe(109000)
  })

  it('should subtract contributions from available room', () => {
    const result = calculateTfsaRoom(1990, '50000', 2026)
    expect(result.usedRoom.toNumber()).toBe(50000)
    expect(result.availableRoom.toNumber()).toBe(59000)
  })

  it('should limit room for someone who turned 18 in 2020', () => {
    // Born 2002, turned 18 in 2020
    const result = calculateTfsaRoom(2002, '0', 2026)
    // 2020: 6000, 2021: 6000, 2022: 6000, 2023: 6500, 2024: 7000, 2025: 7000, 2026: 7000
    expect(result.totalRoom.toNumber()).toBe(45500)
  })

  it('should not allow negative available room', () => {
    const result = calculateTfsaRoom(1990, '200000', 2026)
    expect(result.availableRoom.toNumber()).toBe(0)
  })
})

describe('RRSP Room', () => {
  it('should calculate 18% of income up to max', () => {
    const result = calculateRrspRoom('100000', '0', 2026)
    // 18% of 100000 = 18000 (under 33810 max)
    expect(result.currentYearNewRoom.toNumber()).toBe(18000)
  })

  it('should cap at annual maximum', () => {
    const result = calculateRrspRoom('250000', '0', 2026)
    // 18% of 250000 = 45000, but capped at 33810
    expect(result.currentYearNewRoom.toNumber()).toBe(33810)
  })

  it('should calculate tax refund', () => {
    const refund = calculateRrspTaxRefund(new Decimal(10000), new Decimal(0.3))
    expect(refund.toNumber()).toBe(3000)
  })
})

describe('FHSA Room', () => {
  it('should show full room for eligible first-time buyer', () => {
    const result = calculateFhsaRoom('0', true)
    expect(result.availableAnnual.toNumber()).toBe(8000)
    expect(result.availableLifetime.toNumber()).toBe(40000)
  })

  it('should reduce room by contributions', () => {
    const result = calculateFhsaRoom('16000', true)
    expect(result.availableLifetime.toNumber()).toBe(24000)
    expect(result.availableAnnual.toNumber()).toBe(8000)
  })

  it('should show zero room for non-first-time buyers', () => {
    const result = calculateFhsaRoom('0', false)
    expect(result.availableAnnual.toNumber()).toBe(0)
    expect(result.availableLifetime.toNumber()).toBe(0)
  })

  it('should cap annual at remaining lifetime', () => {
    const result = calculateFhsaRoom('36000', true)
    expect(result.availableLifetime.toNumber()).toBe(4000)
    expect(result.availableAnnual.toNumber()).toBe(4000)
  })
})
