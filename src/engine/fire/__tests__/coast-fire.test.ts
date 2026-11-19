import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import {
  calculateFire, cppAnnual, fireNumberAt, realReturn, withdrawalNeeded, grossIncomeFor, type FireInputs,
} from '../coast-fire'

const D = (n: number | string) => new Decimal(n)

function inputs(over: Partial<FireInputs> = {}): FireInputs {
  return {
    currentAge: 30,
    retirementAge: 60,
    lifeExpectancy: 95,
    province: 'ON',
    portfolio: D(100000),
    taxDeferredShare: D(0),
    annualSpending: D(40000),
    annualContribution: D(20000),
    nominalReturn: D('0.05'),
    inflation: D('0'),
    withdrawalRate: D('0.04'),
    includeTax: false,
    cppAt65Monthly: D(0),
    cppStartAge: 65,
    oasResidenceYears: 0,
    oasStartAge: 65,
    pensionAnnual: D(0),
    pensionStartAge: 65,
    ...over,
  }
}

describe('realReturn', () => {
  it('uses the Fisher formula', () => {
    expect(realReturn(D('0.07'), D('0.02')).toNumber()).toBeCloseTo(0.04902, 5)
  })
})

describe('cppAnnual', () => {
  it('is 12x the monthly estimate at 65', () => {
    expect(cppAnnual(D(1000), 65).toNumber()).toBe(12000)
  })
  it('drops 36% at 60 and rises 42% at 70', () => {
    expect(cppAnnual(D(1000), 60).toNumber()).toBeCloseTo(7680, 6)
    expect(cppAnnual(D(1000), 70).toNumber()).toBeCloseTo(17040, 6)
  })
})

describe('withdrawalNeeded', () => {
  it('is spending less benefits without tax', () => {
    expect(withdrawalNeeded(D(40000), D(15000), D(1), 'ON', false).toNumber()).toBe(25000)
  })
  it('is never negative', () => {
    expect(withdrawalNeeded(D(10000), D(15000), D(1), 'ON', false).toNumber()).toBe(0)
  })
  it('is grossed up for tax on RRSP withdrawals', () => {
    const w = withdrawalNeeded(D(60000), D(0), D(1), 'ON', true)
    expect(w.toNumber()).toBeGreaterThan(60000)
  })
  it('needs no gross-up for TFSA money', () => {
    const w = withdrawalNeeded(D(60000), D(0), D(0), 'ON', true)
    expect(w.toNumber()).toBeCloseTo(60000, 2)
  })
  it('gross income is tax-free below the basic personal amount', () => {
    expect(grossIncomeFor(D(10000), 'ON', true).toNumber()).toBeCloseTo(10000, 2)
  })
})

describe('FIRE number', () => {
  it('is spending / SWR with no benefits', () => {
    const r = realReturn(D('0.05'), D(0))
    expect(fireNumberAt(60, inputs(), r).total.toNumber()).toBeCloseTo(1_000_000, 2)
  })

  it('falls when CPP and OAS start, but adds a bridge before 65', () => {
    const inp = inputs({ cppAt65Monthly: D(1000), oasResidenceYears: 40 })
    const r = realReturn(inp.nominalReturn, inp.inflation)
    const at60 = fireNumberAt(60, inp, r)
    const at65 = fireNumberAt(65, inp, r)
    expect(at65.bridge.toNumber()).toBe(0)
    expect(at65.total.toNumber()).toBeLessThan(1_000_000)
    expect(at60.bridge.toNumber()).toBeGreaterThan(0)
    expect(at60.total.toNumber()).toBeGreaterThan(at65.total.toNumber())
  })
})

describe('calculateFire', () => {
  it('coast number is the FIRE number discounted to today', () => {
    const res = calculateFire(inputs())
    expect(res.fireNumber.toNumber()).toBeCloseTo(1_000_000, 2)
    expect(res.coastNumber.toNumber()).toBeCloseTo(1_000_000 / 1.05 ** 30, 2)
  })

  it('flags Coast FIRE when the portfolio exceeds the coast number', () => {
    expect(calculateFire(inputs({ portfolio: D(250000) })).isCoastFire).toBe(true)
    expect(calculateFire(inputs({ portfolio: D(200000) })).isCoastFire).toBe(false)
  })

  it('finds the coast age', () => {
    const res = calculateFire(inputs())
    expect(res.coastAge).not.toBeNull()
    const age = res.coastAge!
    // Balance saved until coast age, then grown, meets the target.
    let bal = 100000
    for (let a = 30; a < age; a++) bal = bal * 1.05 + 20000
    expect(bal * 1.05 ** (60 - age)).toBeGreaterThanOrEqual(1_000_000 - 0.01)
    let before = 100000
    for (let a = 30; a < age - 1; a++) before = before * 1.05 + 20000
    expect(before * 1.05 ** (60 - age + 1)).toBeLessThan(1_000_000)
  })

  it('coast age is today when already coasting', () => {
    expect(calculateFire(inputs({ portfolio: D(300000) })).coastAge).toBe(30)
  })

  it('coast age is null when the target is out of reach', () => {
    expect(calculateFire(inputs({ portfolio: D(0), annualContribution: D(0) })).coastAge).toBeNull()
  })

  it('coasting at the coast number reaches the FIRE number at retirement', () => {
    const base = calculateFire(inputs())
    const res = calculateFire(inputs({ portfolio: base.coastNumber }))
    const atRetirement = res.projection.find(p => p.age === 60)!
    expect(atRetirement.coastNow.toNumber()).toBeCloseTo(1_000_000, 0)
  })

  it('money lasts to life expectancy at a 4% withdrawal with a 5% real return', () => {
    const base = calculateFire(inputs())
    const res = calculateFire(inputs({ portfolio: base.coastNumber }))
    expect(res.depletionAgeCoastNow).toBeNull()
  })

  it('reports a depletion age when the portfolio is too small', () => {
    const res = calculateFire(inputs({ portfolio: D(10000), annualContribution: D(0) }))
    expect(res.depletionAgeCoastNow).not.toBeNull()
  })

  it('isFire when the portfolio already covers retiring today', () => {
    expect(calculateFire(inputs({ portfolio: D(2_000_000) })).isFire).toBe(true)
  })
})
