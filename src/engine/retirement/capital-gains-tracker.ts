import Decimal from 'decimal.js'

export class CapitalGainsTracker {
  private acb: Decimal
  private marketValue: Decimal

  constructor(initialBalance: Decimal, acbRatio?: number) {
    this.marketValue = initialBalance
    this.acb = initialBalance.mul(acbRatio ?? 0.7)
  }

  /** Update market value after a year of growth */
  applyGrowth(returnRate: Decimal): void {
    this.marketValue = this.marketValue.mul(new Decimal(1).plus(returnRate))
  }

  /** Add new contributions (increases both ACB and market value) */
  addContribution(amount: Decimal): void {
    this.acb = this.acb.plus(amount)
    this.marketValue = this.marketValue.plus(amount)
  }

  /**
   * Withdraw an amount. Returns the taxable capital gain portion.
   * Uses proportional ACB method: gain ratio = (marketValue - acb) / marketValue
   * Taxable amount = withdrawal * gainRatio * 0.5 (50% inclusion rate)
   */
  withdraw(amount: Decimal): { withdrawal: Decimal; taxableAmount: Decimal } {
    if (this.marketValue.lte(0)) {
      return { withdrawal: amount, taxableAmount: new Decimal(0) }
    }

    const preWithdrawalMarketValue = this.marketValue
    const gainRatio = Decimal.max(
      this.marketValue.minus(this.acb).div(this.marketValue),
      new Decimal(0)
    )
    const capitalGain = amount.mul(gainRatio)
    const taxableAmount = capitalGain.mul(0.5)

    this.marketValue = this.marketValue.minus(amount)
    this.acb = this.acb.mul(
      new Decimal(1).minus(amount.div(preWithdrawalMarketValue))
    )

    return { withdrawal: amount, taxableAmount }
  }

  /** Get current market value */
  getMarketValue(): Decimal {
    return this.marketValue
  }

  /** Get current ACB */
  getAcb(): Decimal {
    return this.acb
  }
}
