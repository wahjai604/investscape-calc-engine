export type CurrencyCode = "CAD" | "USD";
export type FXRateSource = "user_input" | "market_current" | "historical_average";

export interface DealMetrics {
  purchasePrice: number;
  annualCashFlow: number;
  projectedEquity: number;
  /** Pre-FX IRR, already computed in dealCurrency by the caller — this module doesn't recompute it for the headline figures, only reconstructs an independent series for FX-sensitivity purposes (see calculateFXConversion's JSDoc). */
  irr: number;
  /**
   * Not in the original E23 field list — added because fxSensitivity's
   * "what FX rate yields a target IRR" / "IRR if rate moves ±5%" fields
   * are only meaningful with a real multi-year cash flow series to run an
   * entry-vs-exit-rate scenario through. See calculateFXConversion's
   * JSDoc for the full explanation.
   */
  holdPeriodYears: number;
  /**
   * Also not in the original field list. purchasePrice isn't the right
   * entry-year cash outflow for reconstructing an IRR series — real deals
   * are financed, so the actual t=0 cash outflow is equityInvested (down
   * payment + closing costs), not the full purchase price. Using
   * purchasePrice there instead produces a wildly different (and much
   * worse) IRR than an unlevered deal's real return, which defeats the
   * purpose of fxSensitivity showing a meaningful delta around the deal's
   * actual known IRR. purchasePrice itself is still used, unchanged, for
   * the plain currency-conversion display fields.
   */
  equityInvested: number;
}

export interface FXConversionInput {
  dealMetrics: DealMetrics;
  dealCurrency: CurrencyCode;
  /** Currency the investor reports in. */
  investorCurrency: CurrencyCode;
  /** e.g. 1.36 means 1 USD = 1.36 CAD. */
  fxRate: number;
  fxRateSource: FXRateSource;
}

export interface CurrencyMetrics {
  purchasePrice: number;
  cashFlow: number;
  equity: number;
  irr: number;
}

export interface FXSensitivity {
  /** Hypothetical exit-time FX rate at which the investor-currency IRR would equal 5%, holding the entry rate fixed at fxRate. 1.0 when dealCurrency === investorCurrency — there's no FX exposure to solve over. */
  rateIfIRRTarget5percent: number;
  rateIfIRRTarget10percent: number;
  /** Investor-currency IRR if the exit-time FX rate is fxRate × 1.05 instead of fxRate (entry still locked in at fxRate). */
  irrAt_plus5pct_rate: number;
  irrAt_minus5pct_rate: number;
}

export interface FXConversionResult {
  dealCurrency: string;
  investorCurrency: string;
  /** 1.0 when dealCurrency === investorCurrency, regardless of whatever was passed in input.fxRate — matches "no conversion needed, fxRate = 1.0". */
  fxRate: number;
  dealMetricsInDealCurrency: CurrencyMetrics;
  dealMetricsInInvestorCurrency: CurrencyMetrics;
  fxSensitivity: FXSensitivity;
  summary: string;
}
