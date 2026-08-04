export interface AppreciationInput {
  purchasePrice: number;
  downPaymentPercent: number;
  /** Down payment + closing costs — the equity actually put into the deal at purchase. */
  initialEquity: number;
  /** Typically 5. */
  holdPeriodYears: number;
  /** e.g. 0.03 for 3% annual growth. */
  annualAppreciationRate: number;
  /** Defaults to 0.02 (2%). Accepted for consistency with other deal-input shapes; not used by this module's own math (appreciation and equity don't depend on it — see calculateAppreciation's JSDoc). */
  closingCostsPercent?: number;
  /**
   * Loan balance remaining at the end of the hold period. Not computed
   * here — appreciation.ts has no mortgage rate/term inputs of its own.
   * The caller sources this from amortization.ts (e.g. remainingBalance()
   * or the last row of amortizationSchedule() at holdPeriodYears * 12
   * months) and passes it in.
   */
  remainingLoanBalance: number;
}

export interface AppreciationResult {
  purchasePrice: number;
  /** purchasePrice × (1 + annualAppreciationRate)^holdPeriodYears */
  projectedSalePrice: number;
  /** $ amount gained: projectedSalePrice - purchasePrice. */
  totalAppreciation: number;
  /** % gain: (totalAppreciation / purchasePrice) × 100. */
  appreciationPercent: number;
  /** Echoes annualAppreciationRate from the input, for display alongside the projected figures. */
  annualizedAppreciationRate: number;
  /** projectedSalePrice - remainingLoanBalance. */
  projectedEquity: number;
  /** Plain-English explanation of the projection. */
  breakdown: string;
}

/**
 * downPaymentPercent and closingCostsPercent are accepted on the input for
 * consistency with the rest of the deal shape but aren't used by any
 * formula here — appreciation is purely a function of purchasePrice,
 * annualAppreciationRate, and holdPeriodYears (compounded annually), and
 * projected equity is a function of the projected sale price and the loan
 * balance the caller supplies. initialEquity IS used, but only in the
 * breakdown narrative, as the baseline the projected equity is measured
 * against.
 */
export function calculateAppreciation(input: AppreciationInput): AppreciationResult {
  const { purchasePrice, initialEquity, holdPeriodYears, annualAppreciationRate, remainingLoanBalance } = input;

  const projectedSalePrice = purchasePrice * Math.pow(1 + annualAppreciationRate, holdPeriodYears);
  const totalAppreciation = projectedSalePrice - purchasePrice;
  const appreciationPercent = (totalAppreciation / purchasePrice) * 100;
  const projectedEquity = projectedSalePrice - remainingLoanBalance;
  const equityGain = projectedEquity - initialEquity;

  const breakdown =
    `At ${(annualAppreciationRate * 100).toFixed(2)}% annual appreciation over ${holdPeriodYears} year${holdPeriodYears === 1 ? "" : "s"}, ` +
    `the property is projected to grow from $${purchasePrice.toLocaleString()} to $${projectedSalePrice.toFixed(2)} ` +
    `(+$${totalAppreciation.toFixed(2)}, ${appreciationPercent.toFixed(2)}%). ` +
    `After paying off the projected remaining loan balance of $${remainingLoanBalance.toFixed(2)}, projected equity is ` +
    `$${projectedEquity.toFixed(2)} — a gain of $${equityGain.toFixed(2)} over the $${initialEquity.toLocaleString()} initially invested.`;

  return {
    purchasePrice,
    projectedSalePrice,
    totalAppreciation,
    appreciationPercent,
    annualizedAppreciationRate: annualAppreciationRate,
    projectedEquity,
    breakdown,
  };
}
