import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { calculateFederalTax } from '../federal-tax'
import { calculateProvincialTax } from '../provincial-tax'
import { calculateTotalTax } from '../calculate-tax'

describe('Federal Tax 2026', () => {
  it('should return 0 for income below basic personal amount', () => {
    const tax = calculateFederalTax(new Decimal(10000))
    expect(tax.toNumber()).toBe(0)
  })

  it('should calculate correctly for $50,000 income', () => {
    const tax = calculateFederalTax(new Decimal(50000))
    // Gross: 50000 * 0.15 = 7500
    // BPA credit: 16129 * 0.15 = 2419.35
    // Net: 7500 - 2419.35 = 5080.65
    expect(tax.toNumber()).toBeCloseTo(5080.65, 1)
  })

  it('should calculate correctly for $100,000 income', () => {
    const tax = calculateFederalTax(new Decimal(100000))
    // First bracket: 57375 * 0.15 = 8606.25
    // Second bracket: (100000 - 57375) * 0.205 = 42625 * 0.205 = 8738.125
    // Gross: 17344.375
    // BPA credit: 16129 * 0.15 = 2419.35
    // Net: 14925.025
    expect(tax.toNumber()).toBeCloseTo(14925.03, 0)
  })

  it('should return 0 for $0 income', () => {
    const tax = calculateFederalTax(new Decimal(0))
    expect(tax.toNumber()).toBe(0)
  })
})

describe('Provincial Tax 2026', () => {
  it('should calculate Ontario tax for $100,000 income', () => {
    const tax = calculateProvincialTax(new Decimal(100000), 'ON')
    // ON brackets: 52886 @ 5.05%, (100000-52886) @ 9.15%
    // Gross: 52886 * 0.0505 + 47114 * 0.0915 = 2670.743 + 4310.931 = 6981.674
    // BPA credit: 11865 * 0.0505 = 599.1825
    // Net: ~6382.49
    expect(tax.toNumber()).toBeCloseTo(6382.49, 0)
  })

  it('should calculate Alberta tax for $100,000 income', () => {
    const tax = calculateProvincialTax(new Decimal(100000), 'AB')
    // AB: 100000 * 0.10 = 10000
    // BPA: 21885 * 0.10 = 2188.50
    // Net: 7811.50
    expect(tax.toNumber()).toBeCloseTo(7811.50, 0)
  })
})

describe('Total Tax', () => {
  it('should combine federal and provincial for Ontario $100K', () => {
    const result = calculateTotalTax(new Decimal(100000), 'ON')
    expect(result.totalTax.toNumber()).toBeGreaterThan(20000)
    expect(result.totalTax.toNumber()).toBeLessThan(25000)
    expect(result.effectiveRate.toNumber()).toBeGreaterThan(0.20)
    expect(result.effectiveRate.toNumber()).toBeLessThan(0.25)
  })

  it('should have positive marginal rate for non-zero income', () => {
    const result = calculateTotalTax(new Decimal(100000), 'ON')
    expect(result.marginalRate.toNumber()).toBeGreaterThan(0)
  })

  it('should have zero tax for zero income', () => {
    const result = calculateTotalTax(new Decimal(0), 'ON')
    expect(result.totalTax.toNumber()).toBe(0)
    expect(result.effectiveRate.toNumber()).toBe(0)
  })
})
