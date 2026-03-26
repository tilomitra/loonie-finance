import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { CapitalGainsTracker } from '../capital-gains-tracker'

describe('CapitalGainsTracker', () => {
  describe('constructor', () => {
    it('should set market value to initial balance', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      expect(tracker.getMarketValue().toNumber()).toBe(100000)
    })

    it('should set ACB to 70% of initial balance by default', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      expect(tracker.getAcb().toNumber()).toBeCloseTo(70000, 0)
    })

    it('should use custom acbRatio when provided', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000), 0.5)
      expect(tracker.getAcb().toNumber()).toBeCloseTo(50000, 0)
    })

    it('should set ACB equal to market value when acbRatio is 1', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000), 1.0)
      expect(tracker.getAcb().toNumber()).toBe(100000)
      expect(tracker.getMarketValue().toNumber()).toBe(100000)
    })
  })

  describe('applyGrowth', () => {
    it('should increase market value by the return rate', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      tracker.applyGrowth(new Decimal('0.07'))
      expect(tracker.getMarketValue().toNumber()).toBeCloseTo(107000, 0)
    })

    it('should not change ACB when growth is applied', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      const acbBefore = tracker.getAcb().toNumber()
      tracker.applyGrowth(new Decimal('0.07'))
      expect(tracker.getAcb().toNumber()).toBe(acbBefore)
    })

    it('should compound correctly over multiple years', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000), 1.0)
      tracker.applyGrowth(new Decimal('0.10'))
      tracker.applyGrowth(new Decimal('0.10'))
      expect(tracker.getMarketValue().toNumber()).toBeCloseTo(121000, 0)
    })
  })

  describe('addContribution', () => {
    it('should increase market value by the contribution amount', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      tracker.addContribution(new Decimal(10000))
      expect(tracker.getMarketValue().toNumber()).toBeCloseTo(110000, 0)
    })

    it('should increase ACB by the contribution amount', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      const acbBefore = tracker.getAcb().toNumber()
      tracker.addContribution(new Decimal(10000))
      expect(tracker.getAcb().toNumber()).toBeCloseTo(acbBefore + 10000, 0)
    })

    it('should increase both ACB and market value by the same amount', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      const mvBefore = tracker.getMarketValue().toNumber()
      const acbBefore = tracker.getAcb().toNumber()
      tracker.addContribution(new Decimal(25000))
      expect(tracker.getMarketValue().toNumber() - mvBefore).toBeCloseTo(25000, 0)
      expect(tracker.getAcb().toNumber() - acbBefore).toBeCloseTo(25000, 0)
    })
  })

  describe('withdraw', () => {
    it('should return the withdrawal amount', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      const result = tracker.withdraw(new Decimal(10000))
      expect(result.withdrawal.toNumber()).toBe(10000)
    })

    it('should calculate taxable amount as 50% of the capital gain portion', () => {
      // 100k market value, 70k ACB -> 30% gain ratio
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      const result = tracker.withdraw(new Decimal(10000))
      // gainRatio = (100000 - 70000) / 100000 = 0.30
      // capitalGain = 10000 * 0.30 = 3000
      // taxableAmount = 3000 * 0.5 = 1500
      expect(result.taxableAmount.toNumber()).toBeCloseTo(1500, 2)
    })

    it('should return zero taxable amount when ACB equals market value', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000), 1.0)
      const result = tracker.withdraw(new Decimal(10000))
      expect(result.taxableAmount.toNumber()).toBe(0)
    })

    it('should reduce market value by withdrawal amount', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      tracker.withdraw(new Decimal(10000))
      expect(tracker.getMarketValue().toNumber()).toBeCloseTo(90000, 0)
    })

    it('should reduce ACB proportionally after withdrawal', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      // ACB = 70000, withdrawing 10000 from 100000 = 10% of market value
      // new ACB = 70000 * (1 - 10000/100000) = 70000 * 0.9 = 63000
      tracker.withdraw(new Decimal(10000))
      expect(tracker.getAcb().toNumber()).toBeCloseTo(63000, 0)
    })

    it('should return zero taxable amount when market value is zero', () => {
      const tracker = new CapitalGainsTracker(new Decimal(0))
      const result = tracker.withdraw(new Decimal(5000))
      expect(result.withdrawal.toNumber()).toBe(5000)
      expect(result.taxableAmount.toNumber()).toBe(0)
    })

    it('should track ACB correctly across multiple withdrawals', () => {
      const tracker = new CapitalGainsTracker(new Decimal(100000))
      // First withdrawal: 10000 from 100000
      const r1 = tracker.withdraw(new Decimal(10000))
      // gainRatio = 0.3, taxable = 10000 * 0.3 * 0.5 = 1500
      expect(r1.taxableAmount.toNumber()).toBeCloseTo(1500, 2)

      // After first withdrawal: MV = 90000, ACB = 63000
      // gainRatio = (90000 - 63000) / 90000 = 27000/90000 = 0.3
      const r2 = tracker.withdraw(new Decimal(9000))
      // taxable = 9000 * 0.3 * 0.5 = 1350
      expect(r2.taxableAmount.toNumber()).toBeCloseTo(1350, 2)
    })

    it('should clamp gain ratio at 0 when ACB exceeds market value', () => {
      // Simulate a loss scenario: acbRatio > 1 is not typical, but test the clamp
      const tracker = new CapitalGainsTracker(new Decimal(100000), 1.2)
      const result = tracker.withdraw(new Decimal(10000))
      expect(result.taxableAmount.toNumber()).toBe(0)
    })
  })
})
