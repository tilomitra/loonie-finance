import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { compoundGrowth, futureValueWithContributions } from '../compound'

describe('Compound Growth', () => {
  it('should grow $100,000 at 7% for 10 years', () => {
    const result = compoundGrowth(new Decimal(100000), new Decimal('0.07'), 10)
    expect(result.toNumber()).toBeCloseTo(196715.14, 0)
  })

  it('should return principal for 0 years', () => {
    const result = compoundGrowth(new Decimal(100000), new Decimal('0.07'), 0)
    expect(result.toNumber()).toBe(100000)
  })

  it('should handle 0% return', () => {
    const result = compoundGrowth(new Decimal(100000), new Decimal(0), 10)
    expect(result.toNumber()).toBe(100000)
  })
})

describe('Future Value with Contributions', () => {
  it('should calculate correctly with annual contributions', () => {
    // $10,000 initial, $5,000/year, 7% return, 20 years
    const result = futureValueWithContributions(
      new Decimal(10000),
      new Decimal(5000),
      new Decimal('0.07'),
      20
    )
    // Principal grows to ~38,697. Contributions grow to ~204,977. Total ~243,674
    expect(result.toNumber()).toBeGreaterThan(240000)
    expect(result.toNumber()).toBeLessThan(250000)
  })

  it('should handle 0% return with contributions', () => {
    const result = futureValueWithContributions(
      new Decimal(10000),
      new Decimal(5000),
      new Decimal(0),
      10
    )
    expect(result.toNumber()).toBe(60000) // 10000 + 5000*10
  })
})
