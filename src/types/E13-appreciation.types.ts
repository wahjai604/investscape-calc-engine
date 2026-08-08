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
