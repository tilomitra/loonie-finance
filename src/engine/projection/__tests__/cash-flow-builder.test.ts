import { describe, it, expect } from 'vitest'
import { buildAnnualCashFlows } from '../cash-flow-builder'
import type { LifeEvent } from '@/types'

// Helper to create a minimal LifeEvent
function makeEvent(overrides: Partial<LifeEvent> & Pick<LifeEvent, 'type' | 'startAge'>): LifeEvent {
  return {
    id: 'test-id',
    name: 'Test Event',
    amount: '1000',
    person: 'self',
    endAge: undefined,
    ...overrides,
  }
}

describe('buildAnnualCashFlows', () => {
  describe('empty events', () => {
    it('returns zero cash flows for all years when no events provided', () => {
      const result = buildAnnualCashFlows([], 30, undefined, 5)

      expect(result.size).toBe(6) // yearOffset 0 through 5
      for (let i = 0; i <= 5; i++) {
        const flow = result.get(i)!
        expect(flow.incomeStreams.toNumber()).toBe(0)
        expect(flow.expenseStreams.toNumber()).toBe(0)
        expect(flow.oneTimeInflows.toNumber()).toBe(0)
        expect(flow.oneTimeOutflows.toNumber()).toBe(0)
        expect(flow.netCashFlow.toNumber()).toBe(0)
      }
    })

    it('sets correct ages with no partner', () => {
      const result = buildAnnualCashFlows([], 35, undefined, 3)

      expect(result.get(0)!.age).toBe(35)
      expect(result.get(0)!.partnerAge).toBeUndefined()
      expect(result.get(1)!.age).toBe(36)
      expect(result.get(3)!.age).toBe(38)
    })

    it('sets correct ages with a partner', () => {
      const result = buildAnnualCashFlows([], 35, 33, 2)

      expect(result.get(0)!.age).toBe(35)
      expect(result.get(0)!.partnerAge).toBe(33)
      expect(result.get(2)!.age).toBe(37)
      expect(result.get(2)!.partnerAge).toBe(35)
    })
  })

  describe('single income stream', () => {
    it('annualizes monthly income and adds to incomeStreams for all active years', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'income', amount: '5000', startAge: 30, person: 'self' }),
      ]
      const result = buildAnnualCashFlows(events, 30, undefined, 4)

      for (let i = 0; i <= 4; i++) {
        const flow = result.get(i)!
        // $5,000/mo × 12 = $60,000/yr
        expect(flow.incomeStreams.toNumber()).toBe(60000)
        expect(flow.netCashFlow.toNumber()).toBe(60000)
      }
    })

    it('income stream not yet started shows zero', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'income', amount: '3000', startAge: 40, person: 'self' }),
      ]
      // selfAge is 30, project 5 years (ages 30–35): event starts at 40
      const result = buildAnnualCashFlows(events, 30, undefined, 5)

      for (let i = 0; i <= 5; i++) {
        expect(result.get(i)!.incomeStreams.toNumber()).toBe(0)
      }
    })

    it('income stream starts mid-projection', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'income', amount: '2000', startAge: 33, person: 'self' }),
      ]
      // selfAge 30, project 5 years → ages 30-35
      const result = buildAnnualCashFlows(events, 30, undefined, 5)

      expect(result.get(0)!.incomeStreams.toNumber()).toBe(0) // age 30
      expect(result.get(1)!.incomeStreams.toNumber()).toBe(0) // age 31
      expect(result.get(2)!.incomeStreams.toNumber()).toBe(0) // age 32
      expect(result.get(3)!.incomeStreams.toNumber()).toBe(24000) // age 33: $2000×12
      expect(result.get(4)!.incomeStreams.toNumber()).toBe(24000) // age 34
      expect(result.get(5)!.incomeStreams.toNumber()).toBe(24000) // age 35
    })
  })

  describe('expense stream with start and end ages', () => {
    it('expense stream is active between startAge (inclusive) and endAge (exclusive)', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'expense', amount: '1000', startAge: 32, endAge: 35, person: 'self' }),
      ]
      // selfAge 30, project 6 years → ages 30-36
      const result = buildAnnualCashFlows(events, 30, undefined, 6)

      expect(result.get(0)!.expenseStreams.toNumber()).toBe(0)     // age 30
      expect(result.get(1)!.expenseStreams.toNumber()).toBe(0)     // age 31
      expect(result.get(2)!.expenseStreams.toNumber()).toBe(12000) // age 32
      expect(result.get(3)!.expenseStreams.toNumber()).toBe(12000) // age 33
      expect(result.get(4)!.expenseStreams.toNumber()).toBe(12000) // age 34
      expect(result.get(5)!.expenseStreams.toNumber()).toBe(0)     // age 35 (endAge excluded)
      expect(result.get(6)!.expenseStreams.toNumber()).toBe(0)     // age 36
    })

    it('expense that has ended shows zero', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'expense', amount: '500', startAge: 20, endAge: 25, person: 'self' }),
      ]
      // selfAge 30: event ended long ago
      const result = buildAnnualCashFlows(events, 30, undefined, 3)

      for (let i = 0; i <= 3; i++) {
        expect(result.get(i)!.expenseStreams.toNumber()).toBe(0)
      }
    })

    it('expense with no endAge runs indefinitely', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'expense', amount: '2000', startAge: 30, person: 'self' }),
      ]
      const result = buildAnnualCashFlows(events, 30, undefined, 10)

      for (let i = 0; i <= 10; i++) {
        expect(result.get(i)!.expenseStreams.toNumber()).toBe(24000)
      }
    })
  })

  describe('one-time events', () => {
    it('one-time event triggers only at startAge', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'one-time', amount: '50000', startAge: 33, person: 'self' }),
      ]
      // selfAge 30, project 5 years → ages 30-35
      const result = buildAnnualCashFlows(events, 30, undefined, 5)

      expect(result.get(0)!.oneTimeInflows.toNumber()).toBe(0)     // age 30
      expect(result.get(1)!.oneTimeInflows.toNumber()).toBe(0)     // age 31
      expect(result.get(2)!.oneTimeInflows.toNumber()).toBe(0)     // age 32
      expect(result.get(3)!.oneTimeInflows.toNumber()).toBe(50000) // age 33
      expect(result.get(4)!.oneTimeInflows.toNumber()).toBe(0)     // age 34
      expect(result.get(5)!.oneTimeInflows.toNumber()).toBe(0)     // age 35
    })

    it('one-time event at startAge adds to netCashFlow', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'one-time', amount: '100000', startAge: 40, person: 'self' }),
      ]
      const result = buildAnnualCashFlows(events, 40, undefined, 2)

      expect(result.get(0)!.netCashFlow.toNumber()).toBe(100000) // age 40
      expect(result.get(1)!.netCashFlow.toNumber()).toBe(0)      // age 41
    })

    it('oneTimeOutflows is always zero', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'one-time', amount: '25000', startAge: 35, person: 'self' }),
      ]
      const result = buildAnnualCashFlows(events, 35, undefined, 1)

      expect(result.get(0)!.oneTimeOutflows.toNumber()).toBe(0)
    })
  })

  describe('partner events', () => {
    it('partner events use partner age for activation', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'income', amount: '4000', startAge: 35, person: 'partner' }),
      ]
      // self is 40, partner is 33. Partner reaches 35 at yearOffset=2.
      const result = buildAnnualCashFlows(events, 40, 33, 4)

      expect(result.get(0)!.incomeStreams.toNumber()).toBe(0)     // partner age 33
      expect(result.get(1)!.incomeStreams.toNumber()).toBe(0)     // partner age 34
      expect(result.get(2)!.incomeStreams.toNumber()).toBe(48000) // partner age 35: $4000×12
      expect(result.get(3)!.incomeStreams.toNumber()).toBe(48000) // partner age 36
    })

    it('partner events are skipped when there is no partner', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'income', amount: '3000', startAge: 30, person: 'partner' }),
      ]
      const result = buildAnnualCashFlows(events, 30, undefined, 3)

      for (let i = 0; i <= 3; i++) {
        expect(result.get(i)!.incomeStreams.toNumber()).toBe(0)
      }
    })

    it('partner one-time events use partner age', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'one-time', amount: '80000', startAge: 40, person: 'partner' }),
      ]
      // self 35, partner 38. Partner turns 40 at yearOffset=2.
      const result = buildAnnualCashFlows(events, 35, 38, 4)

      expect(result.get(0)!.oneTimeInflows.toNumber()).toBe(0)
      expect(result.get(1)!.oneTimeInflows.toNumber()).toBe(0)
      expect(result.get(2)!.oneTimeInflows.toNumber()).toBe(80000) // partner age 40
      expect(result.get(3)!.oneTimeInflows.toNumber()).toBe(0)
    })
  })

  describe('joint events', () => {
    it('joint events use self age for comparison', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'expense', amount: '2500', startAge: 32, endAge: 37, person: 'joint' }),
      ]
      // selfAge 30, partnerAge 28
      const result = buildAnnualCashFlows(events, 30, 28, 8)

      expect(result.get(0)!.expenseStreams.toNumber()).toBe(0)     // self age 30
      expect(result.get(1)!.expenseStreams.toNumber()).toBe(0)     // self age 31
      expect(result.get(2)!.expenseStreams.toNumber()).toBe(30000) // self age 32: $2500×12
      expect(result.get(6)!.expenseStreams.toNumber()).toBe(30000) // self age 36
      expect(result.get(7)!.expenseStreams.toNumber()).toBe(0)     // self age 37 (excluded)
    })

    it('joint events work even without a partner (uses self age)', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'income', amount: '1000', startAge: 30, person: 'joint' }),
      ]
      const result = buildAnnualCashFlows(events, 30, undefined, 2)

      expect(result.get(0)!.incomeStreams.toNumber()).toBe(12000)
      expect(result.get(1)!.incomeStreams.toNumber()).toBe(12000)
    })
  })

  describe('multiple overlapping events', () => {
    it('multiple income streams sum correctly in a single year', () => {
      const events: LifeEvent[] = [
        makeEvent({ id: 'e1', type: 'income', amount: '3000', startAge: 30, person: 'self' }),
        makeEvent({ id: 'e2', type: 'income', amount: '2000', startAge: 30, person: 'self' }),
        makeEvent({ id: 'e3', type: 'income', amount: '1500', startAge: 30, person: 'joint' }),
      ]
      const result = buildAnnualCashFlows(events, 30, undefined, 1)

      // (3000 + 2000 + 1500) × 12 = 78000
      expect(result.get(0)!.incomeStreams.toNumber()).toBe(78000)
    })

    it('income and expense streams both apply, netCashFlow is difference', () => {
      const events: LifeEvent[] = [
        makeEvent({ id: 'inc', type: 'income', amount: '5000', startAge: 30, person: 'self' }),
        makeEvent({ id: 'exp', type: 'expense', amount: '2000', startAge: 30, person: 'self' }),
      ]
      const result = buildAnnualCashFlows(events, 30, undefined, 1)

      const flow = result.get(0)!
      expect(flow.incomeStreams.toNumber()).toBe(60000)  // 5000×12
      expect(flow.expenseStreams.toNumber()).toBe(24000) // 2000×12
      expect(flow.netCashFlow.toNumber()).toBe(36000)   // 60000 - 24000
    })

    it('one-time and streams can coexist in the same year', () => {
      const events: LifeEvent[] = [
        makeEvent({ id: 'inc', type: 'income', amount: '4000', startAge: 35, person: 'self' }),
        makeEvent({ id: 'ot', type: 'one-time', amount: '200000', startAge: 35, person: 'self' }),
      ]
      const result = buildAnnualCashFlows(events, 35, undefined, 2)

      const flow = result.get(0)! // age 35
      expect(flow.incomeStreams.toNumber()).toBe(48000)   // 4000×12
      expect(flow.oneTimeInflows.toNumber()).toBe(200000)
      expect(flow.netCashFlow.toNumber()).toBe(248000)   // 48000 + 200000

      const flowYear1 = result.get(1)! // age 36: one-time gone, income still active
      expect(flowYear1.incomeStreams.toNumber()).toBe(48000)
      expect(flowYear1.oneTimeInflows.toNumber()).toBe(0)
      expect(flowYear1.netCashFlow.toNumber()).toBe(48000)
    })

    it('multiple one-time events at the same age sum their inflows', () => {
      const events: LifeEvent[] = [
        makeEvent({ id: 'a', type: 'one-time', amount: '10000', startAge: 40, person: 'self' }),
        makeEvent({ id: 'b', type: 'one-time', amount: '25000', startAge: 40, person: 'self' }),
      ]
      const result = buildAnnualCashFlows(events, 40, undefined, 1)

      expect(result.get(0)!.oneTimeInflows.toNumber()).toBe(35000)
    })

    it('mixed self and partner events both contribute when partner exists', () => {
      const events: LifeEvent[] = [
        makeEvent({ id: 's', type: 'income', amount: '5000', startAge: 30, person: 'self' }),
        makeEvent({ id: 'p', type: 'income', amount: '4000', startAge: 30, person: 'partner' }),
      ]
      // self 30, partner 30
      const result = buildAnnualCashFlows(events, 30, 30, 1)

      // (5000 + 4000) × 12 = 108000
      expect(result.get(0)!.incomeStreams.toNumber()).toBe(108000)
    })
  })

  describe('edge cases', () => {
    it('projects exactly yearsToProject + 1 data points (0 to yearsToProject)', () => {
      const result = buildAnnualCashFlows([], 30, undefined, 10)
      expect(result.size).toBe(11)
      expect(result.has(0)).toBe(true)
      expect(result.has(10)).toBe(true)
      expect(result.has(11)).toBe(false)
    })

    it('handles zero yearsToProject (single year snapshot)', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'income', amount: '3000', startAge: 30, person: 'self' }),
      ]
      const result = buildAnnualCashFlows(events, 30, undefined, 0)
      expect(result.size).toBe(1)
      expect(result.get(0)!.incomeStreams.toNumber()).toBe(36000)
    })

    it('handles decimal string amounts precisely', () => {
      const events: LifeEvent[] = [
        makeEvent({ type: 'income', amount: '1234.56', startAge: 30, person: 'self' }),
      ]
      const result = buildAnnualCashFlows(events, 30, undefined, 0)
      // 1234.56 × 12 = 14814.72
      expect(result.get(0)!.incomeStreams.toNumber()).toBeCloseTo(14814.72, 2)
    })
  })
})
