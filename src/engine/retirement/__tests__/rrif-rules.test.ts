import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { calculateRrifMinimum, shouldConvertToRrif } from '../rrif-rules'

describe('calculateRrifMinimum', () => {
  it('should return 0 for ages below 72', () => {
    const balance = new Decimal(100000)
    expect(calculateRrifMinimum(65, balance).toNumber()).toBe(0)
    expect(calculateRrifMinimum(71, balance).toNumber()).toBe(0)
    expect(calculateRrifMinimum(0, balance).toNumber()).toBe(0)
  })

  it('should return 5.28% of balance at age 72', () => {
    const balance = new Decimal(100000)
    const result = calculateRrifMinimum(72, balance)
    expect(result.toNumber()).toBeCloseTo(5280, 0)
  })

  it('should return correct amount at age 80', () => {
    const balance = new Decimal(200000)
    // Rate at 80 is 6.58%
    const result = calculateRrifMinimum(80, balance)
    expect(result.toNumber()).toBeCloseTo(13160, 0)
  })

  it('should return 20% of balance at age 95 and above', () => {
    const balance = new Decimal(100000)
    expect(calculateRrifMinimum(95, balance).toNumber()).toBeCloseTo(20000, 0)
    expect(calculateRrifMinimum(100, balance).toNumber()).toBeCloseTo(20000, 0)
  })

  it('should round result to 2 decimal places', () => {
    const balance = new Decimal(333333)
    const result = calculateRrifMinimum(72, balance)
    const str = result.toFixed(2)
    expect(str).toBe(result.toDecimalPlaces(2).toFixed(2))
  })
})

describe('shouldConvertToRrif', () => {
  it('should return false at age 70', () => {
    expect(shouldConvertToRrif(70)).toBe(false)
  })

  it('should return false at age 71 (conversion happens at end of year 71)', () => {
    // RRIF_CONVERSION_AGE is 71, so age >= 71 returns true
    expect(shouldConvertToRrif(71)).toBe(true)
  })

  it('should return true at age 72', () => {
    expect(shouldConvertToRrif(72)).toBe(true)
  })

  it('should return true at ages well past conversion', () => {
    expect(shouldConvertToRrif(80)).toBe(true)
    expect(shouldConvertToRrif(95)).toBe(true)
  })
})
